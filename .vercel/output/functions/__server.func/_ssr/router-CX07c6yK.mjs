import { i as __toESM, n as __exportAll } from "../_runtime.mjs";
import { t as runScan } from "./scan.server-LM37VynH.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { _ as useRouter, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as object, i as number, o as string, r as literal, s as union } from "../_libs/zod.mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
import { n as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { n as Portal, r as Provider, t as Content2 } from "../_libs/@radix-ui/react-tooltip+[...].mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mihomo-BeLEYmBz.js
function pickActive(result, strategy, previousId) {
	const alive = result.nodes.filter((n) => n.alive);
	if (alive.length === 0) return null;
	if (strategy === "fastest") return [...alive].sort((a, b) => (a.latency ?? 99999) - (b.latency ?? 99999))[0];
	if (strategy === "fallback") {
		for (const source of result.sources) {
			if (!source.ok || source.alive === 0) continue;
			const hit = alive.find((n) => n.sourceId === source.id);
			if (hit) return hit;
		}
		return alive[0];
	}
	return alive[((previousId ? alive.findIndex((n) => n.id === previousId) : -1) + 1) % alive.length];
}
function pickExportNodes(result, limit) {
	const alive = result.nodes.filter((n) => n.alive);
	const pool = alive.length ? alive : result.nodes;
	const bySource = /* @__PURE__ */ new Map();
	for (const n of pool) {
		const list = bySource.get(n.sourceId) ?? [];
		list.push(n);
		bySource.set(n.sourceId, list);
	}
	const out = [];
	const ids = [...bySource.keys()];
	let i = 0;
	while (out.length < limit) {
		let added = false;
		for (const id of ids) {
			const bucket = bySource.get(id);
			if (!bucket || i >= bucket.length) continue;
			out.push(bucket[i]);
			added = true;
			if (out.length >= limit) break;
		}
		if (!added) break;
		i += 1;
	}
	return out;
}
function formatMs(ms) {
	if (ms === null || ms === void 0) return "—";
	return `${Math.round(ms)} ms`;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function normalizeSourceUrl(input) {
	const trimmed = input.trim();
	if (!trimmed) throw new Error("Пустой адрес");
	let raw = trimmed;
	try {
		const u = new URL(trimmed);
		u.hash = "";
		if (u.hostname === "github.com") {
			const parts = u.pathname.split("/").filter(Boolean);
			if (parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
				const [user, repo, , ref, ...rest] = parts;
				return `https://raw.githubusercontent.com/${user}/${repo}/${ref}/${rest.join("/")}`;
			}
		}
		raw = u.toString();
	} catch {
		throw new Error("Некорректный URL");
	}
	if (!/^https?:\/\//i.test(raw)) throw new Error("Нужен http(s) URL");
	return raw;
}
function sourceNameFromUrl(url) {
	try {
		const file = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "source";
		return decodeURIComponent(file).replace(/\.(txt|yaml|yml|json)$/i, "");
	} catch {
		return "source";
	}
}
function utf8ToB64Url(s) {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return (typeof btoa === "function" ? btoa(bin) : Buffer.from(s, "utf8").toString("base64")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64UrlToUtf8(param) {
	const pad = param.replace(/-/g, "+").replace(/_/g, "/");
	const padded = pad + "=".repeat((4 - pad.length % 4) % 4);
	if (typeof atob === "function") {
		const bin = atob(padded);
		const bytes = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder().decode(bytes);
	}
	return Buffer.from(padded, "base64").toString("utf8");
}
function encodeSourceParam(urls) {
	return utf8ToB64Url(JSON.stringify(urls));
}
function decodeSourceParam(param) {
	try {
		const parsed = JSON.parse(b64UrlToUtf8(param));
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((x) => typeof x === "string" && /^https?:\/\//i.test(x));
	} catch {
		return [];
	}
}
function q(value) {
	return JSON.stringify(value);
}
function indent(obj, level = 2) {
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
function uniqueName(base, used) {
	let name = base.slice(0, 40) || "node";
	let n = 2;
	while (used.has(name)) {
		name = `${base.slice(0, 36)}-${n}`;
		n += 1;
	}
	used.add(name);
	return name;
}
function nodeClashObject(node, name) {
	switch (node.protocol) {
		case "vless": {
			const obj = {
				name,
				type: "vless",
				server: node.host,
				port: node.port,
				uuid: node.uuid,
				udp: true,
				network: node.network || "tcp"
			};
			if (node.flow) obj.flow = node.flow.replace(/-udp443$/, "");
			if (node.security === "tls" || node.security === "reality" || Boolean(node.sni) || Boolean(node.pbk)) obj.tls = true;
			if (node.sni) obj.servername = node.sni;
			if (node.fp) obj["client-fingerprint"] = node.fp;
			if (node.alpn) obj.alpn = node.alpn.split(",").map((s) => s.trim()).filter(Boolean);
			if (node.security === "reality" && node.pbk) obj["reality-opts"] = {
				"public-key": node.pbk,
				"short-id": node.sid || ""
			};
			applyNetworkOpts(obj, node);
			return obj;
		}
		case "trojan": {
			const obj = {
				name,
				type: "trojan",
				server: node.host,
				port: node.port,
				password: node.password,
				udp: true,
				network: node.network || "tcp"
			};
			if (node.sni) obj.sni = node.sni;
			if (node.fp) obj["client-fingerprint"] = node.fp;
			if (node.security === "reality" && node.pbk) obj["reality-opts"] = {
				"public-key": node.pbk,
				"short-id": node.sid || ""
			};
			applyNetworkOpts(obj, node);
			return obj;
		}
		case "ss": return {
			name,
			type: "ss",
			server: node.host,
			port: node.port,
			cipher: node.method,
			password: node.password,
			udp: true
		};
		case "vmess": {
			const obj = {
				name,
				type: "vmess",
				server: node.host,
				port: node.port,
				uuid: node.uuid,
				alterId: Number(node.aid || 0),
				cipher: node.extra.scy || "auto",
				udp: true,
				network: node.network || "tcp"
			};
			if (node.security === "tls" || node.extra.tls === "tls") obj.tls = true;
			if (node.sni) obj.servername = node.sni;
			applyNetworkOpts(obj, node);
			return obj;
		}
		case "hysteria2": return {
			name,
			type: "hysteria2",
			server: node.host,
			port: node.port,
			password: node.password,
			sni: node.sni,
			"skip-cert-verify": Boolean(node.insecure)
		};
		case "tuic": return {
			name,
			type: "tuic",
			server: node.host,
			port: node.port,
			uuid: node.uuid,
			password: node.password,
			sni: node.sni,
			alpn: node.alpn ? node.alpn.split(",") : void 0,
			udp: true
		};
		default: return {
			name,
			type: node.protocol,
			server: node.host,
			port: node.port
		};
	}
}
function applyNetworkOpts(obj, node) {
	const net = node.network || "tcp";
	if (net === "ws") obj["ws-opts"] = {
		path: node.path || "/",
		...node.hostHeader ? { headers: { Host: node.hostHeader } } : {}
	};
	else if (net === "grpc") obj["grpc-opts"] = { "grpc-service-name": node.serviceName || "" };
	else if (net === "httpupgrade") {
		obj["smux"] = { enabled: false };
		obj["ws-opts"] = void 0;
		obj["http-opts"] = {
			path: [node.path || "/"],
			...node.hostHeader ? { headers: { Host: [node.hostHeader] } } : {}
		};
		obj.network = "httpupgrade";
	} else if (net === "splithttp" || net === "xhttp") {
		obj.network = "splithttp";
		obj["splithttp-opts"] = {
			path: node.path || "/",
			host: node.hostHeader || ""
		};
	}
}
function buildMihomoYaml(nodes, sources) {
	const used = /* @__PURE__ */ new Set();
	const named = [];
	for (const node of nodes) {
		const base = `${node.country || "XX"} ${node.protocol} ${node.host.split(".")[0]}`;
		named.push({
			node,
			name: uniqueName(base, used)
		});
	}
	const bySource = /* @__PURE__ */ new Map();
	for (const { node, name } of named) {
		const list = bySource.get(node.sourceId) ?? [];
		list.push(name);
		bySource.set(node.sourceId, list);
	}
	const sourceMeta = new Map(sources.map((s) => [s.id, s]));
	const sourceGroupNames = [];
	const groupLines = [];
	for (const [id, names] of bySource) {
		if (names.length === 0) continue;
		const gname = `SRC ${sourceMeta.get(id)?.name || id}`.slice(0, 40);
		sourceGroupNames.push(gname);
		groupLines.push(`  - name: ${q(gname)}`);
		groupLines.push(`    type: url-test`);
		groupLines.push(`    url: "https://www.gstatic.com/generate_204"`);
		groupLines.push(`    interval: 120`);
		groupLines.push(`    tolerance: 80`);
		groupLines.push(`    lazy: true`);
		groupLines.push(`    proxies:`);
		for (const n of names) groupLines.push(`      - ${q(n)}`);
	}
	const allNames = named.map((n) => n.name);
	const yaml = [
		`# Relay · generated ${(/* @__PURE__ */ new Date()).toISOString()}`,
		`# url-test inside each source, fallback across sources`,
		`mixed-port: 7890`,
		`allow-lan: false`,
		`mode: rule`,
		`log-level: warning`,
		`ipv6: true`,
		`unified-delay: true`,
		`tcp-concurrent: true`,
		`external-controller: 127.0.0.1:9090`,
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
		const obj = nodeClashObject(node, name);
		yaml.push(`  - name: ${q(name)}`);
		yaml.push(...indent(obj, 4).filter((l) => !l.trimStart().startsWith("name:")));
	}
	yaml.push(``);
	yaml.push(`proxy-groups:`);
	yaml.push(`  - name: ${q("RELAY")}`);
	yaml.push(`    type: select`);
	yaml.push(`    proxies:`);
	yaml.push(`      - ${q("AUTO")}`);
	yaml.push(`      - ${q("FALLBACK")}`);
	for (const g of sourceGroupNames) yaml.push(`      - ${q(g)}`);
	yaml.push(`      - ${q("DIRECT")}`);
	yaml.push(`  - name: ${q("AUTO")}`);
	yaml.push(`    type: url-test`);
	yaml.push(`    url: "https://www.gstatic.com/generate_204"`);
	yaml.push(`    interval: 90`);
	yaml.push(`    tolerance: 50`);
	yaml.push(`    lazy: true`);
	yaml.push(`    proxies:`);
	for (const n of allNames.length ? allNames : ["DIRECT"]) yaml.push(`      - ${q(n)}`);
	yaml.push(`  - name: ${q("FALLBACK")}`);
	yaml.push(`    type: fallback`);
	yaml.push(`    url: "https://www.gstatic.com/generate_204"`);
	yaml.push(`    interval: 60`);
	yaml.push(`    lazy: true`);
	yaml.push(`    proxies:`);
	const fallbackMembers = sourceGroupNames.length ? sourceGroupNames : ["AUTO"];
	for (const n of fallbackMembers) yaml.push(`      - ${q(n)}`);
	yaml.push(...groupLines);
	yaml.push(``);
	yaml.push(`rules:`);
	yaml.push(`  - MATCH,RELAY`);
	yaml.push(``);
	return yaml.join("\n");
}
function buildUriList(nodes) {
	return nodes.map((n) => n.uri).join("\n") + "\n";
}
function buildB64Subscription(nodes) {
	const body = buildUriList(nodes);
	if (typeof Buffer !== "undefined") return Buffer.from(body, "utf8").toString("base64");
	const bytes = new TextEncoder().encode(body);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-CX07c6yK.js
var router_CX07c6yK_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var TooltipProvider = Provider;
var TooltipContent = import_react.forwardRef(({ className, sideOffset = 6, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
	ref,
	sideOffset,
	className: cn("z-50 overflow-hidden rounded-md bg-fg px-2.5 py-1.5 text-xs text-bg shadow-md", className),
	...props
}) }));
TooltipContent.displayName = Content2.displayName;
function Toaster$1() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		theme: "dark",
		toastOptions: { classNames: {
			toast: "bg-surface text-fg shadow-[var(--shadow-border)] border-0",
			title: "text-fg",
			description: "text-fg-muted"
		} }
	});
}
function AppProviders({ children }) {
	const [client] = (0, import_react.useState)(() => new QueryClient({ defaultOptions: { queries: {
		refetchOnWindowFocus: false,
		retry: 1
	} } }));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TooltipProvider, {
			delayDuration: 200,
			children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {})]
		})
	});
}
var styles_default = "/assets/styles-CGGQXEza.css";
var APP_NAME = "Relay";
var Route$2 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Живой пул бесплатных VPN-подписок. Relay проверяет списки, отбрасывает мёртвые и собирает конфиг для Hiddify и Mihomo."
			},
			{
				name: "theme-color",
				content: "#09090b"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "ru",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "min-h-dvh bg-bg text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppProviders, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter = () => import("./routes-uW3S1AA2.mjs");
var Route$1 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
function cors(headers) {
	headers.set("access-control-allow-origin", "*");
	headers.set("access-control-allow-methods", "GET, OPTIONS");
	headers.set("access-control-allow-headers", "*");
}
var Route = createFileRoute("/api/sub")({ server: { handlers: {
	OPTIONS: async () => {
		const headers = new Headers();
		cors(headers);
		return new Response(null, {
			status: 204,
			headers
		});
	},
	GET: async ({ request }) => {
		const url = new URL(request.url);
		const packed = url.searchParams.get("u") ?? "";
		const fmt = (url.searchParams.get("fmt") ?? "clash").toLowerCase();
		const limit = Math.min(40, Math.max(4, Number(url.searchParams.get("n") || 20) || 20));
		const urls = decodeSourceParam(packed);
		if (urls.length === 0) {
			const headers = new Headers({ "content-type": "text/plain; charset=utf-8" });
			cors(headers);
			return new Response("Relay subscription\nPass ?u=<encoded sources>&fmt=clash|uri|b64\n", {
				status: 400,
				headers
			});
		}
		const sources = urls.map((u, i) => ({
			id: `s${i}`,
			name: `src-${i + 1}`,
			url: u,
			enabled: true
		}));
		const result = await runScan(sources, {
			perSource: 14,
			globalCap: 56,
			timeoutMs: 2e3
		});
		const nodes = pickExportNodes(result, limit);
		const headers = new Headers();
		cors(headers);
		headers.set("cache-control", "public, max-age=60");
		headers.set("profile-update-interval", "1");
		headers.set("content-disposition", "attachment; filename=\"relay.yaml\"");
		if (fmt === "uri") {
			headers.set("content-type", "text/plain; charset=utf-8");
			headers.set("profile-title", "Relay");
			return new Response(buildUriList(nodes), { headers });
		}
		if (fmt === "b64") {
			headers.set("content-type", "text/plain; charset=utf-8");
			return new Response(buildB64Subscription(nodes), { headers });
		}
		headers.set("content-type", "text/yaml; charset=utf-8");
		headers.set("profile-title", "Relay");
		return new Response(buildMihomoYaml(nodes, result.sources), { headers });
	}
} } });
var rootRouteChildren = {
	IndexRoute: Route$1.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$2
	}),
	ApiSubRoute: Route.update({
		id: "/api/sub",
		path: "/api/sub",
		getParentRoute: () => Route$2
	})
};
var routeTree = Route$2._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { encodeSourceParam as a, pickActive as c, getRouter, cn as i, pickExportNodes as l, buildMihomoYaml as n, formatMs as o, buildUriList as r, normalizeSourceUrl as s, router_CX07c6yK_exports as t, sourceNameFromUrl as u };
