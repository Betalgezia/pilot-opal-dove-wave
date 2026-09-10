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

const DEEP_CACHE_MS = 900_000;
const deepCache = new Map<string, { at: number; ok: boolean }>();
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> { const run = lock.then(fn, fn); lock = run.then(() => undefined, () => undefined); return run; }
function q(value: string): string { return JSON.stringify(value); }
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
function freePort(): Promise<number> { return new Promise((resolve, reject) => { const s = net.createServer(); s.unref(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const addr = s.address(); const port = typeof addr === "object" && addr ? addr.port : 0; s.close((err) => err ? reject(err) : resolve(port)); }); }); }
function buildProbeYaml(named: Array<{ node: ParsedNode; name: string }>, testUrl: string, apiPort: number, mixedPort: number): string {
  const lines = [`mixed-port: ${mixedPort}`, `bind-address: 127.0.0.1`, `allow-lan: false`, `mode: global`, `log-level: error`, `ipv6: true`, `unified-delay: true`, `tcp-concurrent: true`, `find-process-mode: off`, `geo-auto-update: false`, `external-controller: 127.0.0.1:${apiPort}`, `secret: ""`, ``, `dns:`, `  enable: true`, `  enhanced-mode: fake-ip`, `  nameserver:`, `    - 1.1.1.1`, `    - 8.8.8.8`, ``, `proxies:`];
  for (const { node, name } of named) { const obj = clashProxyObject(node, name); lines.push(`  - name: ${q(name)}`); lines.push(...indent(obj, 4).filter((l) => !l.trimStart().startsWith("name:"))); }
  lines.push(``, `proxy-groups:`, `  - name: "RELAYTEST"`, `    type: url-test`, `    url: ${q(testUrl)}`, `    interval: 86400`, `    lazy: false`, `    timeout: 5000`, `    expected-status: 204`, `    proxies:`);
  for (const { name } of named) lines.push(`      - ${q(name)}`);
  lines.push(``, `rules:`, `  - MATCH,RELAYTEST`, ``); return lines.join("\n");
}
async function waitApi(port: number, timeoutMs: number): Promise<void> { const start = Date.now(); while (Date.now() - start < timeoutMs) { try { const res = await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(400) }); if (res.ok) return; } catch {} await sleep(120); } throw new Error("Ядро mihomo не подняло API"); }
async function killChild(child: ChildProcess): Promise<void> { if (child.exitCode !== null) return; await new Promise<void>((resolve) => { let settled = false; const finish = () => { if (settled) return; settled = true; clearTimeout(forceTimer); child.removeListener("exit", onExit); child.removeListener("error", onError); resolve(); }; const onExit = () => finish(); const onError = () => finish(); const forceTimer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} setTimeout(finish, 200).unref(); }, 1200); forceTimer.unref(); child.once("exit", onExit); child.once("error", onError); try { child.kill("SIGTERM"); } catch { finish(); } }); }
function isAliveDelay(delay: unknown): delay is number { return typeof delay === "number" && delay >= 0 && delay < 65535; }
async function groupDelays(apiPort: number, testUrl: string, timeoutMs: number): Promise<Record<string, number>> { const url = new URL(`http://127.0.0.1:${apiPort}/group/RELAYTEST/delay`); url.searchParams.set("url", testUrl); url.searchParams.set("timeout", String(timeoutMs)); url.searchParams.set("expected", "204"); const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs + 20_000) }); if (!res.ok) throw new Error(`healthcheck ${res.status}`); const data = (await res.json()) as Record<string, unknown>; const out: Record<string, number> = {}; for (const [k, v] of Object.entries(data)) if (typeof v === "number") out[k] = v; return out; }
async function runOnce(nodes: ParsedNode[], testUrl: string): Promise<{ delays: Map<string, number | null>; loaded: number; delayed: number }> {
  const named = nodes.filter(usable).map((node, i) => ({ node, name: `n${String(i + 1).padStart(3, "0")}` })); const delays = new Map<string, number | null>(); for (const node of nodes) delays.set(node.id, null); if (!named.length) return { delays, loaded: 0, delayed: 0 };
  const bin = await ensureMihomoBinary(); const apiPort = await freePort(); const mixedPort = await freePort(); const dir = await mkdtemp(path.join(tmpdir(), "relay-probe-")); const configPath = path.join(dir, "config.yaml"); await writeFile(configPath, buildProbeYaml(named, testUrl, apiPort, mixedPort), "utf8");
  let stderr = ""; const child = spawn(bin, ["-d", dir, "-f", configPath], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SKIP_SYSTEM_PROXY: "1" }, windowsHide: process.platform === "win32" }); registerMihomoChild(child); child.stderr?.on("data", (buf: Buffer) => { if (stderr.length < 4000) stderr += buf.toString("utf8"); });
  try { const died = new Promise<never>((_, reject) => { child.on("exit", (code) => reject(new Error(`mihomo вышел (${code ?? "?"})${stderr.trim() ? `: ${stderr.trim().slice(0, 280)}` : ""}`))); child.on("error", reject); }); await Promise.race([waitApi(apiPort, 8000), died]); const measured = await groupDelays(apiPort, testUrl, 5000); for (const { node, name } of named) { const delay = measured[name]; delays.set(node.id, isAliveDelay(delay) ? delay : null); } return { delays, loaded: named.length, delayed: Object.keys(measured).length }; }
  finally { unregisterMihomoChild(child); await killChild(child); await rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}

export async function probeNodesMihomo(nodes: ParsedNode[], testUrl = DEFAULT_TEST_URL): Promise<{ nodes: ProbedNode[]; testUrl: string; note: string | null; metrics: { mihomoLoaded: number; mihomoDelayReceived: number; unknown: number } }> {
  if (!canRunMihomo()) throw new Error("mihomo недоступен");
  return withLock(async () => {
    const result = await runOnce(nodes, testUrl || DEFAULT_TEST_URL);
    const probed: ProbedNode[] = nodes.map((node) => { const latency = result.delays.get(node.id) ?? null; return { ...node, latency, alive: latency !== null, probeState: "checked" }; });
    return { nodes: probed, testUrl: testUrl || DEFAULT_TEST_URL, note: null, metrics: { mihomoLoaded: result.loaded, mihomoDelayReceived: result.delayed, unknown: nodes.length - result.loaded } };
  });
}

export async function verifyNodesMihomo(nodes: ParsedNode[], targetUrls: string[]): Promise<Map<string, Record<string, boolean>>> {
  if (!canRunMihomo() || nodes.length === 0 || targetUrls.length === 0) return new Map();
  return withLock(async () => {
    const output = new Map<string, Record<string, boolean>>(); const now = Date.now(); const pendingByUrl = new Map<string, ParsedNode[]>();
    for (const url of targetUrls) for (const node of nodes) { const hit = deepCache.get(`${url}|${node.id}`); if (hit && now - hit.at < DEEP_CACHE_MS) { const current = output.get(node.id) ?? {}; current[url] = hit.ok; output.set(node.id, current); } else { const list = pendingByUrl.get(url) ?? []; list.push(node); pendingByUrl.set(url, list); } }
    for (const [url, pending] of pendingByUrl) { try { const result = await runOnce(pending, url); const stamp = Date.now(); for (const node of pending) { const ok = result.delays.get(node.id) !== null; deepCache.set(`${url}|${node.id}`, { at: stamp, ok }); const current = output.get(node.id) ?? {}; current[url] = ok; output.set(node.id, current); } } catch { for (const node of pending) { const current = output.get(node.id) ?? {}; current[url] = false; output.set(node.id, current); } } }
    return output;
  });
}
