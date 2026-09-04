import { fetchSourceText } from "./fetch-source.server";
import { parseSubscription, endpointKey } from "./parse";
import { probeNodes } from "./probe.server";
import { sampleForProbe } from "./sample";
import { pickExportNodes } from "./select";
import type { ParsedNode, ScanResult, SourceDef, SourceScan } from "./types";

export { pickExportNodes };

export async function runScan(
  sources: SourceDef[],
  opts?: { perSource?: number; globalCap?: number; timeoutMs?: number },
): Promise<ScanResult> {
  const perSource = opts?.perSource ?? 16;
  const globalCap = opts?.globalCap ?? 64;
  const timeoutMs = opts?.timeoutMs ?? 2200;
  const started = Date.now();

  const enabled = sources.filter((s) => s.enabled);
  const fetched = await Promise.all(
    enabled.map(async (source) => {
      try {
        const text = await fetchSourceText(source.url);
        const nodes = parseSubscription(text, source.id, source.name);
        return { source, nodes, error: null as string | null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "fetch failed";
        return { source, nodes: [] as ParsedNode[], error: message };
      }
    }),
  );

  const allNodes = fetched.flatMap((f) => f.nodes);
  const uniqueTotal = new Set(allNodes.map(endpointKey)).size;
  const sampled = sampleForProbe(allNodes, perSource, globalCap);
  const probed = await probeNodes(sampled, timeoutMs);

  const sourcesOut: SourceScan[] = fetched.map((f) => {
    const mine = probed.filter((n) => n.sourceId === f.source.id);
    const alive = mine.filter((n) => n.alive);
    const latencies = alive
      .map((n) => n.latency)
      .filter((x): x is number => x !== null);
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
  };
}
