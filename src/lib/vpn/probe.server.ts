import net from "node:net";
import { endpointKey } from "./parse";
import type { ParsedNode, ProbedNode } from "./types";

const cache = new Map<string, { at: number; latency: number | null }>();
const CACHE_MS = 90_000;

export function tcpPing(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const finish = (ms: number | null) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ms);
    };

    const socket = net.connect({ host, port, family: 0 });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(Date.now() - start));
    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function probeNodes(
  nodes: ParsedNode[],
  timeoutMs: number,
): Promise<ProbedNode[]> {
  const now = Date.now();
  return mapPool(nodes, 18, async (node) => {
    const key = endpointKey(node);
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS) {
      return { ...node, latency: hit.latency, alive: hit.latency !== null };
    }
    const latency = await tcpPing(node.host, node.port, timeoutMs);
    cache.set(key, { at: Date.now(), latency });
    return { ...node, latency, alive: latency !== null };
  });
}
