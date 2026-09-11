import { relayLogger } from "@/lib/relay/logger";
import { cleanRemark, countryFromRemark } from "./countries";
import type { ParsedNode, VpnProtocol } from "./types";

const PROTO_RE = /^(vless|vmess|ss|trojan|hysteria2|hy2|tuic):\/\/\S+/i;
const PROTOCOLS = new Set<VpnProtocol>([
  "vless",
  "vmess",
  "ss",
  "trojan",
  "hysteria2",
  "tuic",
]);
const NETWORKS = new Set([
  "tcp",
  "ws",
  "grpc",
  "h2",
  "httpupgrade",
  "splithttp",
  "xhttp",
  "quic",
]);
const ALPN_ALLOWED = new Set(["h2", "http/1.1", "http/1.0", "h3", "h3-29"]);

function nodeId(parts: Array<string | number | undefined>): string {
  return parts
    .map((part) => String(part ?? "").toLowerCase())
    .join("|")
    .replace(/[^a-z0-9.|:_-]/g, "")
    .slice(0, 180);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tryB64(value: string): string | null {
  const clean = value.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_=-]+$/.test(clean) || clean.length < 16) return null;
  try {
    const normalized = clean.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    return decodeURIComponent(
      Array.from(atob(padded), (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
  } catch {
    return null;
  }
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const query = search.startsWith("?") ? search.slice(1) : search;
  for (const part of query.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    try {
      out[decodeURIComponent(rawKey).trim()] = decodeURIComponent(rawValue).trim();
    } catch {
      out[rawKey.trim()] = rawValue.trim();
    }
  }
  return out;
}

function splitHash(line: string): { body: string; remark: string } {
  const hash = line.indexOf("#");
  if (hash === -1) return { body: line, remark: "" };
  return { body: line.slice(0, hash), remark: line.slice(hash + 1).trim() };
}

function parseHostPort(authority: string): { host: string; port: number } | null {
  const v6 = authority.match(/^\[([^\]]+)\]:(\d+)$/);
  if (v6) return { host: v6[1].trim(), port: Number(v6[2]) };
  const last = authority.lastIndexOf(":");
  if (last === -1) return null;
  const host = authority.slice(0, last).trim();
  const port = Number(authority.slice(last + 1).trim());
  if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

function mapNetwork(type: string | undefined): string {
  const normalized = (type || "tcp").trim().toLowerCase();
  if (normalized === "raw") return "tcp";
  if (normalized === "h2") return "h2";
  if (normalized === "httpupgrade") return "httpupgrade";
  if (normalized === "splithttp") return "splithttp";
  if (normalized === "xhttp") return "xhttp";
  return normalized;
}

function boolParam(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function parseVless(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("vless://".length);
  const queryIndex = rest.indexOf("?");
  const main = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const params = parseQuery(queryIndex === -1 ? "" : rest.slice(queryIndex + 1));
  const at = main.lastIndexOf("@");
  if (at === -1) return null;
  const uuid = decodeURIComponent(main.slice(0, at)).trim();
  const hostPort = parseHostPort(main.slice(at + 1));
  if (!hostPort) return null;
  const network = mapNetwork(params.type || params.network);
  const name = cleanRemark(remark || `${hostPort.host}:${hostPort.port}`);
  return {
    id: nodeId(["vless", hostPort.host, hostPort.port, uuid, network, params.path, params.security]),
    uri: line.trim(),
    protocol: "vless",
    name,
    host: hostPort.host,
    port: hostPort.port,
    country: countryFromRemark(`${remark} ${name}`),
    sourceId,
    sourceName,
    uuid,
    security: params.security,
    network,
    flow: params.flow,
    sni: params.sni || params.servername,
    fp: params.fp,
    alpn: params.alpn,
    pbk: params.pbk,
    sid: params.sid,
    path: params.path,
    hostHeader: params.host,
    serviceName: params.serviceName || params.servicename,
    insecure: boolParam(params.insecure) || boolParam(params.allowInsecure),
    extra: params,
  };
}

function parseTrojan(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("trojan://".length);
  const queryIndex = rest.indexOf("?");
  const main = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const params = parseQuery(queryIndex === -1 ? "" : rest.slice(queryIndex + 1));
  const at = main.lastIndexOf("@");
  if (at === -1) return null;
  const password = decodeURIComponent(main.slice(0, at)).trim();
  const hostPort = parseHostPort(main.slice(at + 1));
  if (!password || !hostPort) return null;
  const network = mapNetwork(params.type || params.network || "tcp");
  const name = cleanRemark(remark || `${hostPort.host}:${hostPort.port}`);
  return {
    id: nodeId(["trojan", hostPort.host, hostPort.port, password, network]),
    uri: line.trim(),
    protocol: "trojan",
    name,
    host: hostPort.host,
    port: hostPort.port,
    country: countryFromRemark(`${remark} ${name}`),
    sourceId,
    sourceName,
    password,
    security: params.security || "tls",
    network,
    sni: params.sni || params.peer,
    fp: params.fp,
    alpn: params.alpn,
    pbk: params.pbk,
    sid: params.sid,
    path: params.path,
    hostHeader: params.host,
    insecure: boolParam(params.insecure) || boolParam(params.allowInsecure),
    extra: params,
  };
}

function parseHysteria2(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const scheme = body.startsWith("hy2://") ? "hy2://" : "hysteria2://";
  const rest = body.slice(scheme.length);
  const queryIndex = rest.indexOf("?");
  const main = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const params = parseQuery(queryIndex === -1 ? "" : rest.slice(queryIndex + 1));
  const at = main.lastIndexOf("@");
  if (at === -1) return null;
  const password = decodeURIComponent(main.slice(0, at)).trim();
  const hostPort = parseHostPort(main.slice(at + 1));
  if (!hostPort || !password) return null;
  const name = cleanRemark(remark || `${hostPort.host}:${hostPort.port}`);
  return {
    id: nodeId(["hysteria2", hostPort.host, hostPort.port, password]),
    uri: line.trim().replace(/^hy2:\/\//, "hysteria2://"),
    protocol: "hysteria2",
    name,
    host: hostPort.host,
    port: hostPort.port,
    country: countryFromRemark(`${remark} ${name}`),
    sourceId,
    sourceName,
    password,
    sni: params.sni || params.peer,
    insecure: boolParam(params.insecure),
    extra: params,
  };
}

function parseTuic(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("tuic://".length);
  const queryIndex = rest.indexOf("?");
  const main = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const params = parseQuery(queryIndex === -1 ? "" : rest.slice(queryIndex + 1));
  const at = main.lastIndexOf("@");
  if (at === -1) return null;
  const userInfo = main.slice(0, at);
  const hostPort = parseHostPort(main.slice(at + 1));
  if (!hostPort) return null;
  const [uuid, password] = userInfo.split(":").map((value) => value.trim());
  if (!uuid || !password) return null;
  const name = cleanRemark(remark || `${hostPort.host}:${hostPort.port}`);
  return {
    id: nodeId(["tuic", hostPort.host, hostPort.port, uuid, password]),
    uri: line.trim(),
    protocol: "tuic",
    name,
    host: hostPort.host,
    port: hostPort.port,
    country: countryFromRemark(`${remark} ${name}`),
    sourceId,
    sourceName,
    uuid,
    password,
    sni: params.sni,
    alpn: params.alpn,
    insecure: boolParam(params.insecure),
    extra: params,
  };
}

function parseSs(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const { body, remark } = splitHash(line);
  let rest = body.slice("ss://".length);
  let method = "";
  let password = "";
  let authority = "";

  if (rest.includes("@")) {
    const at = rest.lastIndexOf("@");
    const userInfo = rest.slice(0, at);
    authority = rest.slice(at + 1);
    if (userInfo.includes(":")) {
      const colon = userInfo.indexOf(":");
      method = decodeURIComponent(userInfo.slice(0, colon)).trim();
      password = decodeURIComponent(userInfo.slice(colon + 1)).trim();
    } else {
      const decoded = tryB64(userInfo);
      if (decoded?.includes(":")) {
        const colon = decoded.indexOf(":");
        method = decoded.slice(0, colon).trim();
        password = decoded.slice(colon + 1).trim();
      }
    }
  } else {
    const decoded = tryB64(rest);
    if (!decoded) return null;
    const at = decoded.lastIndexOf("@");
    if (at === -1) return null;
    const userInfo = decoded.slice(0, at);
    authority = decoded.slice(at + 1);
    const colon = userInfo.indexOf(":");
    if (colon === -1) return null;
    method = userInfo.slice(0, colon).trim();
    password = userInfo.slice(colon + 1).trim();
  }

  const queryIndex = authority.indexOf("?");
  if (queryIndex !== -1) authority = authority.slice(0, queryIndex);
  const hostPort = parseHostPort(authority);
  if (!hostPort || !method || !password) return null;
  const name = cleanRemark(remark || `${hostPort.host}:${hostPort.port}`);
  return {
    id: nodeId(["ss", hostPort.host, hostPort.port, method, password]),
    uri: line.trim(),
    protocol: "ss",
    name,
    host: hostPort.host,
    port: hostPort.port,
    country: countryFromRemark(`${remark} ${name}`),
    sourceId,
    sourceName,
    method,
    password,
    extra: {},
  };
}

function parseVmess(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const decoded = tryB64(line.slice("vmess://".length));
  if (!decoded) return null;
  try {
    const json = JSON.parse(decoded) as Record<string, unknown>;
    const host = String(json.add || json.host || "").trim();
    const port = Number(json.port);
    const uuid = String(json.id || "").trim();
    if (!host || !port || !uuid) return null;

    const remark = String(json.ps || json.remark || `${host}:${port}`).trim();
    const name = cleanRemark(remark);
    const network = mapNetwork(String(json.net || "tcp"));
    const tls = String(json.tls || "").trim();
    const path = String(json.path || "").trim();
    const hostHeader = String(json.host || "").trim();
    const insecure =
      json.allowInsecure === true ||
      String(json.allowInsecure || "").trim().toLowerCase() === "true" ||
      String(json.insecure || "").trim() === "1";

    return {
      id: nodeId(["vmess", host, port, uuid, network, path]),
      uri: line.trim(),
      protocol: "vmess",
      name,
      host,
      port,
      country: countryFromRemark(remark),
      sourceId,
      sourceName,
      uuid,
      aid: String(json.aid ?? "0").trim(),
      security: tls ? "tls" : "none",
      network,
      sni: String(json.sni || json.host || "").trim(),
      path,
      hostHeader,
      insecure,
      extra: {
        scy: String(json.scy || json.security || "auto").trim(),
        tls,
        type: String(json.type || "").trim(),
        packetEncoding: String(json.packetEncoding || "").trim(),
      },
    };
  } catch {
    return null;
  }
}

function sanitizeNode(node: ParsedNode): ParsedNode | null {
  const copy = { ...node } as ParsedNode;
  for (const key of [
    "uri", "name", "host", "sourceId", "sourceName", "uuid", "password", "method", "security", "network", "flow", "sni", "fp", "pbk", "sid", "path", "hostHeader", "serviceName", "aid",
  ] as const) {
    const value = copy[key];
    if (typeof value === "string") copy[key] = value.trim() as never;
  }

  copy.protocol = copy.protocol.trim().toLowerCase() as VpnProtocol;
  if (!PROTOCOLS.has(copy.protocol) || !copy.host || !Number.isInteger(copy.port) || copy.port < 1 || copy.port > 65535) return null;

  copy.network = mapNetwork(copy.network);
  if (!NETWORKS.has(copy.network)) return null;

  const alpn = (copy.alpn ?? "").split(",").map((value) => value.trim()).filter((value) => value.length > 0 && value.length <= 32 && ALPN_ALLOWED.has(value));
  copy.alpn = alpn.length ? alpn.join(",") : undefined;

  copy.extra = Object.fromEntries(Object.entries(copy.extra ?? {}).map(([key, value]) => [key.trim(), String(value).trim()]));

  if (copy.network === "ws" && !copy.path?.trim()) return null;
  if (copy.network === "grpc" && !copy.serviceName?.trim()) return null;
  if (copy.network === "xhttp" && !copy.path?.trim()) return null;
  if (["vless", "vmess", "tuic"].includes(copy.protocol) && !copy.uuid) return null;
  if (copy.protocol === "ss" && (!copy.password || !copy.method)) return null;
  if (["trojan", "hysteria2"].includes(copy.protocol) && !copy.password) return null;

  copy.id = nodeId([copy.protocol, copy.host, copy.port, copy.uuid, copy.password, copy.method, copy.network, copy.path, copy.security]);
  return copy;
}

export function parseUriLine(line: string, sourceId: string, sourceName: string): ParsedNode | null {
  const trimmed = decodeHtml(line.trim());
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  const lower = trimmed.toLowerCase();
  try {
    let parsed: ParsedNode | null = null;
    if (lower.startsWith("vless://")) parsed = parseVless(trimmed, sourceId, sourceName);
    else if (lower.startsWith("vmess://")) parsed = parseVmess(trimmed, sourceId, sourceName);
    else if (lower.startsWith("ss://")) parsed = parseSs(trimmed, sourceId, sourceName);
    else if (lower.startsWith("trojan://")) parsed = parseTrojan(trimmed, sourceId, sourceName);
    else if (lower.startsWith("hysteria2://") || lower.startsWith("hy2://")) parsed = parseHysteria2(trimmed, sourceId, sourceName);
    else if (lower.startsWith("tuic://")) parsed = parseTuic(trimmed, sourceId, sourceName);
    return parsed === null ? null : sanitizeNode(parsed);
  } catch {
    return null;
  }
}

export function parseSubscription(raw: string, sourceId: string, sourceName: string): ParsedNode[] {
  const started = Date.now();
  try {
    let text = raw.replace(/^\uFEFF/, "").trim();
    const maybe = tryB64(text);
    if (maybe && PROTO_RE.test(maybe.trim().split(/\r?\n/)[0] ?? "")) text = maybe;

    const nodes: ParsedNode[] = [];
    const seen = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
      const node = parseUriLine(line, sourceId, sourceName);
      if (!node || seen.has(node.id)) continue;
      seen.add(node.id);
      nodes.push(node);
    }
    relayLogger.info("parse", "Subscription parsed", { sourceId, sourceName, inputLines: text.split(/\r?\n/).length, nodes: nodes.length, durationMs: Date.now() - started });
    return nodes;
  } catch (err) {
    relayLogger.error("parse", "Subscription parse failed", { sourceId, sourceName, durationMs: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export function endpointKey(node: { host: string; port: number }): string {
  return `${node.host.toLowerCase()}:${node.port}`;
}

export function protocolRank(p: VpnProtocol): number {
  return ({ vless: 1, vmess: 2, trojan: 3, ss: 4, hysteria2: 5, tuic: 6 } as Record<VpnProtocol, number>)[p] ?? 99;
}
