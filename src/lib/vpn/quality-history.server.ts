import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProbedNode } from "./types";

export interface TargetHistory {
  checks: number;
  successes: number;
  lastAt: number;
}

export interface NodeQualityHistory {
  nodeId: string;
  samples: number;
  successes: number;
  failures: number;
  currentStreak: number;
  lastAliveAt: number | null;
  lastFailureAt: number | null;
  lastLatency: number | null;
  latencyEwma: number | null;
  lastSeenAt: number;
  country: string | null;
  protocol: ProbedNode["protocol"];
  sourceId: string;
  targets: Record<string, TargetHistory>;
}

const HISTORY_PATH = path.join(process.cwd(), ".relay-cache", "quality-history.json");
const MAX_ENTRIES = 50_000;
const memory = new Map<string, NodeQualityHistory>();
let loaded = false;
let persistTimer: NodeJS.Timeout | null = null;

function normalizeTargetHistory(value: unknown): Record<string, TargetHistory> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, TargetHistory> = {};
  for (const [url, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<TargetHistory>;
    if (typeof item.checks !== "number" || typeof item.successes !== "number") continue;
    out[url] = {
      checks: Math.max(0, Math.floor(item.checks)),
      successes: Math.max(0, Math.floor(item.successes)),
      lastAt: typeof item.lastAt === "number" ? item.lastAt : 0,
    };
  }
  return out;
}

function normalizeEntry(nodeId: string, value: unknown): NodeQualityHistory | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<NodeQualityHistory>;
  if (typeof item.samples !== "number" || typeof item.successes !== "number") return null;
  return {
    nodeId,
    samples: Math.max(0, Math.floor(item.samples)),
    successes: Math.max(0, Math.floor(item.successes)),
    failures: Math.max(0, Math.floor(item.failures ?? 0)),
    currentStreak: Math.max(0, Math.floor(item.currentStreak ?? 0)),
    lastAliveAt: typeof item.lastAliveAt === "number" ? item.lastAliveAt : null,
    lastFailureAt: typeof item.lastFailureAt === "number" ? item.lastFailureAt : null,
    lastLatency: typeof item.lastLatency === "number" ? item.lastLatency : null,
    latencyEwma: typeof item.latencyEwma === "number" ? item.latencyEwma : null,
    lastSeenAt: typeof item.lastSeenAt === "number" ? item.lastSeenAt : 0,
    country: typeof item.country === "string" ? item.country : null,
    protocol: item.protocol ?? "vless",
    sourceId: typeof item.sourceId === "string" ? item.sourceId : "",
    targets: normalizeTargetHistory(item.targets),
  };
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(await readFile(HISTORY_PATH, "utf8")) as Record<string, unknown>;
    for (const [nodeId, value] of Object.entries(raw)) {
      const entry = normalizeEntry(nodeId, value);
      if (entry) memory.set(nodeId, entry);
    }
  } catch {
    /* best effort */
  }
}

function queuePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void (async () => {
      try {
        await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
        const snapshot: Record<string, NodeQualityHistory> = {};
        for (const [id, entry] of memory) snapshot[id] = entry;
        await writeFile(HISTORY_PATH, JSON.stringify(snapshot), "utf8");
      } catch {
        /* read-only/serverless filesystem */
      }
    })();
  }, 400);
  persistTimer.unref();
}

export async function getQualityHistory(): Promise<Map<string, NodeQualityHistory>> {
  await load();
  return new Map(memory);
}

export async function recordQualityResults(nodes: ProbedNode[]): Promise<void> {
  if (nodes.length === 0) return;
  await load();
  const now = Date.now();
  for (const node of nodes) {
    const previous = memory.get(node.id);
    const targetResults = node.targetResults ?? {};
    const entry: NodeQualityHistory = previous ?? {
      nodeId: node.id,
      samples: 0,
      successes: 0,
      failures: 0,
      currentStreak: 0,
      lastAliveAt: null,
      lastFailureAt: null,
      lastLatency: null,
      latencyEwma: null,
      lastSeenAt: now,
      country: node.country,
      protocol: node.protocol,
      sourceId: node.sourceId,
      targets: {},
    };

    entry.samples += 1;
    entry.lastSeenAt = now;
    entry.country = node.country ?? entry.country;
    entry.protocol = node.protocol;
    entry.sourceId = node.sourceId;
    if (node.alive) {
      entry.successes += 1;
      entry.currentStreak += 1;
      entry.lastAliveAt = now;
      entry.lastLatency = node.latency;
      if (node.latency !== null) {
        entry.latencyEwma = entry.latencyEwma === null
          ? node.latency
          : entry.latencyEwma * 0.7 + node.latency * 0.3;
      }
    } else {
      entry.failures += 1;
      entry.currentStreak = 0;
      entry.lastFailureAt = now;
    }

    for (const [url, success] of Object.entries(targetResults)) {
      const target = entry.targets[url] ?? { checks: 0, successes: 0, lastAt: 0 };
      target.checks += 1;
      if (success) target.successes += 1;
      target.lastAt = now;
      entry.targets[url] = target;
    }
    memory.set(node.id, entry);
  }

  if (memory.size > MAX_ENTRIES) {
    const stale = [...memory.values()]
      .sort((a, b) => a.lastSeenAt - b.lastSeenAt)
      .slice(0, memory.size - MAX_ENTRIES);
    for (const item of stale) memory.delete(item.nodeId);
  }
  queuePersist();
}
