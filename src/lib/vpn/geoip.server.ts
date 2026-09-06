import { promises as dns } from "node:dns";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TEST_URL } from "./constants";

const DISK_CACHE_PATH = path.join(process.cwd(), ".relay-cache", "geoip.json");
const memoryByIp = new Map<string, string | null>();
let diskLoaded = false;

async function loadDiskCache(): Promise<void> {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const raw = await readFile(DISK_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [ip, country] of Object.entries(parsed)) {
      if (country === null || typeof country === "string") memoryByIp.set(ip, country as string | null);
    }
  } catch {
    /* cache is best effort */
  }
}

async function persistCache(entries: Record<string, string | null>): Promise<void> {
  try {
    await mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
    await writeFile(DISK_CACHE_PATH, JSON.stringify(entries), "utf8");
  } catch {
    /* read-only/serverless filesystem */
  }
}

function isIp(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || value.includes(":");
}

async function lookupOffline(ip: string): Promise<string | null> {
  await loadDiskCache();
  const cached = memoryByIp.get(ip);
  if (cached !== undefined || memoryByIp.has(ip)) return cached ?? null;

  try {
    const mod = await import("geoip-country");
    const result = mod.default?.lookup?.(ip) ?? mod.lookup?.(ip);
    const country = typeof result?.country === "string" ? result.country.toUpperCase() : null;
    memoryByIp.set(ip, country);
    const snapshot: Record<string, string | null> = {};
    for (const [key, value] of memoryByIp) snapshot[key] = value;
    await persistCache(snapshot);
    return country;
  } catch {
    return null;
  }
}

async function resolveIp(host: string): Promise<string | null> {
  const normalized = host.trim().replace(/^\[|\]$/g, "");
  if (!normalized) return null;
  if (isIp(normalized)) return normalized;
  try {
    const records = await dns.lookup(normalized, { all: true, verbatim: true });
    return records[0]?.address ?? null;
  } catch {
    return null;
  }
}

export async function enrichNodesWithGeoIp<T extends { host: string; country: string | null; serverIp?: string }>(
  nodes: T[],
): Promise<T[]> {
  if (nodes.length === 0) return nodes;
  await loadDiskCache();

  const targets = new Map<string, Promise<string | null>>();
  for (const node of nodes) {
    const host = node.host.trim();
    const key = host.toLowerCase();
    if (!targets.has(key)) {
      targets.set(key, (async () => {
        const ip = await resolveIp(host);
        if (!ip) return null;
        return `${ip}|${await lookupOffline(ip)}`;
      })().then((value) => value ? value.split("|", 2)[0] + "|" + (value.split("|", 2)[1] ?? "") : null));
    }
  }

  const output: T[] = [];
  const concurrency = 32;
  const entries = [...nodes.entries()];
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);
    const values = await Promise.all(chunk.map(async ([, node]) => ({ node, value: await targets.get(node.host.trim().toLowerCase())! })));
    for (const { node, value } of values) {
      const [ip, country] = value?.split("|", 2) ?? [];
      output.push({
        ...node,
        serverIp: ip || node.serverIp,
        country: country || node.country,
      });
    }
  }
  return output;
}

void DEFAULT_TEST_URL;
