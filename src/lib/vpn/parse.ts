import { cleanRemark, countryFromRemark } from "./countries";
import type { ParsedNode, VpnProtocol } from "./types";

const PROTO_RE =
  /^(vless|vmess|ss|trojan|hysteria2|hy2|tuic):\/\/\S+/i;

function nodeId(parts: Array<string | number | undefined>): string {
  return parts
    .map((p) => String(p ?? "").toLowerCase())
    .join("|")
    .replace(/[^a-z0-9.|:_-]/g, "")
    .slice(0, 180);
}

function decodeHtml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function tryB64(s: string): string | null {
  const clean = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_=-]+$/.test(clean) || clean.length < 16) return null;
  try {
    const normalized = clean.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const text =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : decodeURIComponent(
            Array.from(atob(padded), (c) =>
              "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
            ).join(""),
          );
    if (text.includes("://") || text.includes("{")) return text;
    return text;
  } catch {
    return null;
  }
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
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

function splitHash(line: string): { body: string; remark: string } {
  const hash = line.indexOf("#");
  if (hash === -1) return { body: line, remark: "" };
  return { body: line.slice(0, hash), remark: line.slice(hash + 1) };
}

function parseHostPort(authority: string): { host: string; port: number } | null {
  const v6 = authority.match(/^\[([^\]]+)\]:(\d+)$/);
  if (v6) return { host: v6[1], port: Number(v6[2]) };
  const last = authority.lastIndexOf(":");
  if (last === -1) return null;
  const host = authority.slice(0, last);
  const port = Number(authority.slice(last + 1));
  if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

function mapNetwork(type: string | undefined): string {
  const t = (type || "tcp").toLowerCase();
  if (t === "xhttp" || t === "splithttp") return "splithttp";
  if (t === "raw") return "tcp";
  if (t === "h2") return "h2";
  if (t === "httpupgrade") return "httpupgrade";
  return t;
}

function parseVless(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("vless://".length);
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
    id: nodeId(["vless", hp.host, hp.port, uuid, network, p.path, p.security]),
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
    extra: p,
  };
}

function parseTrojan(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("trojan://".length);
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
    id: nodeId(["trojan", hp.host, hp.port, password, network]),
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
    extra: p,
  };
}

function parseHysteria2(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
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
    id: nodeId(["hysteria2", hp.host, hp.port, password]),
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
    extra: p,
  };
}

function parseTuic(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const { body, remark } = splitHash(line);
  const rest = body.slice("tuic://".length);
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
    id: nodeId(["tuic", hp.host, hp.port, uuid, password]),
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
    extra: p,
  };
}

function parseSs(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const { body, remark } = splitHash(line);
  let rest = body.slice("ss://".length);
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
    id: nodeId(["ss", hp.host, hp.port, method, password]),
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
    extra: {},
  };
}

function parseVmess(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const raw = line.slice("vmess://".length);
  const decoded = tryB64(raw);
  if (!decoded) return null;
  try {
    const j = JSON.parse(decoded) as Record<string, unknown>;
    const host = String(j.add || j.host || "");
    const port = Number(j.port);
    const uuid = String(j.id || "");
    if (!host || !port || !uuid) return null;
    const remark = String(j.ps || j.remark || `${host}:${port}`);
    const name = cleanRemark(remark);
    const network = mapNetwork(String(j.net || "tcp"));
    const tls = String(j.tls || "");
    return {
      id: nodeId(["vmess", host, port, uuid, network, String(j.path || "")]),
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
        type: String(j.type || ""),
      },
    };
  } catch {
    return null;
  }
}

export function parseUriLine(
  line: string,
  sourceId: string,
  sourceName: string,
): ParsedNode | null {
  const trimmed = decodeHtml(line.trim());
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  const lower = trimmed.toLowerCase();
  try {
    if (lower.startsWith("vless://")) return parseVless(trimmed, sourceId, sourceName);
    if (lower.startsWith("vmess://")) return parseVmess(trimmed, sourceId, sourceName);
    if (lower.startsWith("ss://")) return parseSs(trimmed, sourceId, sourceName);
    if (lower.startsWith("trojan://")) return parseTrojan(trimmed, sourceId, sourceName);
    if (lower.startsWith("hysteria2://") || lower.startsWith("hy2://"))
      return parseHysteria2(trimmed, sourceId, sourceName);
    if (lower.startsWith("tuic://")) return parseTuic(trimmed, sourceId, sourceName);
  } catch {
    return null;
  }
  return null;
}

export function parseSubscription(
  raw: string,
  sourceId: string,
  sourceName: string,
): ParsedNode[] {
  let text = raw.replace(/^\uFEFF/, "").trim();
  const maybe = tryB64(text);
  if (maybe && PROTO_RE.test(maybe.trim().split(/\r?\n/)[0] ?? "")) {
    text = maybe;
  }

  const nodes: ParsedNode[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const node = parseUriLine(line, sourceId, sourceName);
    if (!node) continue;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  return nodes;
}

export function endpointKey(node: { host: string; port: number }): string {
  return `${node.host.toLowerCase()}:${node.port}`;
}

export function protocolRank(p: VpnProtocol): number {
  switch (p) {
    case "vless":
      return 0;
    case "hysteria2":
      return 1;
    case "trojan":
      return 2;
    case "ss":
      return 3;
    case "vmess":
      return 4;
    case "tuic":
      return 5;
    default:
      return 9;
  }
}
