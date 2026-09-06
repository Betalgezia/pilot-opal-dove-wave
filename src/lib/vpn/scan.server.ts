import { DEFAULT_TEST_URL } from "./constants";
import { fetchSourceText } from "./fetch-source.server";
import { canRunMihomo } from "./mihomo-bin.server";
import { enrichNodesWithGeoIp } from "./geoip.server";
import { parseSubscription, endpointKey } from "./parse";
import { probeNodes } from "./probe.server";
import { sampleForProbe } from "./sample";
import { pickExportNodes } from "./select";
import { beginScan, endScan, getActiveScanSignal } from "./scan-control.server";
import type { ParsedNode, ProbeMode, ProbedNode, ScanResult, SourceDef, SourceScan } from "./types";

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

  const enabled = sources.filter((s) => s.enabled);
  const fetched = await Promise.all(
    enabled.map(async (source) => {
      try {
        const text = await fetchSourceText(source.url);
        throwIfCancelled();
        const nodes = parseSubscription(text, source.id, source.name);
        return { source, nodes, error: null as string | null };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        const message = err instanceof Error ? err.message : "fetch failed";
        return { source, nodes: [] as ParsedNode[], error: message };
      }
    }),
  );

  throwIfCancelled();
  const allNodes = fetched.flatMap((f) => f.nodes);
  const uniqueTotal = new Set(allNodes.map(endpointKey)).size;
  const sampled = sampleForProbe(allNodes, perSource, globalCap);

  let probeMode: ProbeMode = "tcp";
  let testUrl: string | null = null;
  let probeNote: string | null = null;
  let probed: ProbedNode[];

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

  throwIfCancelled();
  probed = await enrichNodesWithGeoIp(probed);
  throwIfCancelled();

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
      unique: new Set(f.nodes.map(endpointKey)).size,
      probed: mine.length,
      alive: alive.length,
      bestLatency: latencies.length ? Math.min(...latencies) : null,
    };
  });

  probed.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (a.latency ?? 99999) - (b.latency ?? 99999);
  });

  return {
    scannedAt: Date.now(),
    durationMs: Date.now() - started,
    sources: sourcesOut,
    nodes: probed,
    parsedTotal: allNodes.length,
    uniqueTotal,
    probeMode,
    testUrl,
    probeNote,
  };
}
