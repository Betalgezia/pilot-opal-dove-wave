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
import { beginScan, endScan, failScanProgress, finishScanProgress, getActiveScanSignal, updateScanProgress } from "./scan-control.server";
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
  const key = scanKey(sources, opts); const now = Date.now(); const cached = scanCache.get(key); if (!opts.force && cached && now - cached.at < SCAN_CACHE_MS) return cached.result;
  const pending = scanLocks.get(key); if (pending) return pending;
  const controller = beginScan();
  relayLogger.info("scan", "Scan started", { sourceCount: sources.filter((s) => s.enabled).length, perSource: opts.perSource ?? 16, globalCap: opts.globalCap ?? 64, real: opts.real !== false, testUrl: opts.testUrl || DEFAULT_TEST_URL });
  const promise = runScan(sources, opts).then((result) => { scanCache.set(key, { at: Date.now(), result }); finishScanProgress(`Сканирование завершено · ${result.nodes.filter((n) => n.alive).length} живых`); relayLogger.info("scan", "Scan finished", { durationMs: result.durationMs, parsed: result.parsedTotal, unique: result.uniqueTotal, sampled: result.metrics?.sampled ?? 0, live: result.nodes.filter((n) => n.alive).length, dead: result.nodes.filter((n) => n.probeState === "checked" && !n.alive).length, unknown: result.metrics?.unknown ?? 0, metrics: result.metrics }); return result; }).catch((err) => { failScanProgress(err instanceof Error ? err.message : "Сканирование завершилось с ошибкой"); relayLogger.error("scan", "Scan failed", { error: err instanceof Error ? err.message : String(err) }); throw err; });
  scanLocks.set(key, promise);
  try { return await promise; } finally { endScan(controller); if (scanLocks.get(key) === promise) scanLocks.delete(key); }
}

export async function runScan(sources: SourceDef[], opts?: ScanOpts): Promise<ScanResult> {
  const perSource = opts?.perSource ?? 16; const globalCap = opts?.globalCap ?? 64; const timeoutMs = opts?.timeoutMs ?? 2200; const wantReal = opts?.real !== false; const started = Date.now(); throwIfCancelled();
  const history = await getQualityHistory(); const enabled = sources.filter((s) => s.enabled); updateScanProgress("fetch", 5, `Получение ${enabled.length} источников`); const fetchedStart = Date.now();
  const fetched = await Promise.all(enabled.map(async (source) => { const fetchStart = Date.now(); try { const text = await fetchSourceText(source.url); const fetchMs = Date.now() - fetchStart; throwIfCancelled(); relayLogger.info("fetch", "Source fetched", { sourceId: source.id, sourceName: source.name, durationMs: fetchMs, bytes: Buffer.byteLength(text, "utf8") }); updateScanProgress("parse", 18, `Разбор ${source.name}`); const parseStart = Date.now(); const nodes = parseSubscription(text, source.id, source.name); const parseMs = Date.now() - parseStart; relayLogger.info("parse", "Source parsed", { sourceId: source.id, sourceName: source.name, nodes: nodes.length, durationMs: parseMs }); return { source, nodes, error: null as string | null, fetchMs, parseMs }; } catch (err) { if (err instanceof DOMException && err.name === "AbortError") throw err; const error = err instanceof Error ? err.message : "fetch failed"; relayLogger.error("fetch", "Source fetch failed", { sourceId: source.id, sourceName: source.name, error, durationMs: Date.now() - fetchStart }); return { source, nodes: [] as ParsedNode[], error, fetchMs: Date.now() - fetchStart, parseMs: 0 }; } }));
  const fetchWallMs = Date.now() - fetchedStart; throwIfCancelled();
  const parsedNodes = fetched.flatMap((f) => f.nodes); const allNodes = mergeNodesByIdentity(parsedNodes); const uniqueTotal = allNodes.length; const deduplicated = Math.max(0, parsedNodes.length - allNodes.length);
  updateScanProgress("sample", 32, `Отбор узлов для проверки · ${allNodes.length}`); const sampleStart = Date.now(); const sampled = sampleForProbe(allNodes, perSource, globalCap, history, started); const sampleMs = Date.now() - sampleStart; relayLogger.info("scan", "Sample ready", { total: allNodes.length, sampled: sampled.length, durationMs: sampleMs });

  let probeMode: ProbeMode = wantReal ? "mihomo" : "tcp"; let testUrl: string | null = wantReal ? (opts?.testUrl || DEFAULT_TEST_URL) : null; let probeNote: string | null = null; let probed: ProbedNode[]; let mihomoLoaded = 0; let mihomoDelayReceived = 0; let unknown = 0; let mihomoRounds = 0;
  const probeStart = Date.now(); updateScanProgress("probe", 40, wantReal ? `Проверка через mihomo · ${sampled.length} узлов` : `Проверка TCP · ${sampled.length} узлов`);
  if (wantReal) {
    if (!canRunMihomo()) { probed = unknownNodes(sampled); unknown = probed.length; probeNote = "Ядро mihomo недоступно: результаты проверки неизвестны; TCP не используется как замена."; relayLogger.warn("mihomo", "Mihomo binary unavailable", { unknown }); }
    else { try { const { probeNodesMihomo } = await import("./mihomo-probe.server"); const real = await probeNodesMihomo(sampled, opts?.testUrl || DEFAULT_TEST_URL); probed = real.nodes; testUrl = real.testUrl; probeNote = real.note; mihomoLoaded = real.metrics.mihomoLoaded; mihomoDelayReceived = real.metrics.mihomoDelayReceived; unknown = real.metrics.unknown; mihomoRounds = real.metrics.rounds; } catch (err) { probed = unknownNodes(sampled); unknown = probed.length; probeNote = `Проверка mihomo не завершилась: ${err instanceof Error ? err.message : "неизвестная ошибка"}. Узлы отмечены как неизвестные; TCP не используется как замена.`; relayLogger.error("mihomo", "Probe failed", { error: err instanceof Error ? err.message : String(err), unknown }); } }
  } else { probed = await probeNodes(sampled, timeoutMs); unknown = probed.filter((n) => n.probeState === "unknown").length; probeNote = "Режим без mihomo: проверяется только TCP-порт, это не подтверждение работоспособности VPN."; }
  const probeMs = Date.now() - probeStart; relayLogger.info("scan", "Probe finished", { durationMs: probeMs, sampled: sampled.length, mihomoLoaded, mihomoDelayReceived, unknown }); throwIfCancelled();
  updateScanProgress("geoip", 72, "Обогащение геоданными"); const geoStart = Date.now(); probed = await enrichNodesWithGeoIp(probed); const geoIpMs = Date.now() - geoStart; throwIfCancelled();

  const deepStart = Date.now(); updateScanProgress("deep", 82, "Дополнительная проверка живых узлов"); if (probeMode === "mihomo" && probed.some((node) => node.alive)) { try { const { verifyNodesMihomo } = await import("./mihomo-probe.server"); const primaryUrl = testUrl || opts?.testUrl || DEFAULT_TEST_URL; const targetUrls = QUALITY_TARGETS.map((target) => target.url).filter((url) => url !== primaryUrl).slice(0, 2); const candidates = pickDeepVerification(probed, Math.min(DEEP_VERIFY_MAX, Math.max(24, Math.min(80, globalCap)))); const targetResults = await verifyNodesMihomo(candidates, targetUrls); probed = probed.map((node) => { const results = targetResults.get(node.id); return results ? { ...node, targetResults: results } : node; }); } catch (err) { probeNote = mergeProbeNote(probeNote, err instanceof Error ? `Дополнительная проверка ресурсов пропущена: ${err.message}` : "Дополнительная проверка ресурсов пропущена"); relayLogger.warn("mihomo", "Deep verification partially failed", { error: err instanceof Error ? err.message : String(err) }); } }
  const deepVerifyMs = Date.now() - deepStart; throwIfCancelled();
  updateScanProgress("quality", 92, "Расчёт качества и ранжирование"); const qualityStart = Date.now(); const now = Date.now(); probed = probed.map((node) => ({ ...node, ...scoreNode(node, history.get(qualityHistoryKey(node)), now) })); const qualityMs = Date.now() - qualityStart;
  if (probeMode === "mihomo") await recordQualityResults(probed.filter((n) => n.probeState === "checked"));

  const sourcesOut: SourceScan[] = fetched.map((f) => { const mine = probed.filter((n) => (n.sourceIds ?? [n.sourceId]).includes(f.source.id)); const alive = mine.filter((n) => n.alive); const latencies = alive.map((n) => n.latency).filter((x): x is number => x !== null); return { id: f.source.id, name: f.source.name, url: f.source.url, ok: f.error === null, error: f.error, parsed: f.nodes.length, unique: new Set(f.nodes.map((n) => n.id)).size, probed: mine.length, alive: alive.length, bestLatency: latencies.length ? Math.min(...latencies) : null }; });
  const ranked = rankNodes(probed); const totalMs = Date.now() - started; const metrics: ScanMetrics = { fetchMs: Math.max(fetchWallMs, fetched.reduce((sum, item) => sum + item.fetchMs, 0)), parseMs: fetched.reduce((sum, item) => sum + item.parseMs, 0), sampleMs, probeMs, geoIpMs, deepVerifyMs, qualityMs, totalMs, sampled: sampled.length, deepVerified: ranked.filter((node) => Object.keys(node.targetResults ?? {}).length > 0).length, targetChecks: countTargetChecks(ranked), mihomoLoaded, mihomoDelayReceived, unknown, deduplicated, mihomoRounds };
  return { scannedAt: Date.now(), durationMs: totalMs, sources: sourcesOut, nodes: ranked, parsedTotal: parsedNodes.length, uniqueTotal, probeMode, testUrl, probeNote, metrics };
}
