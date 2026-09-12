import { getPanelFilters } from "./panel-filters.functions";
import { buildB64Subscription, buildMihomoYaml } from "./mihomo";
import { pickExportNodes } from "./select";
import type { ScanResult } from "./types";

export interface CloudPublishSettings {
  gistId: string;
  token: string;
  username: string;
}

export interface CloudPublishResult {
  fmt: "b64" | "clash";
  status: number;
  ok: boolean;
  bytes: number;
  live: number;
  at: number;
  url: string;
  error?: string;
}

export interface CloudPublishStatus {
  warning: boolean;
  at: number | null;
  results: CloudPublishResult[];
}

const SETTINGS_KEY = "relay:cloud-publish-settings";
const STATUS_KEY = "relay:cloud-publish-status";
const AUTO_KEY = "relay:cloud-auto";

const DEFAULT_SETTINGS: CloudPublishSettings = { gistId: "", token: "", username: "" };

function isValidGistId(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

export function loadCloudPublishSettings(): CloudPublishSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const value = JSON.parse(raw) as Partial<CloudPublishSettings>;
    return {
      gistId: typeof value.gistId === "string" ? value.gistId : "",
      token: typeof value.token === "string" ? value.token : "",
      username: typeof value.username === "string" ? value.username : "",
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCloudPublishSettings(settings: CloudPublishSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function readCloudAuto(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(AUTO_KEY) === "true";
}

export function saveCloudAuto(value: boolean): void {
  if (typeof window !== "undefined") localStorage.setItem(AUTO_KEY, String(value));
}

export function readCloudPublishStatus(): CloudPublishStatus {
  if (typeof window === "undefined") return { warning: false, at: null, results: [] };
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return { warning: false, at: null, results: [] };
    const value = JSON.parse(raw) as Partial<CloudPublishStatus>;
    return {
      warning: value.warning === true,
      at: typeof value.at === "number" ? value.at : null,
      results: Array.isArray(value.results) ? value.results.slice(-10) as CloudPublishResult[] : [],
    };
  } catch {
    return { warning: false, at: null, results: [] };
  }
}

function writeStatus(results: CloudPublishResult[]): void {
  const existing = readCloudPublishStatus();
  const merged = [...existing.results, ...results].slice(-10);
  const status: CloudPublishStatus = { warning: merged.some((item) => !item.ok), at: Date.now(), results: merged };
  if (typeof window !== "undefined") {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new CustomEvent("relay:cloud-status"));
  }
}

async function writeLog(level: "info" | "warn", message: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level, category: "publish", message, data }),
      keepalive: true,
    });
  } catch {
    // Logging failure must not affect publication.
  }
}

function friendlyError(status: number, details: string): string {
  if (status === 403) return "Проверьте GitHub Token, нужны права gist";
  if (status === 404) return "Проверьте Gist ID, возможно gist удалён";
  if (status === 422) return `Ошибка формирования подписки: ${details || "GitHub отклонил содержимое"}`;
  return `GitHub API ${status}: ${details || "ошибка запроса"}`;
}

async function getPayload(result: ScanResult, fmt: "b64" | "clash") {
  const filters = await getPanelFilters();
  const nodes = pickExportNodes(result, 60, {
    protocols: filters.protocols,
    countryMode: filters.countryMode,
    countries: filters.countries,
    whitelistOnly: filters.whitelistOnly,
    blacklistEnabled: filters.blacklistEnabled,
    blacklistEntries: filters.blacklistEntries,
  });
  const subscription = fmt === "b64" ? buildB64Subscription(nodes) : buildMihomoYaml(nodes, result.sources);
  return { subscription, live: nodes.length };
}

export async function publishToGist({ gistId, token, username, subscription, format = "b64", liveCount = 0 }: CloudPublishSettings & { subscription: string; format?: "b64" | "clash"; liveCount?: number }): Promise<CloudPublishResult> {
  const id = gistId.trim();
  const user = username.trim();
  const filename = format === "clash" ? "relay.yaml" : "relay.b64";
  if (!isValidGistId(id)) throw new Error("Gist ID должен содержать 32 hex-символа");
  if (!token.trim()) throw new Error("GitHub Token не задан");
  if (!user) throw new Error("GitHub Username не задан");
  const at = new Date().toISOString();
  const bytes = new TextEncoder().encode(subscription).byteLength;
  const url = `https://gist.githubusercontent.com/${encodeURIComponent(user)}/${id}/raw/${filename}`;
  const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files: {
      [filename]: { content: subscription },
      "published.at": { content: at },
      "live.count": { content: String(liveCount) },
    } }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(friendlyError(response.status, details));
  }
  return { fmt: format, status: response.status, ok: true, bytes, live: liveCount, at: Date.now(), url };
}

export async function publishScanToGist(result: ScanResult, settings = loadCloudPublishSettings()): Promise<CloudPublishResult[]> {
  const outputs: CloudPublishResult[] = [];
  for (const fmt of ["b64", "clash"] as const) {
    const startedAt = Date.now();
    try {
      const { subscription, live } = await getPayload(result, fmt);
      const published = await publishToGist({ ...settings, subscription, format: fmt, liveCount: live });
      const item = { ...published, at: startedAt };
      outputs.push(item);
      await writeLog("info", `[PUBLISH] gists/${settings.gistId.trim()} → ${published.status} ok, ${live} live, ${formatBytes(published.bytes)}`, {
        gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status: published.status, bytes: published.bytes, live, url: published.url, at: published.at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      const bytes = 0;
      const item: CloudPublishResult = { fmt, status: 0, ok: false, bytes, live: 0, at: startedAt, url: `https://gist.githubusercontent.com/${settings.username.trim()}/${settings.gistId.trim()}/raw/${fmt === "clash" ? "relay.yaml" : "relay.b64"}`, error: message };
      outputs.push(item);
      await writeLog("warn", `[PUBLISH] failed: ${message}`, { gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status: 0, bytes, live: 0, url: item.url, error: message, at: startedAt });
    }
  }
  writeStatus(outputs);
  return outputs;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}
