import { endpointKey, protocolRank } from "./parse";
import type { NodeQualityHistory } from "./quality-history.server";
import type { ParsedNode } from "./types";

export function sampleForProbe(
  nodes: ParsedNode[],
  perSource: number,
  globalCap: number,
  history = new Map<string, NodeQualityHistory>(),
  seed = Date.now(),
): ParsedNode[] {
  if (perSource <= 0 || globalCap <= 0) return [];

  const bySource = new Map<string, ParsedNode[]>();
  for (const n of nodes) {
    const list = bySource.get(n.sourceId) ?? [];
    list.push(n);
    bySource.set(n.sourceId, list);
  }

  const picked: ParsedNode[] = [];
  for (const list of bySource.values()) {
    const unique = uniqueNodes(list);
    const sourceFactor = sourceSamplingFactor(unique, history);
    const targetCount = Math.min(
      unique.length,
      Math.max(4, Math.round(perSource * sourceFactor)),
    );
    picked.push(...smartSample(unique, targetCount, history, seed));
  }

  if (picked.length <= globalCap) return picked;
  return roundRobinSources(picked, globalCap);
}

function uniqueNodes(list: ParsedNode[]): ParsedNode[] {
  const seen = new Set<string>();
  const out: ParsedNode[] = [];
  const sorted = [...list].sort((a, b) => protocolRank(a.protocol) - protocolRank(b.protocol));
  for (const n of sorted) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

function sourceSamplingFactor(nodes: ParsedNode[], history: Map<string, NodeQualityHistory>): number {
  const known = nodes.map((n) => history.get(n.id)).filter((x): x is NodeQualityHistory => Boolean(x && x.samples > 0));
  if (known.length < 8) return 1;
  const reliability = known.reduce((sum, h) => sum + h.successes / h.samples, 0) / known.length;
  // Difficult sources get more exploration; reliable sources can lean on their history.
  return Math.max(0.75, Math.min(1.5, 1.5 - reliability * 0.75));
}

function recencyWeight(history: NodeQualityHistory | undefined, seed: number): number {
  if (!history || history.samples === 0) return 0;
  const age = history.lastSeenAt ? Math.max(0, Date.now() - history.lastSeenAt) : Number.POSITIVE_INFINITY;
  const recency = age < 120_000 ? 1 : age < 900_000 ? 0.7 : age < 3_600_000 ? 0.35 : 0;
  const exploration = hash(`${history.nodeId}|${Math.floor(seed / 600_000)}`) / 0xffffffff;
  return recency * 0.75 + exploration * 0.25;
}

function priority(node: ParsedNode, history: Map<string, NodeQualityHistory>, seed: number): number {
  const h = history.get(node.id);
  if (!h || h.samples === 0) return 0.45 + (hash(`${node.id}|${Math.floor(seed / 600_000)}`) / 0xffffffff) * 0.1;
  const reliability = h.successes / Math.max(1, h.samples);
  const latency = h.latencyEwma === null ? 0.4 : 1 - Math.min(1, h.latencyEwma / 1200);
  const streak = Math.min(1, h.currentStreak / 6);
  return reliability * 0.5 + latency * 0.25 + streak * 0.15 + recencyWeight(h, seed) * 0.1;
}

function diversityKey(node: ParsedNode): string {
  const country = (node.country ?? "XX").toUpperCase();
  const raw = node.serverIp || node.host;
  const ip = raw.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) return `${country}|${ip[1]}.${ip[2]}.${ip[3]}`;
  const host = raw.toLowerCase().split(".").slice(-2).join(".");
  return `${country}|${host}`;
}

function smartSample(
  list: ParsedNode[],
  count: number,
  history: Map<string, NodeQualityHistory>,
  seed: number,
): ParsedNode[] {
  if (count >= list.length) return list;

  const ranked = [...list].sort((a, b) => priority(b, history, seed) - priority(a, history, seed));
  const out: ParsedNode[] = [];
  const seen = new Set<string>();

  const take = (node: ParsedNode) => {
    if (out.length >= count || seen.has(node.id)) return;
    seen.add(node.id);
    out.push(node);
  };

  // Preserve the historically strong core first.
  const eliteCount = Math.min(count, Math.max(1, Math.ceil(count * 0.4)));
  for (const node of ranked.slice(0, eliteCount)) take(node);

  // Then deliberately spread across countries and /24-like buckets.
  const buckets = new Map<string, ParsedNode[]>();
  for (const node of list) {
    const key = diversityKey(node);
    const bucket = buckets.get(key) ?? [];
    bucket.push(node);
    buckets.set(key, bucket);
  }
  const bucketQueue = [...buckets.values()].sort((a, b) => {
    const pa = priority(a[0], history, seed);
    const pb = priority(b[0], history, seed);
    return pb - pa;
  });
  let round = 0;
  while (out.length < count && bucketQueue.length) {
    let added = false;
    for (const bucket of bucketQueue) {
      const candidate = [...bucket].sort((a, b) => priority(b, history, seed) - priority(a, history, seed))[round];
      if (candidate) {
        take(candidate);
        added = true;
        if (out.length >= count) break;
      }
    }
    if (!added) break;
    round += 1;
  }

  // Final fill: even spread over the source, keeping cold-start exploration alive.
  if (out.length < count) {
    for (let i = 0; i < list.length && out.length < count; i += 1) {
      const index = Math.floor((i * list.length) / Math.max(1, count));
      take(list[Math.min(list.length - 1, index)]);
    }
  }
  return out.slice(0, count);
}

function roundRobinSources(nodes: ParsedNode[], globalCap: number): ParsedNode[] {
  const buckets = new Map<string, ParsedNode[]>();
  for (const n of nodes) {
    const list = buckets.get(n.sourceId) ?? [];
    list.push(n);
    buckets.set(n.sourceId, list);
  }
  const ids = [...buckets.keys()];
  const out: ParsedNode[] = [];
  let i = 0;
  while (out.length < globalCap) {
    let added = false;
    for (const id of ids) {
      const bucket = buckets.get(id);
      if (!bucket || i >= bucket.length) continue;
      out.push(bucket[i]);
      added = true;
      if (out.length >= globalCap) break;
    }
    if (!added) break;
    i += 1;
  }
  return out;
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export { endpointKey };
