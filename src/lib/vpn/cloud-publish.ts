import { buildB64Subscription, buildMihomoYaml } from "./mihomo";
import { getPanelFilters } from "./panel-filters.functions";
import { pickExportNodes } from "./select";
import type { ExportFormat, ScanResult, SourceDef } from "./types";

export interface CloudPublishSettings {
  edgeUrl: string;
  secret: string;
  nodeLimit: number;
}

export interface CloudPublishResult {
  fmt: "b64" | "clash";
  status: number;
  ok: boolean;
  bytes: number;
  at: number;
  error?: string;
}

function normalizeEdgeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

async function writeLog(level: "info" | "warn", message: string, data: Record<string, unknown>) {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level, category: "system", message, data }),
      keepalive: true,
    });
  } catch {
    // Publishing must remain independent from local logging failures.
  }
}

function payloadFor(fmt: "b64" | "clash", result: ScanResult, limit: number, filters: Awaited<ReturnType<typeof getPanelFilters>>) {
  const nodes = pickExportNodes(result, Math.min(60, Math.max(4, limit)), {
    protocols: filters.protocols,
    countryMode: filters.countryMode,
    countries: filters.countries,
    whitelistOnly: filters.whitelistOnly,
    blacklistEnabled: filters.blacklistEnabled,
    blacklistEntries: filters.blacklistEntries,
  });
  return fmt === "b64" ? buildB64Subscription(nodes) : buildMihomoYaml(nodes, result.sources);
}

export async function publishToEdge(result: ScanResult, sources: SourceDef[], settings: CloudPublishSettings): Promise<CloudPublishResult[]> {
  const edgeUrl = normalizeEdgeUrl(settings.edgeUrl);
  if (!edgeUrl) throw new Error("Edge URL не задан");
  if (!settings.secret) throw new Error("Секрет Edge не задан");
  if (!sources.some((source) => source.enabled)) throw new Error("Нет включённых источников");

  const filters = await getPanelFilters();
  const results: CloudPublishResult[] = [];

  for (const fmt of ["b64", "clash"] as const) {
    const payload = payloadFor(fmt, result, settings.nodeLimit, filters);
    const url = new URL(edgeUrl);
    url.searchParams.set("secret", settings.secret);
    url.searchParams.set("fmt", fmt);
    const at = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": fmt === "clash" ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8" },
        body: payload,
      });
      const item: CloudPublishResult = { fmt, status: response.status, ok: response.ok, bytes: new TextEncoder().encode(payload).byteLength, at };
      results.push(item);
      await writeLog(response.ok ? "info" : "warn", `Cloud publish ${fmt}: HTTP ${response.status}`, { fmt, status: response.status, bytes: item.bytes, at });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      const item: CloudPublishResult = { fmt, status: 0, ok: false, bytes: new TextEncoder().encode(payload).byteLength, at, error: message };
      results.push(item);
      await writeLog("warn", `Cloud publish ${fmt}: ${message}`, { fmt, status: 0, bytes: item.bytes, at, error: message });
    }
  }

  return results;
}
