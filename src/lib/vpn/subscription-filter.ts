import type { ProbedNode, VpnProtocol } from "./types";
import { DEFAULT_BLACKLIST, WHITELIST_CIDRS, WHITELIST_DOMAINS } from "./subscription-filter.config";

export interface SubscriptionFilters {
  protocols: VpnProtocol[];
  countryMode: "all" | "ru" | "foreign" | "custom";
  countries: string[];
  whitelistOnly: boolean;
  blacklistEnabled: boolean;
  blacklistEntries: string[];
}

export const PROTOCOL_OPTIONS: readonly VpnProtocol[] = [
  "vless",
  "vmess",
  "ss",
  "trojan",
  "hysteria2",
  "tuic",
];

export const EMPTY_FILTERS: SubscriptionFilters = {
  protocols: [],
  countryMode: "all",
  countries: [],
  whitelistOnly: false,
  blacklistEnabled: false,
  blacklistEntries: [...DEFAULT_BLACKLIST],
};

function normalizeHost(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function ipv4ToInt(value: string): number {
  return value.split(".").reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

function parseCidr(value: string): { base: number; mask: number } | null {
  const [ip, bitsRaw] = value.trim().split("/");
  if (!isIpv4(ip)) return null;
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: ipv4ToInt(ip) & mask, mask };
}

function ipInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed || !isIpv4(ip)) return false;
  return (ipv4ToInt(ip) & parsed.mask) === parsed.base;
}

function domainMatches(host: string, domains: readonly string[]): boolean {
  const normalized = normalizeHost(host);
  if (!normalized || isIpv4(normalized)) return false;
  return domains.some((domain) => {
    const d = normalizeHost(domain);
    return normalized === d || normalized.endsWith(`.${d}`);
  });
}

function candidateHosts(node: ProbedNode): string[] {
  return [node.sni, node.host].filter((x): x is string => Boolean(x));
}

function matchesEntries(node: ProbedNode, entries: readonly string[]): boolean {
  const domains = entries.filter((entry) => !entry.includes("/"));
  const cidrs = entries.filter((entry) => entry.includes("/"));
  const hosts = candidateHosts(node).map(normalizeHost);
  return (
    hosts.some((host) => domainMatches(host, domains)) ||
    hosts.some((host) => isIpv4(host) && cidrs.some((cidr) => ipInCidr(host, cidr)))
  );
}

export function passesSubscriptionFilters(
  node: ProbedNode,
  filters: SubscriptionFilters,
): boolean {
  if (filters.protocols.length > 0 && !filters.protocols.includes(node.protocol)) return false;

  const country = (node.country ?? "").toUpperCase();
  if (filters.countryMode === "ru" && country !== "RU") return false;
  if (filters.countryMode === "foreign" && country === "RU") return false;
  if (filters.countryMode === "custom" && (filters.countries.length === 0 || !filters.countries.includes(country))) {
    return false;
  }

  if (filters.whitelistOnly && !matchesEntries(node, [...WHITELIST_DOMAINS, ...WHITELIST_CIDRS])) return false;

  if (filters.blacklistEnabled && matchesEntries(node, filters.blacklistEntries)) return false;

  return true;
}

export function filterSubscriptionNodes(
  nodes: ProbedNode[],
  filters: SubscriptionFilters,
): ProbedNode[] {
  return nodes.filter((node) => node.alive && node.latency !== null && passesSubscriptionFilters(node, filters));
}

function splitEncoded(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((x) => {
      try { return decodeURIComponent(x).trim(); } catch { return x.trim(); }
    })
    .filter(Boolean);
}

export function filtersFromSearchParams(params: URLSearchParams): SubscriptionFilters {
  const proto = splitEncoded(params.get("proto"))
    .map((x) => x.toLowerCase())
    .filter((x): x is VpnProtocol => PROTOCOL_OPTIONS.includes(x as VpnProtocol));
  const cc = params.get("cc");
  const rawCountries = splitEncoded(cc).map((x) => x.toUpperCase());
  const countries = rawCountries.filter((x) => x !== "!RU");
  const countryMode = cc === "!RU" ? "foreign" : cc === "RU" ? "ru" : countries.length ? "custom" : "all";
  const blacklistEntries = (params.get("blx") ?? "")
    .split("|")
    .map((x) => {
      try { return decodeURIComponent(x).trim().toLowerCase(); } catch { return x.trim().toLowerCase(); }
    })
    .filter(Boolean);

  return {
    protocols: proto,
    countryMode,
    countries,
    whitelistOnly: params.get("wl") === "1",
    blacklistEnabled: params.get("bl") === "1",
    blacklistEntries,
  };
}

export function filtersToSearchParams(params: URLSearchParams, filters: SubscriptionFilters): void {
  if (filters.protocols.length) params.set("proto", filters.protocols.join(","));
  else params.delete("proto");

  if (filters.countryMode === "foreign") params.set("cc", "!RU");
  else if (filters.countryMode === "ru") params.set("cc", "RU");
  else if (filters.countryMode === "custom" && filters.countries.length) params.set("cc", filters.countries.join(","));
  else params.delete("cc");

  if (filters.whitelistOnly) params.set("wl", "1");
  else params.delete("wl");

  if (filters.blacklistEnabled) params.set("bl", "1");
  else params.delete("bl");

  const custom = filters.blacklistEntries.map((x) => x.trim()).filter(Boolean);
  if (custom.length) params.set("blx", custom.map(encodeURIComponent).join("|"));
  else params.delete("blx");
}

export function filteredAliveCount(nodes: ProbedNode[], filters: SubscriptionFilters): number {
  return filterSubscriptionNodes(nodes, filters).length;
}
