import { a as object, i as number, n as boolean, o as string, t as array } from "../_libs/zod.mjs";
import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scan.functions-D5H4HcWw.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var sourceSchema = object({
	id: string().min(1).max(64),
	name: string().min(1).max(80),
	url: string().min(8).max(500),
	enabled: boolean()
});
var scanSources_createServerFn_handler = createServerRpc({
	id: "34d3a3363dc01d8ecc2768bf9d57bc6a757f83b85b4b97deed8921c52eb169f3",
	name: "scanSources",
	filename: "src/lib/vpn/scan.functions.ts"
}, (opts) => scanSources.__executeServer(opts));
var scanSources = createServerFn({ method: "POST" }).validator(object({
	sources: array(sourceSchema).min(1).max(16),
	perSource: number().min(4).max(32).optional(),
	globalCap: number().min(8).max(80).optional(),
	timeoutMs: number().min(800).max(8e3).optional(),
	real: boolean().optional(),
	testUrl: string().max(300).optional()
})).handler(scanSources_createServerFn_handler, async ({ data }) => {
	const { runScan } = await import("./scan.server-DqwgDPZX.mjs").then((n) => n.n);
	return runScan(data.sources, {
		perSource: data.perSource,
		globalCap: data.globalCap,
		timeoutMs: data.timeoutMs,
		real: data.real,
		testUrl: data.testUrl
	});
});
var getProbeCaps_createServerFn_handler = createServerRpc({
	id: "480bec4539a8c1f7da064d8399783afbbe608b29e5138cba86b9cf3cdab1897d",
	name: "getProbeCaps",
	filename: "src/lib/vpn/scan.functions.ts"
}, (opts) => getProbeCaps.__executeServer(opts));
var getProbeCaps = createServerFn({ method: "GET" }).handler(getProbeCaps_createServerFn_handler, async () => {
	const { canRunMihomo } = await import("./mihomo-bin.server-BqQnOcsW.mjs").then((n) => n.o).then((n) => n.r);
	return { mihomo: canRunMihomo() };
});
//#endregion
export { getProbeCaps_createServerFn_handler, scanSources_createServerFn_handler };
