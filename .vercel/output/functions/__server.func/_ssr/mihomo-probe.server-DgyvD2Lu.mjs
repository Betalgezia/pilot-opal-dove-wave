import { a as ensureMihomoBinary, i as canRunMihomo, n as FALLBACK_TEST_URL, t as DEFAULT_TEST_URL } from "./mihomo-bin.server-BqQnOcsW.mjs";
import { i as clashProxyObject } from "./mihomo-BZFtDaS-.mjs";
import { r as endpointKey } from "./scan.server-DqwgDPZX.mjs";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import net from "node:net";
//#region node_modules/.nitro/vite/services/ssr/assets/mihomo-probe.server-DgyvD2Lu.js
var CACHE_MS = 18e4;
var cache = /* @__PURE__ */ new Map();
var lock = Promise.resolve();
function withLock(fn) {
	const run = lock.then(fn, fn);
	lock = run.then(() => void 0, () => void 0);
	return run;
}
function q(value) {
	return JSON.stringify(value);
}
function indent(obj, level = 4) {
	const pad = " ".repeat(level);
	const lines = [];
	for (const [k, v] of Object.entries(obj)) {
		if (v === void 0 || v === null || v === "") continue;
		if (Array.isArray(v)) {
			if (v.length === 0) continue;
			if (v.every((x) => typeof x === "string" || typeof x === "number")) lines.push(`${pad}${k}: [${v.map((x) => typeof x === "string" ? q(x) : x).join(", ")}]`);
			else {
				lines.push(`${pad}${k}:`);
				for (const item of v) if (typeof item === "object" && item) Object.entries(item).forEach(([ik, iv], i) => {
					const prefix = i === 0 ? `${pad}  - ` : `${pad}    `;
					if (typeof iv === "string") lines.push(`${prefix}${ik}: ${q(iv)}`);
					else lines.push(`${prefix}${ik}: ${iv}`);
				});
			}
		} else if (typeof v === "object") {
			lines.push(`${pad}${k}:`);
			lines.push(...indent(v, level + 2));
		} else if (typeof v === "boolean" || typeof v === "number") lines.push(`${pad}${k}: ${v}`);
		else lines.push(`${pad}${k}: ${q(String(v))}`);
	}
	return lines;
}
function usable(node) {
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
function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}
function freePort() {
	return new Promise((resolve, reject) => {
		const s = net.createServer();
		s.unref();
		s.on("error", reject);
		s.listen(0, "127.0.0.1", () => {
			const addr = s.address();
			const port = typeof addr === "object" && addr ? addr.port : 0;
			s.close((err) => err ? reject(err) : resolve(port));
		});
	});
}
function buildProbeYaml(named, testUrl, apiPort, mixedPort) {
	const lines = [
		`mixed-port: ${mixedPort}`,
		`bind-address: 127.0.0.1`,
		`allow-lan: false`,
		`mode: global`,
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
		`proxies:`
	];
	for (const { node, name } of named) {
		const obj = clashProxyObject(node, name);
		if (obj.tls === true && obj["skip-cert-verify"] === void 0) obj["skip-cert-verify"] = true;
		lines.push(`  - name: ${q(name)}`);
		lines.push(...indent(obj, 4).filter((l) => !l.trimStart().startsWith("name:")));
	}
	lines.push(``);
	lines.push(`proxy-groups:`);
	lines.push(`  - name: "RELAYTEST"`);
	lines.push(`    type: url-test`);
	lines.push(`    url: ${q(testUrl)}`);
	lines.push(`    interval: 86400`);
	lines.push(`    lazy: false`);
	lines.push(`    timeout: 4000`);
	lines.push(`    expected-status: 204`);
	lines.push(`    proxies:`);
	for (const { name } of named) lines.push(`      - ${q(name)}`);
	lines.push(``);
	lines.push(`rules:`);
	lines.push(`  - MATCH,RELAYTEST`);
	lines.push(``);
	return lines.join("\n");
}
async function waitApi(port, timeoutMs) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			if ((await fetch(`http://127.0.0.1:${port}/version`, { signal: AbortSignal.timeout(400) })).ok) return;
		} catch {}
		await sleep(120);
	}
	throw new Error("Ядро mihomo не подняло API");
}
function killChild(child) {
	if (child.killed || child.exitCode !== null) return;
	try {
		child.kill("SIGTERM");
	} catch {}
	setTimeout(() => {
		if (child.exitCode === null && !child.killed) try {
			child.kill("SIGKILL");
		} catch {}
	}, 1200).unref();
}
function isAliveDelay(delay) {
	return typeof delay === "number" && delay > 0 && delay < 65535;
}
async function groupDelays(apiPort, testUrl, timeoutMs) {
	const url = new URL(`http://127.0.0.1:${apiPort}/group/RELAYTEST/delay`);
	url.searchParams.set("url", testUrl);
	url.searchParams.set("timeout", String(timeoutMs));
	url.searchParams.set("expected", "204");
	const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs + 2e4) });
	if (!res.ok) throw new Error(`healthcheck ${res.status}`);
	const data = await res.json();
	const out = {};
	for (const [k, v] of Object.entries(data)) if (typeof v === "number") out[k] = v;
	return out;
}
async function proxyHistories(apiPort) {
	try {
		const res = await fetch(`http://127.0.0.1:${apiPort}/proxies`, { signal: AbortSignal.timeout(8e3) });
		if (!res.ok) return {};
		const data = await res.json();
		const out = {};
		for (const [name, proxy] of Object.entries(data.proxies ?? {})) {
			const last = proxy.history?.at(-1)?.delay;
			if (typeof last === "number") out[name] = last;
		}
		return out;
	} catch {
		return {};
	}
}
async function runOnce(nodes, testUrl) {
	const named = nodes.filter(usable).map((node, i) => ({
		node,
		name: `n${String(i + 1).padStart(3, "0")}`
	}));
	const delays = /* @__PURE__ */ new Map();
	for (const node of nodes) delays.set(endpointKey(node), null);
	if (named.length === 0) return delays;
	const bin = await ensureMihomoBinary();
	const apiPort = await freePort();
	const mixedPort = await freePort();
	const dir = await mkdtemp(path.join(tmpdir(), "relay-probe-"));
	const configPath = path.join(dir, "config.yaml");
	await writeFile(configPath, buildProbeYaml(named, testUrl, apiPort, mixedPort), "utf8");
	let stderr = "";
	const child = spawn(bin, [
		"-d",
		dir,
		"-f",
		configPath
	], {
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		],
		env: {
			...process.env,
			SKIP_SYSTEM_PROXY: "1"
		}
	});
	child.stderr?.on("data", (buf) => {
		if (stderr.length < 4e3) stderr += buf.toString("utf8");
	});
	try {
		const died = new Promise((_, reject) => {
			child.on("exit", (code) => {
				reject(/* @__PURE__ */ new Error(`mihomo вышел (${code ?? "?"})${stderr.trim() ? `: ${stderr.trim().slice(0, 280)}` : ""}`));
			});
			child.on("error", reject);
		});
		await Promise.race([waitApi(apiPort, 8e3), died]);
		let measured = {};
		try {
			measured = await groupDelays(apiPort, testUrl, 5e3);
		} catch {
			measured = {};
		}
		const history = await proxyHistories(apiPort);
		for (const { node, name } of named) {
			const delay = measured[name] ?? history[name];
			delays.set(endpointKey(node), isAliveDelay(delay) ? delay : null);
		}
		return delays;
	} finally {
		killChild(child);
		await sleep(200);
		await rm(dir, {
			recursive: true,
			force: true
		}).catch(() => void 0);
	}
}
async function probeNodesMihomo(nodes, testUrl = DEFAULT_TEST_URL) {
	if (!canRunMihomo()) throw new Error("mihomo недоступен");
	return withLock(async () => {
		const now = Date.now();
		const fresh = [];
		const cached = /* @__PURE__ */ new Map();
		for (const node of nodes) {
			const key = `${testUrl}|${endpointKey(node)}`;
			const hit = cache.get(key);
			if (hit && now - hit.at < CACHE_MS) cached.set(endpointKey(node), hit.latency);
			else fresh.push(node);
		}
		let urlUsed = testUrl || "https://www.youtube.com/generate_204";
		let measured = /* @__PURE__ */ new Map();
		let note = null;
		if (fresh.length) {
			measured = await runOnce(fresh, urlUsed);
			if ([...measured.values()].filter((x) => x !== null).length === 0 && urlUsed !== "http://www.gstatic.com/generate_204") {
				urlUsed = FALLBACK_TEST_URL;
				note = "YouTube не ответил, повтор через gstatic";
				measured = await runOnce(fresh, urlUsed);
			}
			const stamp = Date.now();
			for (const node of fresh) {
				const latency = measured.get(endpointKey(node)) ?? null;
				cache.set(`${urlUsed}|${endpointKey(node)}`, {
					at: stamp,
					latency,
					url: urlUsed
				});
				cache.set(`${testUrl}|${endpointKey(node)}`, {
					at: stamp,
					latency,
					url: urlUsed
				});
			}
		}
		return {
			nodes: nodes.map((node) => {
				const key = endpointKey(node);
				const latency = measured.has(key) ? measured.get(key) ?? null : cached.get(key) ?? null;
				return {
					...node,
					latency,
					alive: latency !== null
				};
			}),
			testUrl: urlUsed,
			note
		};
	});
}
//#endregion
export { probeNodesMihomo };
