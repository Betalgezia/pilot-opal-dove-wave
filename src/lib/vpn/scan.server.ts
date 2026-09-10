import { DEFAULT_TEST_URL } from "./constants";
import { fetchSourceText } from "./fetch-source.server";
import { canRunMihomo } from "./mihomo-bin.server";
import { enrichNodesWithGeoIp } from "./geoip.server";
import { endpointKey, parseSubscription } from "./parse";
import { probeNodes } from "./probe.server";
import { sampleForProbe } from "./sample";
import { getQualityHistory, recordQualityResults } from "./quality-history.server";
import { pickDeepVerification, QUALITY_TARGETS, rankNodes, scoreNode } from "./quality";
import { pickExportNodes } from "./select";
import { beginScan, endScan, getActiveScanSignal } from "./scan-control.server";
import type { ParsedNode, ProbeMode, ProbedNode, ScanMetrics, ScanResult, SourceDef, SourceScan } from "./types";

export { pickExportNodes };

export interface ScanOpts {
  perSource?: number;
  globalCap?: number;
  timeoutMs?: number;
  real?: boolean;
  testUrl?: string;
  force?: boolean;
}

const SCAN_CACHE_MS = 180_000;
const DEEP_VERIFY_MAX = 80;
const scanCache = new Map<string, { at: number; result: ScanResult }>();
const scanLocks = new Map<string, Promise<ScanResult>>();

function scanKey(sources: SourceDef[], opts: ScanOpts): string {
  return JSON.stringify({
    sources: sources
      .filter((s) => s.enabled)
      .map((s) => ({ id: s.id, name: s.name, url: s.url }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    perSource: opts.perSource ?? 16,
    globalCap: opts.globalCap ?? 64,
    timeoutMs: opts.timeoutMs ?? 2200,
    real: opts.real !== false,
    testUrl: opts.testUrl || DEFAULT_TEST_URL,
  });
}

function throwIfCancelled(): void {
  if (getActiveScanSignal()?.aborted) {
    throw new DOMException("Сканирование остановлено", "AbortError");
  }
}

function countTargetChecks(nodes: ProbedNode[]): number {
  return nodes.reduce((sum, node) => sum + Object.keys(node.targetResults ?? {}).length, 0);
}

function mergeProbeNote(base: string | null, extra: string): string {
  return base ? `${base} · ${extra}` : extra;
}

export async function runScanCached(
  sources: SourceDef[],
  opts: ScanOpts = {},
): Promise<ScanResult> {
  const key = scanKey(sources, opts);
  const now = Date.now();
  const cached = scanCache.get(key);
  if (!opts.force && cached && now - cached.at < SCAN_CACHE_MS) return cached.result;

  const pending = scanLocks.get(key);
  if (pending) return pending;

  const controller = beginScan();
  const promise = runScan(sources, opts).then((result) => {
    scanCache.set(key, { at: Date.now(), result });
    return result;
  });
  scanLocks.set(key, promise);
  try {
    return await promise;
  } finally {
    endScan(controller);
    if (scanLocks.get(key) === promise) scanLocks.delete(key);
  }
}

export async function runScan(sources: SourceDef[], opts?: ScanOpts): Promise<ScanResult> {
  const perSource = opts?.perSource ?? 16;
  const globalCap = opts?.globalCap ?? 64;
  const timeoutMs = opts?.timeoutMs ?? 2200;
  const wantReal = opts?.real !== false;
  const started = Date.now();
  throwIfCancelled();

  const history = await getQualityHistory();
  const enabled = sources.filter((s) => s.enabled);
  const fetchedStart = Date.now();
  const fetched = await Promise.all(
    enabled.map(async (source) => {
      const fetchStart = Date.now();
      try {
        const text = await fetchSourceText(source.url);
        const fetchMs = Date.now() - fetchStart;
        throwIfCancelled();
        const parseStart = Date.now();
        const nodes = parseSubscription(text, source.id, source.name);
        return {
          source,
          nodes,
          error: null as string | null,
          fetchMs,
          parseMs: Date.now() - parseStart,
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        const message = err instanceof Error ? err.message : "fetch failed";
        return {
          source,
          nodes: [] as ParsedNode[],
          error: message,
          fetchMs: Date.now() - fetchStart,
          parseMs: 0,
        };
      }
    }),
  );
  const fetchWallMs = Date.now() - fetchedStart;
  throwIfCancelled();
  const allNodes = fetched.flatMap((f) => f.nodes);
  const uniqueTotal = new Set(allNodes.map(endpointKey)).size;

  const sampleStart = Date.now();
  const sampled = sampleForProbe(allNodes, perSource, globalCap, history, started);
  const sampleMs = Date.now() - sampleStart;

  let probeMode: ProbeMode = "tcp";
  let testUrl: string | null = null;
  let probeNote: string | null = null;
  let probed: ProbedNode[];
  const probeStart = Date.now();

  if (wantReal && canRunMihomo()) {
    try {
      const { probeNodesMihomo } = await import("./mihomo-probe.server");
      const real = await probeNodesMihomo(sampled, opts?.testUrl || DEFAULT_TEST_URL);
      probed = real.nodes;
      probeMode = "mihomo";
      testUrl = real.testUrl;
      probeNote = real.note;
    } catch (err) {
      throwIfCancelled();
      probed = await probeNodes(sampled, timeoutMs);
      probeMode = "tcp";
      probeNote = err instanceof Error
        ? `Настоящая проверка не стартовала: ${err.message}. Осталась проверка порта.`
        : "Настоящая проверка не стартовала. Осталась проверка порта.";
    }
  } else {
    probed = await probeNodes(sampled, timeoutMs);
    if (wantReal) probeNote = "На этом хосте нельзя запустить ядро — проверка порта.";
  }
  const probeMs = Date.now() - probeStart;

  throwIfCancelled();
  const geoStart = Date.now();
  probed = await enrichNodesWithGeoIp(probed);
  const geoIpMs = Date.now() - geoStart;
  throwIfCancelled();

  const deepStart = Date.now();
  if (probeMode === "mihomo" && probed.some((node) => node.alive)) {
    try {
      const { verifyNodesMihomo } = await import("./mihomo-probe.server");
      const primaryUrl = testUrl || opts?.testUrl || DEFAULT_TEST_URL;
      const targetUrls = QUALITY_TARGETS
        .map((target) => target.url)
        .filter((url) => url !== primaryUrl)
        .slice(0, 2);
      const candidates = pickDeepVerification(probed, Math.min(DEEP_VERIFY_MAX, Math.max(24, Math.min(80, globalCap))));
      const targetResults = await verifyNodesMihomo(candidates, targetUrls);
      probed = probed.map((node) => {
        const results = targetResults.get(node.id);
        return results ? { ...node, targetResults: results } : node;
      });
    } catch (err) {
      probeNote = mergeProbeNote(
        probeNote,
        err instanceof Error ? `Дополнительная проверка ресурсов пропущена: ${err.message}` : "Дополнительная проверка ресурсов пропущена",
      );
    }
  }
  const deepVerifyMs = Date.now() - deepStart;
  throwIfCancelled();

  const qualityStart = Date.now();
  const now = Date.now();
  probed = probed.map((node) => ({ ...node, ...scoreNode(node, history.get(node.id), now) }));
  const qualityMs = Date.now() - qualityStart;
  await recordQualityResults(probed);

  const sourcesOut: SourceScan[] = fetched.map((f) => {
    const mine = probed.filter((n) => n.sourceId === f.source.id);
    const alive = mine.filter((n) => n.alive);
    const latencies = alive.map((n) => n.latency).filter((x): x is number => x !== null);
    return {
      id: f.source.id,
      name: f.source.name,
      url: f.source.url,
      ok: f.error === null,
      error: f.error,
      parsed: f.nodes.length,
      unique: new Set(f.nodes.map((n) => n.id)).size,
      probed: mine.length,
      alive: alive.length,
      bestLatency: latencies.length ? Math.min(...latencies) : null,
    };
  });

  const ranked = rankNodes(probed);
  const totalMs = Date.now() - started;
  const metrics: ScanMetrics = {
    fetchMs: Math.max(fetchWallMs, fetched.reduce((sum, item) => sum + item.fetchMs, 0)),
    parseMs: fetched.reduce((sum, item) => sum + item.parseMs, 0),
    sampleMs,
    probeMs,
    geoIpMs,
    deepVerifyMs,
    qualityMs,
    totalMs,
    sampled: sampled.length,
    deepVerified: ranked.filter((node) => Object.keys(node.targetResults ?? {}).length > 0).length,
    targetChecks: countTargetChecks(ranked),
  };

  return {
    scannedAt: Date.now(),
    durationMs: totalMs,
    sources: sourcesOut,
    nodes: ranked,
    parsedTotal: allNodes.length,
    uniqueTotal,
    probeMode,
    testUrl,
    probeNote,
    metrics,
  };
}
