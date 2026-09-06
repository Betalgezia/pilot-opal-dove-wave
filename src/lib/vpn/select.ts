import type { ProbedNode, ScanResult, SelectStrategy } from "./types";
import { EMPTY_FILTERS, filterSubscriptionNodes, type SubscriptionFilters } from "./subscription-filter";

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

export function pickExportNodes(
  result: ScanResult,
  limit: number,
  filters: SubscriptionFilters = EMPTY_FILTERS,
): ProbedNode[] {
  if (limit <= 0) return [];

  return [...filterSubscriptionNodes(result.nodes, filters)]
    .sort((a, b) => {
      const latency = (a.latency ?? 99999) - (b.latency ?? 99999);
      if (latency !== 0) return latency;
      return a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms)} ms`;
}
