import { endpointKey, protocolRank } from "./parse";
import type { ParsedNode } from "./types";

export function sampleForProbe(
  nodes: ParsedNode[],
  perSource: number,
  globalCap: number,
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
    const unique = uniqueEndpoints(list);
    picked.push(...spreadSample(unique, perSource));
  }

  if (picked.length <= globalCap) return picked;

  const out: ParsedNode[] = [];
  const buckets = new Map<string, ParsedNode[]>();
  for (const n of picked) {
    const list = buckets.get(n.sourceId) ?? [];
    list.push(n);
    buckets.set(n.sourceId, list);
  }
  const ids = [...buckets.keys()];
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

function uniqueEndpoints(list: ParsedNode[]): ParsedNode[] {
  const seen = new Set<string>();
  const out: ParsedNode[] = [];
  const sorted = [...list].sort(
    (a, b) => protocolRank(a.protocol) - protocolRank(b.protocol),
  );
  for (const n of sorted) {
    const key = endpointKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function spreadSample(list: ParsedNode[], count: number): ParsedNode[] {
  if (count >= list.length) return list;

  const out: ParsedNode[] = [];
  const seen = new Set<number>();

  // Keep a useful priority slice, then spread the rest across the whole source.
  const priorityCount = Math.min(Math.ceil(count * 0.25), count);
  for (let i = 0; i < priorityCount; i += 1) {
    const index = Math.floor((i * list.length) / priorityCount);
    if (!seen.has(index)) {
      seen.add(index);
      out.push(list[index]);
    }
  }

  while (out.length < count) {
    const slot = out.length - priorityCount;
    const remaining = count - priorityCount;
    const index = Math.min(
      list.length - 1,
      Math.floor(((slot + 0.5) * list.length) / remaining),
    );
    if (!seen.has(index)) {
      seen.add(index);
      out.push(list[index]);
      continue;
    }

    let next = index + 1;
    while (next < list.length && seen.has(next)) next += 1;
    if (next >= list.length) break;
    seen.add(next);
    out.push(list[next]);
  }

  return out;
}
