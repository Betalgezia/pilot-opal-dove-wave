import { relayLogger } from "@/lib/relay/logger";
import { DEFAULT_TEST_URL } from "./constants";
import { fetchSourceText } from "./fetch-source.server";
import { canRunMihomo } from "./mihomo-bin.server";
import { enrichNodesWithGeoIp } from "./geoip.server";
import { parseSubscription } from "./parse";
import { mergeNodesByIdentity } from "./node-identity";
import { probeNodes } from "./probe.server";
import { sampleForProbe } from "./sample";
import { getQualityHistory, qualityHistoryKey, recordQualityResults } from "./quality-history.server";
import { pickDeepVerification, QUALITY_TARGETS, rankNodes, scoreNode } from "./quality";
import { pickExportNodes } from "./select";
import { beginScan, endScan, getActiveScanSignal } from "./scan-control.server";
import type { ParsedNode, ProbeMode, ProbedNode, ScanMetrics, ScanResult, SourceDef, SourceScan } from "./types";

export { pickExportNodes };
export interface ScanOpts { perSource?: number; globalCap?: number; timeoutMs?: number; real?: boolean; testUrl?: string; force?: boolean; }
const SCAN_CACHE_MS = 180_000;
const DEEP_VERIFY_MAX = 80;
const scanCache = new Map<string, { at: number; result: ScanResult }>();
const scanLocks = new Map<string, Promise<ScanResult>>();
function scanKey(sources: SourceDef[], opts: ScanOpts): string { return JSON.stringify({ sources: sources.filter((s) => s.enabled).map((s) => ({ id: s.id, name: s.name, url: s.url })).sort((a, b) => a.id.localeCompare(b.id)), perSource: opts.perSource ?? 16, globalCap: opts.globalCap ?? 64, timeoutMs: opts.timeoutMs ?? 2200, real: opts.real !== false, testUrl: opts.testUrl || DEFAULT_TEST_URL }); }
function throwIfCancelled(): void { if (getActiveScanSignal()?.aborted) throw new DOMException("Сканирование остановлено", "AbortError"); }
function countTargetChecks(nodes: ProbedNode[]): number { return nodes.reduce((sum, node) => sum + Object.keys(node.targetResults ?? {}).length, 0); }
function unknownNodes(nodes: ParsedNode[]): ProbedNode[] { return nodes.map((node) => ({ ...node, latency: null, alive: false, probeState: "unknown" as const })); }
function mergeProbeNote(base: string | null, extra: string): string { return base ? `${base} · ${extra}` : extra; }

export async function runScanCached(sources: SourceDef[], opts: ScanOpts = {}): Promise<ScanResult> {
  const key = scanKey(sources, opts); const now = Date.now(); const cached = scanCache.get(key); if (!opts.force && cached && now - cached.at < SCAN_CACHE_MS) { relayLogger.info("scan", "Scan cache hit", { ageMs: now - cached.at }); return cached.result; }
  const pending = scanLocks.get(key); if (pending) { relayLogger.info("scan", "Joined active scan", { sources: sources.filter((s) => s.enabled).length }); return pending; }
  const controller = beginScan(); const promise = runScan(sources, opts).then((result) => { scanCache.set(key, { at: Date.now(), result }); return result; }); scanLocks.set(key, promise);
  try { return await promise; } finally { endScan(controller); if (scanLocks.get(key) === promise) scanLocks.delete(key); }
}

export async function runScan(sources: SourceDef[], opts?: ScanOpts): Promise<ScanResult> {
  const started = Date.now();
  const perSource = opts?.perSource ?? 16; const globalCap = opts?.globalCap ?? 64; const timeoutMs = opts?.timeoutMs ?? 2200; const wantReal = opts?.real !== false;
  const enabled = sources.filter((s) => s.enabled);
  relayLogger.info("scan", "Scan started", { sources: enabled.length, perSource, globalCap, timeoutMs, real: wantReal, testUrl: opts?.testUrl || DEFAULT_TEST_URL });
  try {
    throwIfCancelled();
    const history = await getQualityHistory();
    const fetchedStart = Date.now();
    const fetched = await Promise.all(enabled.map(async (source) => {
      const fetchStart = Date.now();
      try {
        const text = await fetchSourceText(source.url);
        const fetchMs = Date.now() - fetchStart;
        throwIfCancelled();
        const parseStart = Date.now();
        let nodes: ParsedNode[];
        try {
          nodes = parseSubscription(text, source.id, source.name);
          if (nodes.length === 0) relayLogger.warn("parse", "Source parsed with zero nodes", { source: source.name, url: source.url, bytes: Buffer.byteLength(text, "utf8") });
          else relayLogger.info("parse", "Source parsed", { source: source.name, url: source.url, nodes: nodes.length, durationMs: Date.now() - parseStart });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          relayLogger.error("parse", "Source parse failed", { source: source.name, url: source.url, durationMs: Date.now() - parseStart, error: message });
          throw err;
        }
        return { source, nodes, error: null as string | null, fetchMs, parseMs: Date.now() - parseStart };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        const message = err instanceof Error ? err.message : "fetch failed";
        relayLogger.error("scan", "Source stage failed", { source: source.name, url: source.url, durationMs: Date.now() - fetchStart, error: message });
        return { source, nodes: [] as ParsedNode[], error: message, fetchMs: Date.now() - fetchStart, parseMs: 0 };
      }
    }));
    const fetchWallMs = Date.now() - fetchedStart; throwIfCancelled();
    const parsedNodes = fetched.flatMap((f) => f.nodes);
    const allNodes = mergeNodesByIdentity(parsedNodes);
    const uniqueTotal = allNodes.length;
    const deduplicated = Math.max(0, parsedNodes.length - allNodes.length);
    relayLogger.info("scan", "Fetch/parse stage complete", { fetchedSources: fetched.filter((f) => f.error === null).length, parsed: parsedNodes.length, unique: uniqueTotal, deduplicated, durationMs: fetchWallMs });

    const sampleStart = Date.now(); const sampled = sampleForProbe(allNodes, perSource, globalCap, history, started); const sampleMs = Date.now() - sampleStart;
    relayLogger.info("scan", "Probe sample selected", { sampled: sampled.length, unique: uniqueTotal, durationMs: sampleMs });

    let probeMode: ProbeMode = wantReal ? "mihomo" : "tcp"; let testUrl: string | null = wantReal ? (opts?.testUrl || DEFAULT_TEST_URL) : null; let probeNote: string | null = null; let probed: ProbedNode[]; let mihomoLoaded = 0; let mihomoDelayReceived = 0; let unknown = 0; let mihomoRounds = 0;
    const probeStart = Date.now();
    if (wantReal) {
      if (!canRunMihomo()) { probed = unknownNodes(sampled); unknown = probed.length; probeNote = "Ядро mihomo недоступно: результаты проверки неизвестны; TCP не используется как замена."; relayLogger.error("mihomo", "Mihomo is unavailable", { sampled: sampled.length }); }
      else {
        try { const { probeNodesMihomo } = await import("./mihomo-probe.server"); const real = await probeNodesMihomo(sampled, opts?.testUrl || DEFAULT_TEST_URL); probed = real.nodes; testUrl = real.testUrl; probeNote = real.note; mihomoLoaded = real.metrics.mihomoLoaded; mihomoDelayReceived = real.metrics.mihomoDelayReceived; unknown = real.metrics.unknown; mihomoRounds = real.metrics.rounds; }
        catch (err) { probed = unknownNodes(sampled); unknown = probed.length; probeNote = `Проверка mihomo не завершилась: ${err instanceof Error ? err.message : "неизвестная ошибка"}. Узлы отмечены как неизвестные; TCP не используется как замена.`; relayLogger.error("mihomo", "Mihomo probe failed", { sampled: sampled.length, error: err instanceof Error ? err.message : String(err) }); }
      }
    } else { probed = await probeNodes(sampled, timeoutMs); unknown = probed.filter((n) => n.probeState === "unknown").length; probeNote = "Режим без mihomo: проверяется только TCP-порт, это не подтверждение работоспособности VPN."; }
    const probeMs = Date.now() - probeStart; throwIfCancelled();
    relayLogger.info("scan", "Probe stage complete", { mode: probeMode, sampled: sampled.length, mihomoLoaded, mihomoDelayReceived, unknown, durationMs: probeMs, rounds: mihomoRounds });

    const geoStart = Date.now(); probed = await enrichNodesWithGeoIp(probed); const geoIpMs = Date.now() - geoStart; throwIfCancelled();
    relayLogger.info("scan", "GeoIP stage complete", { durationMs: geoIpMs });

    const deepStart = Date.now();
    if (probeMode === "mihomo" && probed.some((node) => node.alive)) {
      try { const { verifyNodesMihomo } = await import("./mihomo-probe.server"); const primaryUrl = testUrl || opts?.testUrl || DEFAULT_TEST_URL; const targetUrls = QUALITY_TARGETS.map((target) => target.url).filter((url) => url !== primaryUrl).slice(0, 2); const candidates = pickDeepVerification(probed, Math.min(DEEP_VERIFY_MAX, Math.max(24, Math.min(80, globalCap)))); const targetResults = await verifyNodesMihomo(candidates, targetUrls); probed = probed.map((node) => { const results = targetResults.get(node.id); return results ? { ...node, targetResults: results } : node; }); }
      catch (err) { probeNote = mergeProbeNote(probeNote, err instanceof Error ? `Дополнительная проверка ресурсов пропущена: ${err.message}` : "Дополнительная проверка ресурсов пропущена"); relayLogger.warn("scan", "Deep verification failed", { error: err instanceof Error ? err.message : String(err) }); }
    }
    const deepVerifyMs = Date.now() - deepStart; throwIfCancelled();
    relayLogger.info("scan", "Deep verification stage complete", { durationMs: deepVerifyMs, verified: probed.filter((node) => Object.keys(node.targetResults ?? {}).length > 0).length, checks: countTargetChecks(probed) });

    const qualityStart = Date.now(); const now = Date.now(); probed = probed.map((node) => ({ ...node, ...scoreNode(node, history.get(qualityHistoryKey(node)), now) })); const qualityMs = Date.now() - qualityStart;
    if (probeMode === "mihomo") await recordQualityResults(probed.filter((n) => n.probeState === "checked"));
    relayLogger.info("scan", "Quality stage complete", { durationMs: qualityMs });

    const sourcesOut: SourceScan[] = fetched.map((f) => { const mine = probed.filter((n) => (n.sourceIds ?? [n.sourceId]).includes(f.source.id)); const alive = mine.filter((n) => n.alive); const latencies = alive.map((n) => n.latency).filter((x): x is number => x !== null); return { id: f.source.id, name: f.source.name, url: f.source.url, ok: f.error === null, error: f.error, parsed: f.nodes.length, unique: new Set(f.nodes.map((n) => n.id)).size, probed: mine.length, alive: alive.length, bestLatency: latencies.length ? Math.min(...latencies) : null }; });
    const ranked = rankNodes(probed); const totalMs = Date.now() - started; const live = ranked.filter((n) => n.alive).length; const dead = ranked.filter((n) => n.probeState === "checked" && !n.alive).length;
    const metrics: ScanMetrics = { fetchMs: Math.max(fetchWallMs, fetched.reduce((sum, item) => sum + item.fetchMs, 0)), parseMs: fetched.reduce((sum, item) => sum + item.parseMs, 0), sampleMs, probeMs, geoIpMs, deepVerifyMs, qualityMs, totalMs, sampled: sampled.length, deepVerified: ranked.filter((node) => Object.keys(node.targetResults ?? {}).length > 0).length, targetChecks: countTargetChecks(ranked), mihomoLoaded, mihomoDelayReceived, unknown, deduplicated, mihomoRounds };
    relayLogger.info("scan", "Scan finished", { durationMs: totalMs, fetchMs: metrics.fetchMs, parseMs: metrics.parseMs, sampleMs, probeMs, geoIpMs, deepVerifyMs, qualityMs, fetchSources: fetched.length, parsed: parsedNodes.length, sample: sampled.length, probe: mihomoDelayReceived, geoip: ranked.length, deep: metrics.deepVerified, quality: ranked.length, live, dead, unknown, mihomoRounds });
    return { scannedAt: Date.now(), durationMs: totalMs, sources: sourcesOut, nodes: ranked, parsedTotal: parsedNodes.length, uniqueTotal, probeMode, testUrl, probeNote, metrics };
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) relayLogger.error("scan", "Scan failed", { durationMs: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
