import type { ProbedNode, ScanResult, SelectStrategy } from "./types";

export function pickActive(
  result: ScanResult,
  strategy: SelectStrategy,
  previousId?: string | null,
): ProbedNode | null {
  const alive = result.nodes.filter((n) => n.alive);
  if (alive.length === 0) return null;

  if (strategy === "fastest") {
    return [...alive].sort(
      (a, b) => (a.latency ?? 99999) - (b.latency ?? 99999),
    )[0];
  }

  if (strategy === "fallback") {
    for (const source of result.sources) {
      if (!source.ok || source.alive === 0) continue;
      const hit = alive.find((n) => n.sourceId === source.id);
      if (hit) return hit;
    }
    return alive[0];
  }

  const idx = previousId ? alive.findIndex((n) => n.id === previousId) : -1;
  return alive[(idx + 1) % alive.length];
}

export function pickExportNodes(result: ScanResult, limit: number): ProbedNode[] {
  const alive = result.nodes.filter((n) => n.alive);
  const pool = alive.length ? alive : result.nodes;
  const bySource = new Map<string, ProbedNode[]>();
  for (const n of pool) {
    const list = bySource.get(n.sourceId) ?? [];
    list.push(n);
    bySource.set(n.sourceId, list);
  }
  const out: ProbedNode[] = [];
  const ids = [...bySource.keys()];
  let i = 0;
  while (out.length < limit) {
    let added = false;
    for (const id of ids) {
      const bucket = bySource.get(id);
      if (!bucket || i >= bucket.length) continue;
      out.push(bucket[i]);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
    i += 1;
  }
  return out;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms)} ms`;
}
