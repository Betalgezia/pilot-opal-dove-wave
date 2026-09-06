export type VpnProtocol =
  | "vless"
  | "vmess"
  | "ss"
  | "trojan"
  | "hysteria2"
  | "tuic";

export type SourceStatus = "idle" | "ok" | "dead" | "error";

export interface SourceDef {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface ParsedNode {
  id: string;
  uri: string;
  protocol: VpnProtocol;
  name: string;
  host: string;
  port: number;
  country: string | null;
  serverIp?: string;
  sourceId: string;
  sourceName: string;
  uuid?: string;
  password?: string;
  method?: string;
  security?: string;
  network?: string;
  flow?: string;
  sni?: string;
  fp?: string;
  alpn?: string;
  pbk?: string;
  sid?: string;
  path?: string;
  hostHeader?: string;
  serviceName?: string;
  aid?: string;
  insecure?: boolean;
  extra: Record<string, string>;
}

export interface ProbedNode extends ParsedNode {
  latency: number | null;
  alive: boolean;
}

export interface SourceScan {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  error: string | null;
  parsed: number;
  unique: number;
  probed: number;
  alive: number;
  bestLatency: number | null;
}

export interface ScanResult {
  scannedAt: number;
  durationMs: number;
  sources: SourceScan[];
  nodes: ProbedNode[];
  parsedTotal: number;
  uniqueTotal: number;
  probeMode: ProbeMode;
  testUrl: string | null;
  probeNote: string | null;
}

export type ExportFormat = "clash" | "uri" | "b64";
export type SelectStrategy = "fastest" | "fallback" | "balanced";
export type ProbeMode = "mihomo" | "tcp";
