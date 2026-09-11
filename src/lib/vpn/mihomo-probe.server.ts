import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_TEST_URL } from "./constants";
import { ensureMihomoBinary, canRunMihomo } from "./mihomo-bin.server";
import { clashProxyObject } from "./mihomo";
import { registerMihomoChild, unregisterMihomoChild } from "./scan-control.server";
import type { ParsedNode, ProbedNode } from "./types";

const MIHOMO_ROUND_SIZE = 800;
const DEEP_CACHE_MS = 900_000;
const DEEP_EXPECTED_STATUS = "200-299";
const STDERR_LIMIT = 4000;
const deepCache = new Map<string, { at: number; ok: boolean }>();
let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> { const run = lock.then(fn, fn); lock = run.then(() => undefined, () => undefined); return run; }
function q(value: string): string { return JSON.stringify(value.trim()); }
function indent(obj: Record<string, unknown>, level = 4): string[] {
  const pad = " ".repeat(level); const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      if (v.every((x) => typeof x === "string" || typeof x === "number")) lines.push(`${pad}${k}: [${v.map((x) => typeof x === "string" ? q(x) : x).join(", ")}]`);
      else { lines.push(`${pad}${k}:`); for (const item of v) if (typeof item === "object" && item) Object.entries(item as Record<string, unknown>).forEach(([ik, iv], i) => lines.push(`${i === 0 ? `${pad}  - ` : `${pad}    `}${ik}: ${typeof iv === "string" ? q(iv) : iv}`)); }
    } else if (typeof v === "object") { lines.push(`${pad}${k}:`); lines.push(...indent(v as Record<string, unknown>, level + 2)); }
    else if (typeof v === "boolean" || typeof v === "number") lines.push(`${pad}${k}: ${v}`);
    else lines.push(`${pad}${k}: ${q(String(v))}`);
  }
  return lines;
}
function usable(node: ParsedNode): boolean {
  if (!node.host || !node.port) return false;
  switch (node.protocol) { case "vless": case "vmess": case "tuic": return Boolean(node.uuid); case "ss": return Boolean(node.password && node.method); case "trojan": case "hysteria2": return Boolean(node.password); default: return false; }
}
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
export function freePort(): Promise<number> { return new Promise((resolve, reject) => { const s = net.createServer(); s.unref(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const addr = s.address(); const port = typeof addr === "object" && addr ? addr.port : 0; s.close((err) => err ? reject(err) : resolve(port)); }); }); }
export function buildProbeYaml(named: Array<{ node: ParsedNode; name: string }>, testUrl: string, apiPort: number, mixedPort: number, timeoutMs: number): string {
  const lines = [`mixed-port: ${mixedPort}`, `bind-address: 127.0.0.1`, `allow-lan: false`, `mode: global`, `log-level: error`, `ipv6: true`, `unified-delay: true`, `tcp-concurrent: true`, `find-process-mode: off`, `geo-auto-update: false`, `external-controller: 127.0.0.1:${apiPort}`, `secret: ""`, ``, `dns:`, `  enable: true`, `  enhanced-mode: fake-ip`, `  nameserver:`, `    - 1.1.1.1`, `    - 8.8.8.8`, ``, `proxies:`];
  for (const { node, name } of named) { const obj = clashProxyObject(node, name); lines.push(`  - name: ${q(name)}`); lines.push(...indent(obj, 4).filter((l) => !l.trimStart().startsWith("name:"))); }
  lines.push(``, `proxy-groups:`, `  - name: "RELAYTEST"`, `    type: url-test`, `    url: ${q(testUrl)}`, `    interval: 86400`, `    lazy: false`, `    timeout: ${timeoutMs}`, `    expected-status: ${DEEP_EXPECTED_STATUS}`, `    proxies:`);
  for (const { name } of named) lines.push(`      - ${q(name)}`);
  lines.push(``, `rules:`, `  - MATCH,RELAYTEST`, ``); return lines.join("\n");
}
async function waitApi(port: number, timeoutMs: number): Promise<void> { const start = Date.now(); while (Date.now() - start < timeoutMs) { try { const res = await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(400) }); if (res.ok) return; } catch {} await sleep(120); } throw new Error("Ядро mihomo не подняло API"); }
async function killChild(child: ChildProcess): Promise<void> { if (child.exitCode !== null) return; await new Promise<void>((resolve) => { let settled = false; const finish = () => { if (settled) return; settled = true; clearTimeout(forceTimer); child.removeListener("exit", onExit); child.removeListener("error", onError); resolve(); }; const onExit = () => finish(); const onError = () => finish(); const forceTimer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} setTimeout(finish, 200).unref(); }, 1200); forceTimer.unref(); child.once("exit", onExit); child.once("error", onError); try { child.kill("SIGTERM"); } catch { finish(); } }); }
function isAliveDelay(delay: unknown): delay is number { return typeof delay === "number" && delay >= 0 && delay < 65535; }
async function groupDelays(apiPort: number, testUrl: string, timeoutMs: number, perRequestTimeoutMs: number): Promise<Record<string, number>> { const url = new URL(`http://127.0.0.1:${apiPort}/group/RELAYTEST/delay`); url.searchParams.set("url", testUrl); url.searchParams.set("timeout", String(timeoutMs)); url.searchParams.set("expected", DEEP_EXPECTED_STATUS); const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(timeoutMs + 20_000, perRequestTimeoutMs + 20_000)) }); if (!res.ok) throw new Error(`healthcheck ${res.status}`); const data = (await res.json()) as Record<string, unknown>; const out: Record<string, number> = {}; for (const [k, v] of Object.entries(data)) if (typeof v === "number") out[k] = v; return out; }
function formatMihomoExit(code: number | null, signal: NodeJS.Signals | null, diagnostics: string): string { const details = diagnostics.trim().replace(/\s+/g, " "); const exit = signal ? `сигнал ${signal}` : `код ${code ?? "?"}`; return `mihomo вышел (${exit})${details ? `: ${details.slice(0, 1200)}` : ". mihomo не сообщил диагностику."}`; }
async function runOnce(nodes: ParsedNode[], testUrl: string, timeoutMs: number): Promise<{ delays: Map<string, number | null>; loaded: number; delayed: number; unknown: number }> {
  const named = nodes.filter(usable).map((node, i) => ({ node, name: `n${String(i + 1).padStart(3, "0")}` })); const delays = new Map<string, number | null>(); for (const node of nodes) delays.set(node.id, null); if (!named.length) return { delays, loaded: 0, delayed: 0, unknown: nodes.length };
  const bin = await ensureMihomoBinary(); const apiPort = await freePort(); const mixedPort = await freePort(); const dir = await mkdtemp(path.join(tmpdir(), "relay-probe-")); const configPath = path.join(dir, "config.yaml"); const probeTimeout = Math.max(1000, Math.min(8000, timeoutMs)); await writeFile(configPath, buildProbeYaml(named, testUrl, apiPort, mixedPort, probeTimeout), "utf8");
  let stdout = ""; let stderr = ""; const append = (target: "stdout" | "stderr", chunk: string) => { if (target === "stdout") { if (stdout.length < STDERR_LIMIT) stdout += chunk.slice(0, STDERR_LIMIT - stdout.length); } else if (stderr.length < STDERR_LIMIT) stderr += chunk.slice(0, STDERR_LIMIT - stderr.length); };
  const child = spawn(bin, ["-d", dir, "-f", configPath], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SKIP_SYSTEM_PROXY: "1" }, windowsHide: process.platform === "win32" });
  registerMihomoChild(child); child.stdout?.setEncoding("utf8"); child.stderr?.setEncoding("utf8"); child.stdout?.on("data", (chunk: string) => append("stdout", chunk)); child.stderr?.on("data", (chunk: string) => append("stderr", chunk));
  try {
    const died = new Promise<never>((_, reject) => {
      let exitCode: number | null = null; let exitSignal: NodeJS.Signals | null = null;
      child.once("exit", (code, signal) => { exitCode = code; exitSignal = signal; });
      child.once("close", () => reject(new Error(formatMihomoExit(exitCode, exitSignal, [stderr, stdout].filter(Boolean).join(" | ")))));
      child.once("error", (err) => setImmediate(() => reject(err)));
    });
    try { await Promise.race([waitApi(apiPort, 8000), died]); }
    catch (err) { if (err instanceof Error) throw err; throw new Error(String(err)); }
    const measured = await groupDelays(apiPort, testUrl, probeTimeout, probeTimeout); for (const { node, name } of named) { const delay = measured[name]; delays.set(node.id, isAliveDelay(delay) ? delay : null); } return { delays, loaded: named.length, delayed: Object.keys(measured).length, unknown: 0 };
  }
  finally { unregisterMihomoChild(child); await killChild(child); await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}

export async function probeNodesMihomo(nodes: ParsedNode[], testUrl = DEFAULT_TEST_URL, timeoutMs = 6000): Promise<{ nodes: ProbedNode[]; testUrl: string; note: string | null; metrics: { mihomoLoaded: number; mihomoDelayReceived: number; unknown: number; rounds: number } }> {
  if (!canRunMihomo()) throw new Error("mihomo недоступен");
  return withLock(async () => {
    const probed = new Map<string, ProbedNode>(); let loaded = 0; let delayed = 0; let unknown = 0; let rounds = 0; let failureNote: string | null = null;
    for (let i = 0; i < nodes.length; i += MIHOMO_ROUND_SIZE) {
      const round = nodes.slice(i, i + MIHOMO_ROUND_SIZE); rounds += 1;
      try {
        const result = await runOnce(round, testUrl || DEFAULT_TEST_URL, timeoutMs); loaded += result.loaded; delayed += result.delayed; unknown += result.unknown;
        for (const node of round) { const latency = result.delays.get(node.id) ?? null; probed.set(node.id, { ...node, latency, alive: latency !== null, probeState: "checked" }); }
      } catch (err) {
        unknown += round.length; for (const node of round) probed.set(node.id, { ...node, latency: null, alive: false, probeState: "unknown" });
        failureNote = err instanceof Error ? err.message : String(err);
        if (nodes.length <= MIHOMO_ROUND_SIZE) throw err;
      }
    }
    const noteParts = [failureNote, unknown > 0 ? `Проверено раундов: ${rounds}. Неизвестно: ${unknown}.` : null].filter((value): value is string => Boolean(value));
    const note = noteParts.length ? noteParts.join(" · ").slice(0, 1800) : null;
    return { nodes: nodes.map((node) => probed.get(node.id) ?? { ...node, latency: null, alive: false, probeState: "unknown" }), testUrl: testUrl || DEFAULT_TEST_URL, note, metrics: { mihomoLoaded: loaded, mihomoDelayReceived: delayed, unknown, rounds } };
  });
}

export async function verifyNodesMihomo(nodes: ParsedNode[], targetUrls: string[], timeoutMs = 6000): Promise<Map<string, Record<string, boolean>>> {
  if (!canRunMihomo() || nodes.length === 0 || targetUrls.length === 0) return new Map();
  return withLock(async () => {
    const output = new Map<string, Record<string, boolean>>(); const now = Date.now(); const pendingByUrl = new Map<string, ParsedNode[]>();
    for (const url of targetUrls) for (const node of nodes) { const hit = deepCache.get(`${url}|${node.id}`); if (hit && now - hit.at < DEEP_CACHE_MS) { const current = output.get(node.id) ?? {}; current[url] = hit.ok; output.set(node.id, current); } else { const list = pendingByUrl.get(url) ?? []; list.push(node); pendingByUrl.set(url, list); } }
    for (const [url, pending] of pendingByUrl) for (let i = 0; i < pending.length; i += MIHOMO_ROUND_SIZE) {
      const round = pending.slice(i, i + MIHOMO_ROUND_SIZE);
      try { const result = await runOnce(round, url, timeoutMs); const stamp = Date.now(); for (const node of round) { const ok = result.delays.get(node.id) !== null; deepCache.set(`${url}|${node.id}`, { at: stamp, ok }); const current = output.get(node.id) ?? {}; current[url] = ok; output.set(node.id, current); } }
      catch (err) { for (const node of round) { const current = output.get(node.id) ?? {}; current[url] = false; output.set(node.id, current); } }
    }
    return output;
  });
}
