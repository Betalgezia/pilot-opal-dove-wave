import { promises as dns } from "node:dns";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DISK_CACHE_PATH = path.join(process.cwd(), ".relay-cache", "geoip.json");
const memoryByIp = new Map<string, string | null>();
let diskLoaded = false;
let persistTimer: NodeJS.Timeout | null = null;

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
    /* best effort */
  }
}

function queuePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void (async () => {
      try {
        await mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
        const snapshot: Record<string, string | null> = {};
        for (const [ip, country] of memoryByIp) snapshot[ip] = country;
        await writeFile(DISK_CACHE_PATH, JSON.stringify(snapshot), "utf8");
      } catch {
        /* read-only/serverless filesystem */
      }
    })();
  }, 500);
  persistTimer.unref();
}

function isIp(value: string): boolean {
  if (value.includes(":")) return true;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    const n = Number(part);
    return /^\d+$/.test(part) && n >= 0 && n <= 255;
  });
}

async function lookupOffline(ip: string): Promise<string | null> {
  await loadDiskCache();
  if (memoryByIp.has(ip)) return memoryByIp.get(ip) ?? null;

  try {
    const mod = await import("geoip-country");
    const result = mod.default?.lookup?.(ip) ?? mod.lookup?.(ip);
    const country = typeof result?.country === "string" ? result.country.toUpperCase() : null;
    memoryByIp.set(ip, country);
    queuePersist();
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

async function enrichOne<T extends { host: string; country: string | null; serverIp?: string }>(node: T): Promise<T> {
  const ip = await resolveIp(node.host);
  if (!ip) return node;
  const geoCountry = await lookupOffline(ip);
  return { ...node, serverIp: ip, country: geoCountry ?? node.country };
}

export async function enrichNodesWithGeoIp<T extends { host: string; country: string | null; serverIp?: string }>(nodes: T[]): Promise<T[]> {
  if (nodes.length === 0) return nodes;
  const concurrency = 32;
  const output: T[] = [];
  for (let i = 0; i < nodes.length; i += concurrency) {
    output.push(...(await Promise.all(nodes.slice(i, i + concurrency).map(enrichOne))));
  }
  return output;
}
