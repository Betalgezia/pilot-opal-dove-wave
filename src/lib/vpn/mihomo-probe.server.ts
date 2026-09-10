import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { abortError } from "./abort";
import { DEFAULT_TEST_URL, FALLBACK_TEST_URL, SCAN_ALIVE_TARGET, SCAN_BATCH_SIZE } from "./constants";
import { ensureMihomoBinary, canRunMihomo } from "./mihomo-bin.server";
import { clashProxyObject } from "./mihomo";
import { getActiveScanSignal, registerMihomoChild, unregisterMihomoChild } from "./scan-control.server";
import { endpointKey } from "./parse";
import type { ParsedNode, ProbedNode, ScanStrategy } from "./types";

const CACHE_MS = 180_000;
const cache = new Map<string, { at: number; latency: number | null; url: string }>();

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(() => undefined, () => undefined);
  return run;
}

function throwIfCancelled(): void {
  if (getActiveScanSignal()?.aborted) throw abortError();
}

function requestSignal(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  const scan = getActiveScanSignal();
  return scan ? AbortSignal.any([timeout, scan]) : timeout;
}

function q(value: string): string { return JSON.stringify(value); }

function indent(obj: Record<string, unknown>, level = 4): string[] {
  const pad = " ".repeat(level);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      if (v.every((x) => typeof x === "string" || typeof x === "number")) {
        lines.push(`${pad}${k}: [${v.map((x) => (typeof x === "string" ? q(x) : x)).join(", ")}]`);
      } else {
        lines.push(`${pad}${k}:`);
        for (const item of v) {
          if (typeof item === "object" && item) {
            const entries = Object.entries(item as Record<string, unknown>);
            entries.forEach(([ik, iv], i) => {
              const prefix = i === 0 ? `${pad}  - ` : `${pad}    `;
              if (typeof iv === "string") lines.push(`${prefix}${ik}: ${q(iv)}`);
              else lines.push(`${prefix}${ik}: ${iv}`);
            });
          }
        }
      }
    } else if (typeof v === "object") {
      lines.push(`${pad}${k}:`);
      lines.push(...indent(v as Record<string, unknown>, level + 2));
    } else if (typeof v === "boolean" || typeof v === "number") {
      lines.push(`${pad}${k}: ${v}`);
    } else {
      lines.push(`${pad}${k}: ${q(String(v))}`);
    }
  }
  return lines;
}

function usable(node: ParsedNode): boolean {
  if (!node.host || !node.port) return false;
  switch (node.protocol) {
    case "vless":
    case "vmess":
    case "tuic": return Boolean(node.uuid);
    case "ss": return Boolean(node.password && node.method);
    case "trojan":
    case "hysteria2": return Boolean(node.password);
    default: return false;
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function groupLabel(index: number): string {
  return `batch-${String(index + 1).padStart(3, "0")}`;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function pushUrlTestGroup(lines: string[], name: string, testUrl: string, proxyNames: string[]): void {
  lines.push(`  - name: ${q(name)}`);
  lines.push(`    type: url-test`);
  lines.push(`    url: ${q(testUrl)}`);
  lines.push(`    interval: 86400`);
  lines.push(`    lazy: false`);
  lines.push(`    timeout: 4000`);
  lines.push(`    expected-status: 204`);
  lines.push(`    proxies:`);
  for (const proxy of proxyNames) lines.push(`      - ${q(proxy)}`);
}

function buildProbeYaml(
  named: Array<{ node: ParsedNode; name: string }>,
  testUrl: string,
  apiPort: number,
  mixedPort: number,
  groupSize?: number,
): string {
  const grouped = Boolean(groupSize && groupSize > 0);
  const lines: string[] = [
    `mixed-port: ${mixedPort}`,
    `bind-address: 127.0.0.1`,
    `allow-lan: false`,
    `mode: ${grouped ? "rule" : "global"}`,
    `log-level: error`,
    `ipv6: true`,
    `unified-delay: true`,
    `tcp-concurrent: true`,
    `find-process-mode: off`,
    `geo-auto-update: false`,
    `external-controller: 127.0.0.1:${apiPort}`,
    `secret: ""`,
    ``,
    `dns:`,
    `  enable: true`,
    `  enhanced-mode: fake-ip`,
    `  nameserver:`,
    `    - 1.1.1.1`,
    `    - 8.8.8.8`,
    ``,
    `proxies:`,
  ];
  for (const { node, name } of named) {
    const obj = clashProxyObject(node, name);
    if (obj.tls === true && obj["skip-cert-verify"] === undefined) obj["skip-cert-verify"] = true;
    lines.push(`  - name: ${q(name)}`);
    lines.push(...indent(obj, 4).filter((l) => !l.trimStart().startsWith("name:")));
  }
  lines.push(``, `proxy-groups:`);
  if (grouped) {
    chunks(named, groupSize!).forEach((group, i) => {
      pushUrlTestGroup(lines, groupLabel(i), testUrl, group.map((item) => item.name));
    });
    lines.push(``, `rules:`, `  - MATCH,DIRECT`, ``);
  } else {
    pushUrlTestGroup(lines, "RELAYTEST", testUrl, named.map((item) => item.name));
    lines.push(``, `rules:`, `  - MATCH,RELAYTEST`, ``);
  }
  return lines.join("\n");
}

async function waitApi(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    throwIfCancelled();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/version`, { signal: requestSignal(400) });
      if (res.ok) return;
    } catch {
      throwIfCancelled();
    }
    await sleep(120);
  }
  throw new Error("Ядро mihomo не подняло API");
}

function forceKill(child: ChildProcess): void {
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try { child.kill("SIGKILL"); } catch { /* ignore */ }
}

async function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      child.removeListener("exit", onExit);
      child.removeListener("error", onError);
      resolve();
    };
    const onExit = () => finish();
    const onError = () => finish();
    const forceTimer = setTimeout(() => {
      forceKill(child);
      setTimeout(finish, 200).unref();
    }, 1200);
    forceTimer.unref();
    child.once("exit", onExit);
    child.once("error", onError);
    try { child.kill("SIGTERM"); } catch { forceKill(child); finish(); }
  });
}

function isAliveDelay(delay: unknown): delay is number {
  return typeof delay === "number" && delay > 0 && delay < 65535;
}

async function groupDelays(
  apiPort: number,
  testUrl: string,
  timeoutMs: number,
  group = "RELAYTEST",
): Promise<Record<string, number>> {
  throwIfCancelled();
  const url = new URL(`http://127.0.0.1:${apiPort}/group/${encodeURIComponent(group)}/delay`);
  url.searchParams.set("url", testUrl);
  url.searchParams.set("timeout", String(timeoutMs));
  url.searchParams.set("expected", "204");
  const res = await fetch(url, { signal: requestSignal(timeoutMs + 20_000) });
  throwIfCancelled();
  if (!res.ok) throw new Error(`healthcheck ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) if (typeof v === "number") out[k] = v;
  return out;
}

async function proxyHistories(apiPort: number): Promise<Record<string, number>> {
  try {
    const res = await fetch(`http://127.0.0.1:${apiPort}/proxies`, { signal: requestSignal(8000) });
    if (!res.ok) return {};
    const data = (await res.json()) as { proxies?: Record<string, { history?: Array<{ delay?: number }> }> };
    const out: Record<string, number> = {};
    for (const [name, proxy] of Object.entries(data.proxies ?? {})) {
      const last = proxy.history?.at(-1)?.delay;
      if (typeof last === "number") out[name] = last;
    }
    return out;
  } catch {
    throwIfCancelled();
    return {};
  }
}

type Named = { node: ParsedNode; name: string };

async function spawnMihomo(
  named: Named[],
  testUrl: string,
  groupSize?: number,
): Promise<{ child: ChildProcess; apiPort: number; dir: string }> {
  throwIfCancelled();
  const bin = await ensureMihomoBinary();
  throwIfCancelled();
  const apiPort = await freePort();
  const mixedPort = await freePort();
  const dir = await mkdtemp(path.join(tmpdir(), "relay-probe-"));
  const configPath = path.join(dir, "config.yaml");
  await writeFile(configPath, buildProbeYaml(named, testUrl, apiPort, mixedPort, groupSize), "utf8");

  let stderr = "";
  const child = spawn(bin, ["-d", dir, "-f", configPath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SKIP_SYSTEM_PROXY: "1" },
    windowsHide: process.platform === "win32",
  });
  registerMihomoChild(child);
  child.stderr?.on("data", (buf: Buffer) => {
    if (stderr.length < 4000) stderr += buf.toString("utf8");
  });

  const died = new Promise<never>((_, reject) => {
    child.on("exit", (code) => reject(new Error(`mihomo вышел (${code ?? "?"})${stderr.trim() ? `: ${stderr.trim().slice(0, 280)}` : ""}`)));
    child.on("error", reject);
  });
  try {
    await Promise.race([waitApi(apiPort, 8000), died]);
  } catch (err) {
    unregisterMihomoChild(child);
    await killChild(child);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
  return { child, apiPort, dir };
}

async function applyGroupResult(
  named: Named[],
  measured: Record<string, number>,
  history: Record<string, number>,
  delays: Map<string, number | null>,
): void {
  for (const { node, name } of named) {
    const delay = measured[name] ?? history[name];
    delays.set(endpointKey(node), isAliveDelay(delay) ? delay : null);
  }
}

function aliveCount(delays: Map<string, number | null>): number {
  let n = 0;
  for (const value of delays.values()) if (value !== null) n += 1;
  return n;
}

async function runOnce(nodes: ParsedNode[], testUrl: string): Promise<Map<string, number | null>> {
  const named = nodes.filter(usable).map((node, i) => ({ node, name: `n${String(i + 1).padStart(3, "0")}` }));
  const delays = new Map<string, number | null>();
  for (const node of nodes) delays.set(endpointKey(node), null);
  if (named.length === 0) return delays;

  const { child, apiPort, dir } = await spawnMihomo(named, testUrl);
  try {
    let measured: Record<string, number> = {};
    try { measured = await groupDelays(apiPort, testUrl, 5000); } catch { throwIfCancelled(); measured = {}; }
    const history = await proxyHistories(apiPort);
    applyGroupResult(named, measured, history, delays);
    return delays;
  } finally {
    unregisterMihomoChild(child);
    await killChild(child);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runBatches(
  nodes: ParsedNode[],
  testUrl: string,
  batchSize: number,
  aliveTarget: number,
): Promise<{ delays: Map<string, number | null>; note: string | null }> {
  const delays = new Map<string, number | null>();
  const parts = chunks(nodes, batchSize);
  for (let i = 0; i < parts.length; i += 1) {
    throwIfCancelled();
    const part = await runOnce(parts[i], testUrl);
    for (const [key, value] of part) delays.set(key, value);
    if (aliveCount(delays) >= aliveTarget) {
      return {
        delays,
        note: `Пакеты: набрано ${aliveCount(delays)} живых после ${i + 1} из ${parts.length} пачек, дальше не гоняли.`,
      };
    }
  }
  return { delays, note: null };
}

async function runGroups(
  nodes: ParsedNode[],
  testUrl: string,
  batchSize: number,
  aliveTarget: number,
): Promise<{ delays: Map<string, number | null>; note: string | null }> {
  const named = nodes.filter(usable).map((node, i) => ({ node, name: `n${String(i + 1).padStart(3, "0")}` }));
  const delays = new Map<string, number | null>();
  if (named.length === 0) return { delays, note: null };

  const groups = chunks(named, batchSize);
  const { child, apiPort, dir } = await spawnMihomo(named, testUrl, batchSize);
  try {
    for (let i = 0; i < groups.length; i += 1) {
      throwIfCancelled();
      let measured: Record<string, number> = {};
      try { measured = await groupDelays(apiPort, testUrl, 5000, groupLabel(i)); } catch { throwIfCancelled(); measured = {}; }
      const history = await proxyHistories(apiPort);
      applyGroupResult(groups[i], measured, history, delays);
      if (aliveCount(delays) >= aliveTarget) {
        return {
          delays,
          note: `Группы: набрано ${aliveCount(delays)} живых после ${i + 1} из ${groups.length} групп, процесс не перезапускали.`,
        };
      }
      await sleep(150);
    }
    return { delays, note: null };
  } finally {
    unregisterMihomoChild(child);
    await killChild(child);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface MihomoProbeOpts {
  strategy?: ScanStrategy;
  batchSize?: number;
  aliveTarget?: number;
}

export async function probeNodesMihomo(
  nodes: ParsedNode[],
  testUrl = DEFAULT_TEST_URL,
  opts: MihomoProbeOpts = {},
): Promise<{ nodes: ProbedNode[]; testUrl: string; note: string | null }> {
  if (!canRunMihomo()) throw new Error("mihomo недоступен");
  const strategy: ScanStrategy = opts.strategy ?? "full";
  const batchSize = opts.batchSize ?? SCAN_BATCH_SIZE;
  const aliveTarget = opts.aliveTarget ?? SCAN_ALIVE_TARGET;

  return withLock(async () => {
    const now = Date.now();
    const fresh: ParsedNode[] = [];
    const cached = new Map<string, number | null>();
    for (const node of nodes) {
      const key = `${testUrl}|${endpointKey(node)}`;
      const hit = cache.get(key);
      if (hit && now - hit.at < CACHE_MS) cached.set(endpointKey(node), hit.latency);
      else fresh.push(node);
    }

    let urlUsed = testUrl || DEFAULT_TEST_URL;
    let measured = new Map<string, number | null>();
    let note: string | null = null;

    const run = async (url: string) => {
      if (strategy === "batches") return runBatches(fresh, url, batchSize, aliveTarget);
      if (strategy === "groups") return runGroups(fresh, url, batchSize, aliveTarget);
      return { delays: await runOnce(fresh, url), note: null as string | null };
    };

    if (fresh.length) {
      const first = await run(urlUsed);
      measured = first.delays;
      note = first.note;
      if (aliveCount(measured) === 0 && urlUsed !== FALLBACK_TEST_URL) {
        urlUsed = FALLBACK_TEST_URL;
        note = "YouTube не ответил, повтор через gstatic";
        const second = await run(urlUsed);
        measured = second.delays;
        if (second.note) note = `${note}. ${second.note}`;
      }
      const stamp = Date.now();
      for (const node of fresh) {
        const key = endpointKey(node);
        if (!measured.has(key)) continue;
        const latency = measured.get(key) ?? null;
        cache.set(`${urlUsed}|${key}`, { at: stamp, latency, url: urlUsed });
        cache.set(`${testUrl}|${key}`, { at: stamp, latency, url: urlUsed });
      }
    }

    const probed: ProbedNode[] = nodes.map((node) => {
      const key = endpointKey(node);
      const latency = measured.has(key) ? (measured.get(key) ?? null) : (cached.get(key) ?? null);
      return { ...node, latency, alive: latency !== null };
    });
    return { nodes: probed, testUrl: urlUsed, note };
  });
}
