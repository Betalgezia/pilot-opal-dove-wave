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

export class GistPublishError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GistPublishError";
    this.status = status;
  }
}

const SETTINGS_KEY = "relay:cloud-publish-settings";
const STATUS_KEY = "relay:cloud-publish-status";
const AUTO_KEY = "relay:cloud-auto";
const DEFAULT_SETTINGS: CloudPublishSettings = { gistId: "", token: "", username: "" };

function gistIdValid(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

export function loadCloudPublishSettings(): CloudPublishSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const value = JSON.parse(raw) as Partial<CloudPublishSettings>;
    return { gistId: typeof value.gistId === "string" ? value.gistId : "", token: typeof value.token === "string" ? value.token : "", username: typeof value.username === "string" ? value.username : "" };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveCloudPublishSettings(settings: CloudPublishSettings): void {
  if (typeof window !== "undefined") localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
    return { warning: value.warning === true, at: typeof value.at === "number" ? value.at : null, results: Array.isArray(value.results) ? value.results.slice(-10) as CloudPublishResult[] : [] };
  } catch {
    return { warning: false, at: null, results: [] };
  }
}

function writeStatus(results: CloudPublishResult[]): void {
  const merged = [...readCloudPublishStatus().results, ...results].slice(-10);
  const status: CloudPublishStatus = { warning: merged.some((item) => !item.ok), at: Date.now(), results: merged };
  if (typeof window !== "undefined") {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new CustomEvent("relay:cloud-status"));
  }
}

async function writeLog(level: "info" | "warn", message: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/logs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level, category: "publish", message, data }), keepalive: true });
  } catch {
    // Logging is non-fatal.
  }
}

function previewUrl(settings: CloudPublishSettings, fmt: "b64" | "clash"): string {
  const filename = fmt === "clash" ? "relay.yaml" : "relay.b64";
  return `https://gist.githubusercontent.com/${encodeURIComponent(settings.username.trim())}/${settings.gistId.trim()}/raw/${filename}`;
}

function friendlyError(status: number, details: string): string {
  if (status === 403) return "Проверьте GitHub Token, нужны права gist";
  if (status === 404) return "Проверьте Gist ID, возможно gist удалён";
  if (status === 422) return `Ошибка формирования подписки: ${details || "GitHub отклонил содержимое"}`;
  return `GitHub API ${status}: ${details || "ошибка запроса"}`;
}

async function fetchLivePayload(fmt: "b64" | "clash") {
  const url = new URL("/api/sub", window.location.origin);
  url.searchParams.set("live", "1");
  url.searchParams.set("fmt", fmt);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Локальная подписка HTTP ${response.status}`);
  const subscription = await response.text();
  if (!subscription || subscription.length < 16) throw new Error("Пустая локальная подписка");
  const rawLive = Number(response.headers.get("x-relay-filtered") || "0");
  return { subscription, live: Number.isFinite(rawLive) ? rawLive : 0 };
}

export async function publishToGist({ gistId, token, username, subscription, format = "b64", liveCount = 0 }: CloudPublishSettings & { subscription: string; format?: "b64" | "clash"; liveCount?: number }): Promise<CloudPublishResult> {
  const id = gistId.trim();
  const user = username.trim();
  if (!gistIdValid(id)) throw new GistPublishError(0, "Gist ID должен содержать 32 hex-символа");
  if (!token.trim()) throw new GistPublishError(0, "GitHub Token не задан");
  if (!user) throw new GistPublishError(0, "GitHub Username не задан");
  const at = Date.now();
  const publishedAt = new Date(at).toISOString();
  const filename = format === "clash" ? "relay.yaml" : "relay.b64";
  const bytes = new TextEncoder().encode(subscription).byteLength;
  const url = previewUrl({ gistId: id, token, username: user }, format);
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ files: {
        [filename]: { content: subscription },
        "published.at": { content: publishedAt },
        "live.count": { content: String(liveCount) },
      } }),
    });
  } catch {
    throw new GistPublishError(0, "Нет соединения с GitHub");
  }
  if (!response.ok) {
    const details = await response.text();
    throw new GistPublishError(response.status, friendlyError(response.status, details));
  }
  return { fmt: format, status: response.status, ok: true, bytes, live: liveCount, at, url };
}

function filteredPayload(result: ScanResult, fmt: "b64" | "clash", limit = 60) {
  return getPanelFilters().then((filters) => {
    const nodes = pickExportNodes(result, limit, { protocols: filters.protocols, countryMode: filters.countryMode, countries: filters.countries, whitelistOnly: filters.whitelistOnly, blacklistEnabled: filters.blacklistEnabled, blacklistEntries: filters.blacklistEntries });
    return { subscription: fmt === "b64" ? buildB64Subscription(nodes) : buildMihomoYaml(nodes, result.sources), live: nodes.length };
  });
}

export async function publishScanToGist(result: ScanResult, settings = loadCloudPublishSettings()): Promise<CloudPublishResult[]> {
  const outputs: CloudPublishResult[] = [];
  for (const fmt of ["b64", "clash"] as const) {
    const startedAt = Date.now();
    let bytes = 0;
    let live = 0;
    const url = previewUrl(settings, fmt);
    try {
      const payload = await filteredPayload(result, fmt);
      bytes = new TextEncoder().encode(payload.subscription).byteLength;
      live = payload.live;
      const published = await publishToGist({ ...settings, subscription: payload.subscription, format: fmt, liveCount: live });
      const item = { ...published, at: startedAt };
      outputs.push(item);
      await writeLog("info", `[PUBLISH] gists/${settings.gistId.trim()} → ${published.status} ok, ${live} live, ${formatBytes(bytes)}`, { gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status: published.status, bytes, live, url, at: published.at });
    } catch (error) {
      const status = error instanceof GistPublishError ? error.status : 0;
      const message = error instanceof Error ? error.message : "Ошибка публикации";
      const item: CloudPublishResult = { fmt, status, ok: false, bytes, live, at: startedAt, url, error: message };
      outputs.push(item);
      await writeLog("warn", `[PUBLISH] failed: ${message}`, { gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status, bytes, live, url, at: startedAt });
    }
  }
  writeStatus(outputs);
  return outputs;
}

export async function publishCurrentToGist(settings = loadCloudPublishSettings()): Promise<CloudPublishResult[]> {
  const results: CloudPublishResult[] = [];
  for (const fmt of ["b64", "clash"] as const) {
    const startedAt = Date.now();
    let bytes = 0;
    let live = 0;
    const url = previewUrl(settings, fmt);
    try {
      const payload = await fetchLivePayload(fmt);
      bytes = new TextEncoder().encode(payload.subscription).byteLength;
      live = payload.live;
      const published = await publishToGist({ ...settings, subscription: payload.subscription, format: fmt, liveCount: live });
      results.push({ ...published, at: startedAt });
      await writeLog("info", `[PUBLISH] gists/${settings.gistId.trim()} → ${published.status} ok, ${live} live, ${formatBytes(bytes)}`, { gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status: published.status, bytes, live, url, at: published.at });
    } catch (error) {
      const status = error instanceof GistPublishError ? error.status : 0;
      const message = error instanceof Error ? error.message : "Ошибка публикации";
      results.push({ fmt, status, ok: false, bytes, live, at: startedAt, url, error: message });
      await writeLog("warn", `[PUBLISH] failed: ${message}`, { gistId: settings.gistId.trim(), username: settings.username.trim(), fmt, status, bytes, live, url, at: startedAt });
    }
  }
  writeStatus(results);
  return results;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}
