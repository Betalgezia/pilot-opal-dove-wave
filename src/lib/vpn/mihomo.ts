import type { ParsedNode, ProbedNode, SourceScan } from "./types";

const ALPN_ALLOWED = new Set(["h2", "http/1.1", "h3"]);
const XHTTP_MODES = new Set(["auto", "stream-one", "stream-up", "packet-up"]);

function q(value: string): string {
  return JSON.stringify(value.trim());
}

function cleanText(value: string | null | undefined, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function alpnValues(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => ALPN_ALLOWED.has(item));
}

function indent(obj: Record<string, unknown>, level = 2): string[] {
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

function uniqueName(base: string, used: Set<string>): string {
  let name = cleanText(base).slice(0, 40) || "node";
  let n = 2;
  while (used.has(name)) {
    name = `${cleanText(base).slice(0, 36)}-${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}

function embeddedExtra(node: ParsedNode): Record<string, unknown> {
  const raw = node.extra?.extra;
  if (!raw || raw === "null") return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

function boolValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === "true";
  return undefined;
}

function addXhttpExtra(out: Record<string, unknown>, extra: Record<string, unknown>): void {
  const map: Array<[string, string]> = [
    ["xPaddingBytes", "x-padding-bytes"],
    ["xPaddingKey", "x-padding-key"],
    ["xPaddingHeader", "x-padding-header"],
    ["xPaddingPlacement", "x-padding-placement"],
    ["xPaddingMethod", "x-padding-method"],
    ["uplinkHTTPMethod", "uplink-http-method"],
    ["sessionPlacement", "session-placement"],
    ["sessionKey", "session-key"],
    ["sessionTable", "session-table"],
    ["sessionLength", "session-length"],
    ["seqPlacement", "seq-placement"],
    ["seqKey", "seq-key"],
    ["uplinkDataPlacement", "uplink-data-placement"],
    ["uplinkDataKey", "uplink-data-key"],
    ["uplinkChunkSize", "uplink-chunk-size"],
    ["noGRPCHeader", "no-grpc-header"],
    ["noSSEHeader", "no-sse-header"],
    ["scMaxEachPostBytes", "sc-max-each-post-bytes"],
    ["scMinPostsIntervalMs", "sc-min-posts-interval-ms"],
  ];
  for (const [from, to] of map) {
    const value = extra[from];
    const text = textValue(value);
    if (text !== undefined) out[to] = text;
    const bool = boolValue(value);
    if (bool !== undefined) out[to] = bool;
    if (typeof value === "number") out[to] = value;
  }
  const paddingObfs = boolValue(extra.xPaddingObfsMode);
  if (paddingObfs !== undefined) out["x-padding-obfs-mode"] = paddingObfs;
  const mode = textValue(extra.mode)?.toLowerCase();
  if (mode && XHTTP_MODES.has(mode)) out.mode = mode;
  const nestedXmux = extra.xmux;
  if (nestedXmux && typeof nestedXmux === "object" && !Array.isArray(nestedXmux)) {
    const xmux = nestedXmux as Record<string, unknown>;
    const reuse: Record<string, unknown> = {};
    const reuseMap: Array<[string, string]> = [
      ["maxConcurrency", "max-concurrency"],
      ["maxConnections", "max-connections"],
      ["cMaxReuseTimes", "c-max-reuse-times"],
      ["hMaxRequestTimes", "h-max-request-times"],
      ["hMaxReusableSecs", "h-max-reusable-secs"],
      ["hKeepAlivePeriod", "h-keep-alive-period"],
    ];
    for (const [from, to] of reuseMap) {
      const value = xmux[from];
      if (typeof value === "string" && value.trim()) reuse[to] = value.trim();
      else if (typeof value === "number") reuse[to] = value;
    }
    if (Object.keys(reuse).length) out["reuse-settings"] = reuse;
  }
}

export function clashProxyObject(node: ParsedNode, name: string): Record<string, unknown> {
  const protocol = cleanText(node.protocol).toLowerCase();
  switch (protocol) {
    case "vless": {
      const obj: Record<string, unknown> = {
        name: cleanText(name),
        type: "vless",
        server: cleanText(node.host),
        port: node.port,
        uuid: cleanText(node.uuid),
        udp: true,
        network: cleanText(node.network, "tcp").toLowerCase(),
      };
      if (node.flow) obj.flow = cleanText(node.flow).replace(/-udp443$/, "");
      const packetEncoding = cleanText(node.extra.packetEncoding).toLowerCase();
      if (packetEncoding === "xudp" || packetEncoding === "packetaddr") obj["packet-encoding"] = packetEncoding;
      const security = cleanText(node.security).toLowerCase();
      const tls = security === "tls" || security === "reality" || Boolean(cleanText(node.sni)) || Boolean(node.pbk);
      if (tls) obj.tls = true;
      if (node.sni) obj.servername = cleanText(node.sni);
      if (node.fp) obj["client-fingerprint"] = cleanText(node.fp);
      const alpn = alpnValues(node.alpn);
      if (alpn.length) obj.alpn = alpn;
      if (node.insecure) obj["skip-cert-verify"] = true;
      if (security === "reality" && node.pbk) {
        obj["reality-opts"] = {
          "public-key": cleanText(node.pbk),
          "short-id": cleanText(node.sid),
        };
      }
      applyNetworkOpts(obj, node);
      return obj;
    }
    case "trojan": {
      const obj: Record<string, unknown> = {
        name: cleanText(name),
        type: "trojan",
        server: cleanText(node.host),
        port: node.port,
        password: cleanText(node.password),
        udp: true,
        network: cleanText(node.network, "tcp").toLowerCase(),
        tls: true,
      };
      if (node.sni) obj.sni = cleanText(node.sni);
      if (node.fp) obj["client-fingerprint"] = cleanText(node.fp);
      const alpn = alpnValues(node.alpn);
      if (alpn.length) obj.alpn = alpn;
      if (node.insecure) obj["skip-cert-verify"] = true;
      const security = cleanText(node.security).toLowerCase();
      if (security === "reality" && node.pbk) {
        obj["reality-opts"] = {
          "public-key": cleanText(node.pbk),
          "short-id": cleanText(node.sid),
        };
      }
      applyNetworkOpts(obj, node);
      return obj;
    }
    case "ss":
      return {
        name: cleanText(name),
        type: "ss",
        server: cleanText(node.host),
        port: node.port,
        cipher: cleanText(node.method),
        password: cleanText(node.password),
        udp: true,
      };
    case "vmess": {
      const obj: Record<string, unknown> = {
        name: cleanText(name),
        type: "vmess",
        server: cleanText(node.host),
        port: node.port,
        uuid: cleanText(node.uuid),
        alterId: Number(node.aid || 0),
        cipher: cleanText(node.extra.scy, "auto"),
        udp: true,
        network: cleanText(node.network, "tcp").toLowerCase(),
      };
      const packetEncoding = cleanText(node.extra.packetEncoding).toLowerCase();
      if (packetEncoding === "xudp" || packetEncoding === "packetaddr") obj["packet-encoding"] = packetEncoding;
      if (cleanText(node.security).toLowerCase() === "tls" || cleanText(node.extra.tls).toLowerCase() === "tls") obj.tls = true;
      if (node.sni) obj.servername = cleanText(node.sni);
      const alpn = alpnValues(node.alpn);
      if (alpn.length) obj.alpn = alpn;
      if (node.insecure) obj["skip-cert-verify"] = true;
      applyNetworkOpts(obj, node);
      return obj;
    }
    case "hysteria2":
      return {
        name: cleanText(name),
        type: "hysteria2",
        server: cleanText(node.host),
        port: node.port,
        password: cleanText(node.password),
        sni: cleanText(node.sni),
        "skip-cert-verify": Boolean(node.insecure),
      };
    case "tuic": {
      const obj: Record<string, unknown> = {
        name: cleanText(name),
        type: "tuic",
        server: cleanText(node.host),
        port: node.port,
        uuid: cleanText(node.uuid),
        password: cleanText(node.password),
        sni: cleanText(node.sni),
        udp: true,
      };
      const alpn = alpnValues(node.alpn);
      if (alpn.length) obj.alpn = alpn;
      return obj;
    }
    default:
      return { name: cleanText(name), type: protocol || "unknown", server: cleanText(node.host), port: node.port };
  }
}

function applyNetworkOpts(obj: Record<string, unknown>, node: ParsedNode) {
  const net = cleanText(node.network, "tcp").toLowerCase();
  if (net === "ws") {
    obj["ws-opts"] = {
      path: cleanText(node.path, "/"),
      ...(cleanText(node.hostHeader) ? { headers: { Host: cleanText(node.hostHeader) } } : {}),
    };
  } else if (net === "grpc") {
    obj["grpc-opts"] = {
      "grpc-service-name": cleanText(node.serviceName),
    };
  } else if (net === "httpupgrade") {
    obj["smux"] = { enabled: false };
    obj["ws-opts"] = undefined;
    obj["http-opts"] = {
      path: [cleanText(node.path, "/")],
      ...(cleanText(node.hostHeader) ? { headers: { Host: [cleanText(node.hostHeader)] } } : {}),
    };
    obj.network = "httpupgrade";
  } else if (net === "splithttp") {
    obj.network = "splithttp";
    obj["splithttp-opts"] = {
      path: cleanText(node.path, "/"),
      host: cleanText(node.hostHeader),
    };
  } else if (net === "xhttp") {
    obj.network = "xhttp";
    const xhttp: Record<string, unknown> = {
      path: cleanText(node.path, "/"),
      ...(cleanText(node.hostHeader) ? { host: cleanText(node.hostHeader) } : {}),
    };
    const mode = cleanText(node.extra.mode).toLowerCase();
    if (XHTTP_MODES.has(mode)) xhttp.mode = mode;
    addXhttpExtra(xhttp, embeddedExtra(node));
    const paddingBytes = cleanText(node.extra.xPaddingBytes);
    if (paddingBytes && !xhttp["x-padding-bytes"]) xhttp["x-padding-bytes"] = paddingBytes;
    obj["xhttp-opts"] = xhttp;
  }
}

export function buildMihomoYaml(
  nodes: Array<ParsedNode | ProbedNode>,
  sources: SourceScan[],
): string {
  const used = new Set<string>();
  const named: Array<{ node: ParsedNode; name: string }> = [];
  for (const node of nodes) {
    const cc = cleanText(node.country, "XX").toUpperCase();
    const host = cleanText(node.host);
    const protocol = cleanText(node.protocol).toLowerCase();
    const base = `${cc} ${protocol} ${host.split(".")[0]}`;
    named.push({ node, name: uniqueName(base, used) });
  }

  const bySource = new Map<string, string[]>();
  for (const { node, name } of named) {
    const sourceIds = node.sourceIds?.length ? node.sourceIds : [node.sourceId];
    for (const sourceId of sourceIds.map((id) => cleanText(id)).filter((id) => id.length > 0)) {
      const list = bySource.get(sourceId) ?? [];
      list.push(name);
      bySource.set(sourceId, list);
    }
  }

  const sourceMeta = new Map(sources.map((s) => [s.id, s]));
  const sourceGroupNames: string[] = [];
  const groupLines: string[] = [];
  const usedGroupNames = new Set<string>(["RELAY", "AUTO", "FALLBACK"]);

  for (const [id, names] of bySource) {
    if (names.length === 0) continue;
    const meta = sourceMeta.get(id);
    const gname = uniqueName(`SRC ${meta?.name || id}`, usedGroupNames);
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

  const yaml: string[] = [
    `# Relay · generated ${new Date().toISOString()}`,
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
    `proxies:`,
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

export function buildUriList(nodes: Array<ParsedNode | ProbedNode>): string {
  return nodes.map((n) => n.uri).join("\n") + "\n";
}

export function buildB64Subscription(nodes: Array<ParsedNode | ProbedNode>): string {
  const body = buildUriList(nodes);
  if (typeof Buffer !== "undefined") return Buffer.from(body, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(body);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}