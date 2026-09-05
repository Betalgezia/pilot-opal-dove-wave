import { n as __exportAll$1 } from "../_runtime.mjs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createGunzip } from "node:zlib";
//#region node_modules/.nitro/vite/services/ssr/assets/mihomo-bin.server-BqQnOcsW.js
var mihomo_bin_server_BqQnOcsW_exports = /* @__PURE__ */ __exportAll$1({
	a: () => FALLBACK_TEST_URL,
	i: () => DEFAULT_TEST_URL,
	n: () => ensureMihomoBinary,
	o: () => __exportAll,
	r: () => mihomo_bin_server_exports,
	t: () => canRunMihomo
});
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var DEFAULT_TEST_URL = "https://www.youtube.com/generate_204";
var FALLBACK_TEST_URL = "http://www.gstatic.com/generate_204";
var MIHOMO_VERSION = "v1.19.30";
var mihomo_bin_server_exports = /* @__PURE__ */ __exportAll({
	canRunMihomo: () => canRunMihomo,
	ensureMihomoBinary: () => ensureMihomoBinary,
	isServerlessHost: () => isServerlessHost
});
var CACHE_DIR = path.join(tmpdir(), "relay-mihomo");
var BIN_PATH = path.join(CACHE_DIR, "mihomo");
var STAMP_PATH = path.join(CACHE_DIR, "version");
function isServerlessHost() {
	return Boolean(process.env.VERCEL || process.env.CF_PAGES || process.env.CF_WORKER || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
}
function canRunMihomo() {
	if (isServerlessHost()) return false;
	return process.platform === "linux" || process.platform === "darwin";
}
function assetName(version) {
	const plat = process.platform === "darwin" ? "darwin" : "linux";
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	if (arch === "amd64") return `mihomo-${plat}-amd64-compatible-${version}.gz`;
	return `mihomo-${plat}-${arch}-${version}.gz`;
}
async function exists(file) {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}
function runVersion(bin) {
	return new Promise((resolve) => {
		const child = spawn(bin, ["-v"], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		let settled = false;
		const done = (ok) => {
			if (settled) return;
			settled = true;
			resolve(ok);
		};
		child.on("error", () => done(false));
		child.on("exit", (code) => done(code === 0));
		setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {}
			done(false);
		}, 4e3);
	});
}
var installing = null;
async function ensureMihomoBinary() {
	if (!canRunMihomo()) throw new Error("mihomo недоступен на этом хосте");
	if (await exists(BIN_PATH)) {
		if ((await readFile(STAMP_PATH, "utf8").catch(() => "")).trim() === "v1.19.30" && await runVersion(BIN_PATH)) return BIN_PATH;
	}
	if (installing) return installing;
	installing = installBinary().finally(() => {
		installing = null;
	});
	return installing;
}
async function installBinary() {
	await mkdir(CACHE_DIR, { recursive: true });
	const url = `https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${assetName(MIHOMO_VERSION)}`;
	const res = await fetch(url, {
		redirect: "follow",
		headers: { "user-agent": "relay-mihomo" },
		signal: AbortSignal.timeout(12e4)
	});
	if (!res.ok || !res.body) throw new Error(`Не удалось скачать mihomo (${res.status})`);
	const tmpPath = `${BIN_PATH}.tmp`;
	await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(tmpPath));
	await chmod(tmpPath, 493);
	await rename(tmpPath, BIN_PATH).catch(async () => {
		await unlink(BIN_PATH).catch(() => void 0);
		await rename(tmpPath, BIN_PATH);
	});
	await writeFile(STAMP_PATH, MIHOMO_VERSION, "utf8");
	if (!await runVersion(BIN_PATH)) throw new Error("Скачанный mihomo не запускается");
	return BIN_PATH;
}
//#endregion
export { ensureMihomoBinary as a, canRunMihomo as i, FALLBACK_TEST_URL as n, mihomo_bin_server_BqQnOcsW_exports as o, __exportAll as r, DEFAULT_TEST_URL as t };
