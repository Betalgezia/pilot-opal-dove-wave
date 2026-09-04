import { endpointKey, protocolRank } from "./parse";
import type { ParsedNode } from "./types";

export function sampleForProbe(
  nodes: ParsedNode[],
  perSource: number,
  globalCap: number,
): ParsedNode[] {
  const bySource = new Map<string, ParsedNode[]>();
  for (const n of nodes) {
    const list = bySource.get(n.sourceId) ?? [];
    list.push(n);
    bySource.set(n.sourceId, list);
  }

  const picked: ParsedNode[] = [];
  for (const list of bySource.values()) {
    const unique = uniqueEndpoints(list);
    unique.sort((a, b) => {
      const portA = a.port === 443 ? 0 : 1;
      const portB = b.port === 443 ? 0 : 1;
      if (portA !== portB) return portA - portB;
      const pr = protocolRank(a.protocol) - protocolRank(b.protocol);
      if (pr !== 0) return pr;
      return a.host.localeCompare(b.host);
    });
    picked.push(...unique.slice(0, perSource));
  }

  if (picked.length <= globalCap) return picked;

  // Keep even mix across sources when trimming.
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
