//#region node_modules/.nitro/vite/services/ssr/assets/mihomo-BZFtDaS-.js
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
function clashProxyObject(node, name) {
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
		groupLines.push(`    url: "https://www.youtube.com/generate_204"`);
		groupLines.push(`    interval: 120`);
		groupLines.push(`    tolerance: 80`);
		groupLines.push(`    expected-status: 204`);
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
		const obj = clashProxyObject(node, name);
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
	yaml.push(`    url: "https://www.youtube.com/generate_204"`);
	yaml.push(`    interval: 90`);
	yaml.push(`    tolerance: 50`);
	yaml.push(`    expected-status: 204`);
	yaml.push(`    lazy: true`);
	yaml.push(`    proxies:`);
	for (const n of allNames.length ? allNames : ["DIRECT"]) yaml.push(`      - ${q(n)}`);
	yaml.push(`  - name: ${q("FALLBACK")}`);
	yaml.push(`    type: fallback`);
	yaml.push(`    url: "https://www.youtube.com/generate_204"`);
	yaml.push(`    interval: 60`);
	yaml.push(`    expected-status: 204`);
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
export { clashProxyObject as i, buildMihomoYaml as n, buildUriList as r, buildB64Subscription as t };
