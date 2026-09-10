import type { ProbedNode, ScanResult, SelectStrategy } from "./types";
import { EMPTY_FILTERS, filterSubscriptionNodes, type SubscriptionFilters } from "./subscription-filter";
import { rankNodes } from "./quality";

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
      const hit = rankNodes(alive.filter((n) => n.sourceId === source.id))[0];
      if (hit) return hit;
    }
    return rankNodes(alive)[0];
  }

  const ordered = rankNodes(alive);
  const idx = previousId ? ordered.findIndex((n) => n.id === previousId) : -1;
  return ordered[(idx + 1) % ordered.length];
}

export function pickExportNodes(
  result: ScanResult,
  limit: number,
  filters: SubscriptionFilters = EMPTY_FILTERS,
): ProbedNode[] {
  if (limit <= 0) return [];

  return rankNodes(filterSubscriptionNodes(result.nodes, filters))
    .slice(0, limit);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms)} ms`;
}
