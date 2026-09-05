import { i as canRunMihomo, r as __exportAll } from "./mihomo-bin.server-BqQnOcsW.mjs";
import net from "node:net";
//#region node_modules/.nitro/vite/services/ssr/assets/scan.server-DqwgDPZX.js
var NAME_TO_CC = [
	[/\b(netherlands|нидерланды|holland|\bnl\b)/i, "NL"],
	[/\b(germany|германия|\bde\b|frankfurt|berlin)/i, "DE"],
	[/\b(russia|россия|\bru\b|moscow|москва)/i, "RU"],
	[/\b(finland|финляндия|\bfi\b)/i, "FI"],
	[/\b(france|франция|\bfr\b)/i, "FR"],
	[/\b(poland|польша|\bpl\b)/i, "PL"],
	[/\b(switzerland|швейцария|\bch\b)/i, "CH"],
	[/\b(sweden|швеция|\bse\b)/i, "SE"],
	[/\b(norway|норвегия|\bno\b)/i, "NO"],
	[/\b(austria|австрия|\bat\b)/i, "AT"],
	[/\b(italy|италия|\bit\b)/i, "IT"],
	[/\b(spain|испания|\bes\b)/i, "ES"],
	[/\b(uk|united kingdom|britain|великобритан|\bgb\b)/i, "GB"],
	[/\b(usa|united states|america|\bus\b)/i, "US"],
	[/\b(canada|\bca\b)/i, "CA"],
	[/\b(japan|япония|\bjp\b)/i, "JP"],
	[/\b(korea|корея|\bkr\b)/i, "KR"],
	[/\b(singapore|сингапур|\bsg\b)/i, "SG"],
	[/\b(hong.?kong|гонконг|\bhk\b)/i, "HK"],
	[/\b(taiwan|тайвань|\btw\b)/i, "TW"],
	[/\b(turkey|турция|\btr\b)/i, "TR"],
	[/\b(uae|emirates|дубай|\bae\b)/i, "AE"],
	[/\b(latvia|латвия|\blv\b)/i, "LV"],
	[/\b(lithuania|литва|\blt\b)/i, "LT"],
	[/\b(estonia|эстония|\bee\b)/i, "EE"],
	[/\b(ukraine|украина|\bua\b)/i, "UA"],
	[/\b(kazakhstan|казахстан|\bkz\b)/i, "KZ"],
	[/\b(czech|чехия|\bcz\b)/i, "CZ"],
	[/\b(romania|румыния|\bro\b)/i, "RO"],
	[/\b(bulgaria|болгария|\bbg\b)/i, "BG"],
	[/\b(hungary|венгрия|\bhu\b)/i, "HU"],
	[/\b(portugal|португалия|\bpt\b)/i, "PT"],
	[/\b(ireland|ирландия|\bie\b)/i, "IE"],
	[/\b(belgium|бельгия|\bbe\b)/i, "BE"],
	[/\b(denmark|дания|\bdk\b)/i, "DK"],
	[/\b(australia|\bau\b)/i, "AU"],
	[/\b(brazil|бразилия|\bbr\b)/i, "BR"],
	[/\b(india|индия|\bin\b)/i, "IN"],
	[/\b(moldova|молдова|\bmd\b)/i, "MD"],
	[/\b(iran|иран|\bir\b)/i, "IR"],
	[/\b(china|китай|\bcn\b)/i, "CN"],
	[/\b(vietnam|вьетнам|\bvn\b)/i, "VN"]
];
var VALID_CC = new Set(NAME_TO_CC.map(([, cc]) => cc));
function decode(raw) {
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}
function countryFromRemark(remark) {
	const text = decode(remark);
	const flag = flagToCc(text);
	if (flag && VALID_CC.has(flag)) return flag;
	for (const [re, cc] of NAME_TO_CC) if (re.test(text)) return cc;
	const tagged = text.match(/(?:^|[^\w])([A-Z]{2})(?:[^\w]|$)/);
	if (tagged && tagged[1] && VALID_CC.has(tagged[1])) return tagged[1];
	return null;
}
function flagToCc(text) {
	const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
	if (!match) return null;
	const a = match[0].codePointAt(0);
	const b = match[0].codePointAt(1);
	if (a === void 0 || b === void 0) return null;
	return String.fromCharCode(a - 127462 + 65, b - 127462 + 65);
}
function cleanRemark(raw) {
	let s = decode(raw);
	s = s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ");
	s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ");
	s = s.replace(/\s+/g, " ").replace(/[|┃·]+/g, " · ").trim();
	s = s.replace(/t\.me\/\S+/gi, "").trim();
	s = s.replace(/join\s*\+?\s*telegram:@\S+/gi, "").trim();
	s = s.replace(/@\w+/g, "").trim();
	if (s.length > 48) s = s.slice(0, 46).trim() + "…";
	return s || "node";
}
var PROTO_RE = /^(vless|vmess|ss|trojan|hysteria2|hy2|tuic):\/\/\S+/i;
function nodeId(parts) {
	return parts.map((p) => String(p ?? "").toLowerCase()).join("|").replace(/[^a-z0-9.|:_-]/g, "").slice(0, 180);
}
function decodeHtml(s) {
	return s.replace(/&/g, "&").replace(/"/g, "\"").replace(/&#39;/g, "'").replace(/</g, "<").replace(/>/g, ">");
}
function tryB64(s) {
	const clean = s.replace(/\s+/g, "");
	if (!/^[A-Za-z0-9+/_=-]+$/.test(clean) || clean.length < 16) return null;
	try {
		const normalized = clean.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
		const text = typeof Buffer !== "undefined" ? Buffer.from(padded, "base64").toString("utf8") : decodeURIComponent(Array.from(atob(padded), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
		if (text.includes("://") || text.includes("{")) return text;
		return text;
	} catch {
		return null;
	}
}
function parseQuery(search) {
	const out = {};
	const q = search.startsWith("?") ? search.slice(1) : search;
	for (const part of q.split("&")) {
		if (!part) continue;
		const eq = part.indexOf("=");
		const k = eq === -1 ? part : part.slice(0, eq);
		const v = eq === -1 ? "" : part.slice(eq + 1);
		try {
			out[decodeURIComponent(k)] = decodeURIComponent(v);
		} catch {
			out[k] = v;
		}
	}
	return out;
}
function splitHash(line) {
	const hash = line.indexOf("#");
	if (hash === -1) return {
		body: line,
		remark: ""
	};
	return {
		body: line.slice(0, hash),
		remark: line.slice(hash + 1)
	};
}
function parseHostPort(authority) {
	const v6 = authority.match(/^\[([^\]]+)\]:(\d+)$/);
	if (v6) return {
		host: v6[1],
		port: Number(v6[2])
	};
	const last = authority.lastIndexOf(":");
	if (last === -1) return null;
	const host = authority.slice(0, last);
	const port = Number(authority.slice(last + 1));
	if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) return null;
	return {
		host,
		port
	};
}
function mapNetwork(type) {
	const t = (type || "tcp").toLowerCase();
	if (t === "xhttp" || t === "splithttp") return "splithttp";
	if (t === "raw") return "tcp";
	if (t === "h2") return "h2";
	if (t === "httpupgrade") return "httpupgrade";
	return t;
}
function parseVless(line, sourceId, sourceName) {
	const { body, remark } = splitHash(line);
	const rest = body.slice(8);
	const qIdx = rest.indexOf("?");
	const main = qIdx === -1 ? rest : rest.slice(0, qIdx);
	const query = qIdx === -1 ? "" : rest.slice(qIdx + 1);
	const at = main.lastIndexOf("@");
	if (at === -1) return null;
	const uuid = main.slice(0, at);
	const hp = parseHostPort(main.slice(at + 1));
	if (!uuid || !hp) return null;
	const p = parseQuery(query);
	const name = cleanRemark(remark || `${hp.host}:${hp.port}`);
	const network = mapNetwork(p.type || p.network);
	return {
		id: nodeId([
			"vless",
			hp.host,
			hp.port,
			uuid,
			network,
			p.path,
			p.security
		]),
		uri: line,
		protocol: "vless",
		name,
		host: hp.host,
		port: hp.port,
		country: countryFromRemark(remark + " " + name),
		sourceId,
		sourceName,
		uuid,
		security: p.security,
		network,
		flow: p.flow,
		sni: p.sni || p.servername,
		fp: p.fp,
		alpn: p.alpn,
		pbk: p.pbk,
		sid: p.sid,
		path: p.path,
		hostHeader: p.host,
		serviceName: p.serviceName || p.servicename,
		extra: p
	};
}
function parseTrojan(line, sourceId, sourceName) {
	const { body, remark } = splitHash(line);
	const rest = body.slice(9);
	const qIdx = rest.indexOf("?");
	const main = qIdx === -1 ? rest : rest.slice(0, qIdx);
	const query = qIdx === -1 ? "" : rest.slice(qIdx + 1);
	const at = main.lastIndexOf("@");
	if (at === -1) return null;
	const password = decodeURIComponent(main.slice(0, at));
	const hp = parseHostPort(main.slice(at + 1));
	if (!password || !hp) return null;
	const p = parseQuery(query);
	const name = cleanRemark(remark || `${hp.host}:${hp.port}`);
	const network = mapNetwork(p.type || p.network || "tcp");
	return {
		id: nodeId([
			"trojan",
			hp.host,
			hp.port,
			password,
			network
		]),
		uri: line,
		protocol: "trojan",
		name,
		host: hp.host,
		port: hp.port,
		country: countryFromRemark(remark + " " + name),
		sourceId,
		sourceName,
		password,
		security: p.security || "tls",
		network,
		sni: p.sni || p.peer,
		fp: p.fp,
		alpn: p.alpn,
		pbk: p.pbk,
		sid: p.sid,
		path: p.path,
		hostHeader: p.host,
		extra: p
	};
}
function parseHysteria2(line, sourceId, sourceName) {
	const { body, remark } = splitHash(line);
	const scheme = body.startsWith("hy2://") ? "hy2://" : "hysteria2://";
	const rest = body.slice(scheme.length);
	const qIdx = rest.indexOf("?");
	const main = qIdx === -1 ? rest : rest.slice(0, qIdx);
	const query = qIdx === -1 ? "" : rest.slice(qIdx + 1);
	const at = main.lastIndexOf("@");
	if (at === -1) return null;
	const password = decodeURIComponent(main.slice(0, at));
	const hp = parseHostPort(main.slice(at + 1));
	if (!hp) return null;
	const p = parseQuery(query);
	const name = cleanRemark(remark || `${hp.host}:${hp.port}`);
	return {
		id: nodeId([
			"hysteria2",
			hp.host,
			hp.port,
			password
		]),
		uri: line.replace(/^hy2:\/\//, "hysteria2://"),
		protocol: "hysteria2",
		name,
		host: hp.host,
		port: hp.port,
		country: countryFromRemark(remark + " " + name),
		sourceId,
		sourceName,
		password,
		sni: p.sni || p.peer,
		insecure: p.insecure === "1" || p.insecure === "true",
		extra: p
	};
}
function parseTuic(line, sourceId, sourceName) {
	const { body, remark } = splitHash(line);
	const rest = body.slice(7);
	const qIdx = rest.indexOf("?");
	const main = qIdx === -1 ? rest : rest.slice(0, qIdx);
	const query = qIdx === -1 ? "" : rest.slice(qIdx + 1);
	const at = main.lastIndexOf("@");
	if (at === -1) return null;
	const userinfo = main.slice(0, at);
	const hp = parseHostPort(main.slice(at + 1));
	if (!hp) return null;
	const [uuid, password] = userinfo.split(":");
	const p = parseQuery(query);
	const name = cleanRemark(remark || `${hp.host}:${hp.port}`);
	return {
		id: nodeId([
			"tuic",
			hp.host,
			hp.port,
			uuid,
			password
		]),
		uri: line,
		protocol: "tuic",
		name,
		host: hp.host,
		port: hp.port,
		country: countryFromRemark(remark + " " + name),
		sourceId,
		sourceName,
		uuid,
		password,
		sni: p.sni,
		alpn: p.alpn,
		extra: p
	};
}
function parseSs(line, sourceId, sourceName) {
	const { body, remark } = splitHash(line);
	let rest = body.slice(5);
	let method = "";
	let password = "";
	let authority = "";
	if (rest.includes("@")) {
		const at = rest.lastIndexOf("@");
		const userinfo = rest.slice(0, at);
		authority = rest.slice(at + 1);
		if (userinfo.includes(":")) {
			const colon = userinfo.indexOf(":");
			method = decodeURIComponent(userinfo.slice(0, colon));
			password = decodeURIComponent(userinfo.slice(colon + 1));
		} else {
			const decoded = tryB64(userinfo);
			if (decoded && decoded.includes(":")) {
				const colon = decoded.indexOf(":");
				method = decoded.slice(0, colon);
				password = decoded.slice(colon + 1);
			}
		}
	} else {
		const decoded = tryB64(rest);
		if (!decoded) return null;
		const at = decoded.lastIndexOf("@");
		if (at === -1) return null;
		const userinfo = decoded.slice(0, at);
		authority = decoded.slice(at + 1);
		const colon = userinfo.indexOf(":");
		method = userinfo.slice(0, colon);
		password = userinfo.slice(colon + 1);
	}
	const qIdx = authority.indexOf("?");
	if (qIdx !== -1) authority = authority.slice(0, qIdx);
	const hp = parseHostPort(authority);
	if (!hp || !method || !password) return null;
	const name = cleanRemark(remark || `${hp.host}:${hp.port}`);
	return {
		id: nodeId([
			"ss",
			hp.host,
			hp.port,
			method,
			password
		]),
		uri: line,
		protocol: "ss",
		name,
		host: hp.host,
		port: hp.port,
		country: countryFromRemark(remark + " " + name),
		sourceId,
		sourceName,
		method,
		password,
		extra: {}
	};
}
function parseVmess(line, sourceId, sourceName) {
	const decoded = tryB64(line.slice(8));
	if (!decoded) return null;
	try {
		const j = JSON.parse(decoded);
		const host = String(j.add || j.host || "");
		const port = Number(j.port);
		const uuid = String(j.id || "");
		if (!host || !port || !uuid) return null;
		const remark = String(j.ps || j.remark || `${host}:${port}`);
		const name = cleanRemark(remark);
		const network = mapNetwork(String(j.net || "tcp"));
		const tls = String(j.tls || "");
		return {
			id: nodeId([
				"vmess",
				host,
				port,
				uuid,
				network,
				String(j.path || "")
			]),
			uri: line,
			protocol: "vmess",
			name,
			host,
			port,
			country: countryFromRemark(remark),
			sourceId,
			sourceName,
			uuid,
			aid: String(j.aid ?? "0"),
			security: tls ? "tls" : "none",
			network,
			sni: String(j.sni || j.host || ""),
			path: String(j.path || ""),
			hostHeader: String(j.host || ""),
			extra: {
				scy: String(j.scy || j.security || "auto"),
				tls,
				type: String(j.type || "")
			}
		};
	} catch {
		return null;
	}
}
function parseUriLine(line, sourceId, sourceName) {
	const trimmed = decodeHtml(line.trim());
	if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
	const lower = trimmed.toLowerCase();
	try {
		if (lower.startsWith("vless://")) return parseVless(trimmed, sourceId, sourceName);
		if (lower.startsWith("vmess://")) return parseVmess(trimmed, sourceId, sourceName);
		if (lower.startsWith("ss://")) return parseSs(trimmed, sourceId, sourceName);
		if (lower.startsWith("trojan://")) return parseTrojan(trimmed, sourceId, sourceName);
		if (lower.startsWith("hysteria2://") || lower.startsWith("hy2://")) return parseHysteria2(trimmed, sourceId, sourceName);
		if (lower.startsWith("tuic://")) return parseTuic(trimmed, sourceId, sourceName);
	} catch {
		return null;
	}
	return null;
}
function parseSubscription(raw, sourceId, sourceName) {
	let text = raw.replace(/^\uFEFF/, "").trim();
	const maybe = tryB64(text);
	if (maybe && PROTO_RE.test(maybe.trim().split(/\r?\n/)[0] ?? "")) text = maybe;
	const nodes = [];
	const seen = /* @__PURE__ */ new Set();
	for (const line of text.split(/\r?\n/)) {
		const node = parseUriLine(line, sourceId, sourceName);
		if (!node) continue;
		if (seen.has(node.id)) continue;
		seen.add(node.id);
		nodes.push(node);
	}
	return nodes;
}
function endpointKey(node) {
	return `${node.host.toLowerCase()}:${node.port}`;
}
function protocolRank(p) {
	switch (p) {
		case "vless": return 0;
		case "hysteria2": return 1;
		case "trojan": return 2;
		case "ss": return 3;
		case "vmess": return 4;
		case "tuic": return 5;
		default: return 9;
	}
}
var fetchCache = /* @__PURE__ */ new Map();
var FETCH_TTL = 6e4;
async function fetchSourceText(url) {
	const hit = fetchCache.get(url);
	if (hit && Date.now() - hit.at < FETCH_TTL) return hit.text;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 12e3);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: {
				accept: "text/plain,text/*,*/*",
				"user-agent": "Relay/1.0 (subscription aggregator)"
			},
			redirect: "follow"
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.byteLength > 35e5) throw new Error("Список слишком большой");
		let text = buf.toString("utf8");
		if (text.includes("\0")) throw new Error("Бинарный файл, нужен текстовый список URI");
		fetchCache.set(url, {
			at: Date.now(),
			text
		});
		return text;
	} finally {
		clearTimeout(timer);
	}
}
var cache = /* @__PURE__ */ new Map();
var CACHE_MS = 9e4;
function tcpPing(host, port, timeoutMs) {
	return new Promise((resolve) => {
		const start = Date.now();
		let settled = false;
		const finish = (ms) => {
			if (settled) return;
			settled = true;
			try {
				socket.destroy();
			} catch {}
			resolve(ms);
		};
		const socket = net.connect({
			host,
			port,
			family: 0
		});
		socket.setTimeout(timeoutMs);
		socket.once("connect", () => finish(Date.now() - start));
		socket.once("timeout", () => finish(null));
		socket.once("error", () => finish(null));
	});
}
async function mapPool(items, limit, fn) {
	const out = new Array(items.length);
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
async function probeNodes(nodes, timeoutMs) {
	const now = Date.now();
	return mapPool(nodes, 18, async (node) => {
		const key = endpointKey(node);
		const hit = cache.get(key);
		if (hit && now - hit.at < CACHE_MS) return {
			...node,
			latency: hit.latency,
			alive: hit.latency !== null
		};
		const latency = await tcpPing(node.host, node.port, timeoutMs);
		cache.set(key, {
			at: Date.now(),
			latency
		});
		return {
			...node,
			latency,
			alive: latency !== null
		};
	});
}
function sampleForProbe(nodes, perSource, globalCap) {
	const bySource = /* @__PURE__ */ new Map();
	for (const n of nodes) {
		const list = bySource.get(n.sourceId) ?? [];
		list.push(n);
		bySource.set(n.sourceId, list);
	}
	const picked = [];
	for (const list of bySource.values()) {
		const unique = uniqueEndpoints(list);
		unique.sort((a, b) => {
			const portA = a.port === 443 ? 0 : 1;
			const portB = b.port === 443 ? 0 : 1;
			if (portA !== portB) return portA - portB;
			const pr = protocolRank(a.protocol) - protocolRank(b.protocol);
			if (pr !== 0) return pr;
			return a.host.localeCompare(b.host);
		});
		picked.push(...unique.slice(0, perSource));
	}
	if (picked.length <= globalCap) return picked;
	const out = [];
	const buckets = /* @__PURE__ */ new Map();
	for (const n of picked) {
		const list = buckets.get(n.sourceId) ?? [];
		list.push(n);
		buckets.set(n.sourceId, list);
	}
	const ids = [...buckets.keys()];
	let i = 0;
	while (out.length < globalCap) {
		let added = false;
		for (const id of ids) {
			const bucket = buckets.get(id);
			if (!bucket || i >= bucket.length) continue;
			out.push(bucket[i]);
			added = true;
			if (out.length >= globalCap) break;
		}
		if (!added) break;
		i += 1;
	}
	return out;
}
function uniqueEndpoints(list) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const sorted = [...list].sort((a, b) => protocolRank(a.protocol) - protocolRank(b.protocol));
	for (const n of sorted) {
		const key = endpointKey(n);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(n);
	}
	return out;
}
var scan_server_exports = /* @__PURE__ */ __exportAll({ runScan: () => runScan });
async function runScan(sources, opts) {
	const perSource = opts?.perSource ?? 16;
	const globalCap = opts?.globalCap ?? 64;
	const timeoutMs = opts?.timeoutMs ?? 2200;
	const wantReal = opts?.real !== false;
	const started = Date.now();
	const enabled = sources.filter((s) => s.enabled);
	const fetched = await Promise.all(enabled.map(async (source) => {
		try {
			return {
				source,
				nodes: parseSubscription(await fetchSourceText(source.url), source.id, source.name),
				error: null
			};
		} catch (err) {
			return {
				source,
				nodes: [],
				error: err instanceof Error ? err.message : "fetch failed"
			};
		}
	}));
	const allNodes = fetched.flatMap((f) => f.nodes);
	const uniqueTotal = new Set(allNodes.map(endpointKey)).size;
	const sampled = sampleForProbe(allNodes, perSource, globalCap);
	let probeMode = "tcp";
	let testUrl = null;
	let probeNote = null;
	let probed;
	if (wantReal && canRunMihomo()) try {
		const { probeNodesMihomo } = await import("./mihomo-probe.server-DgyvD2Lu.mjs");
		const real = await probeNodesMihomo(sampled, opts?.testUrl || "https://www.youtube.com/generate_204");
		probed = real.nodes;
		probeMode = "mihomo";
		testUrl = real.testUrl;
		probeNote = real.note;
	} catch (err) {
		probed = await probeNodes(sampled, timeoutMs);
		probeMode = "tcp";
		probeNote = err instanceof Error ? `Настоящая проверка не стартовала: ${err.message}. Осталась проверка порта.` : "Настоящая проверка не стартовала. Осталась проверка порта.";
	}
	else {
		probed = await probeNodes(sampled, timeoutMs);
		if (wantReal) probeNote = "На этом хосте нельзя запустить ядро — проверка порта.";
	}
	const sourcesOut = fetched.map((f) => {
		const mine = probed.filter((n) => n.sourceId === f.source.id);
		const alive = mine.filter((n) => n.alive);
		const latencies = alive.map((n) => n.latency).filter((x) => x !== null);
		return {
			id: f.source.id,
			name: f.source.name,
			url: f.source.url,
			ok: f.error === null,
			error: f.error,
			parsed: f.nodes.length,
			unique: new Set(f.nodes.map(endpointKey)).size,
			probed: mine.length,
			alive: alive.length,
			bestLatency: latencies.length ? Math.min(...latencies) : null
		};
	});
	probed.sort((a, b) => {
		if (a.alive !== b.alive) return a.alive ? -1 : 1;
		return (a.latency ?? 99999) - (b.latency ?? 99999);
	});
	return {
		scannedAt: Date.now(),
		durationMs: Date.now() - started,
		sources: sourcesOut,
		nodes: probed,
		parsedTotal: allNodes.length,
		uniqueTotal,
		probeMode,
		testUrl,
		probeNote
	};
}
//#endregion
export { scan_server_exports as n, endpointKey as r, runScan as t };
