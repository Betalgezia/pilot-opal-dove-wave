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

const SETTINGS_KEY = "relay:cloud-publish-settings";
const STATUS_KEY = "relay:cloud-publish-status";

export function loadCloudPublishSettings(): CloudPublishSettings {
  if (typeof window === "undefined") return { edgeUrl: "", secret: "", nodeLimit: 40 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { edgeUrl: "", secret: "", nodeLimit: 40 };
    const value = JSON.parse(raw) as Partial<CloudPublishSettings>;
    return {
      edgeUrl: typeof value.edgeUrl === "string" ? value.edgeUrl : "",
      secret: typeof value.secret === "string" ? value.secret : "",
      nodeLimit: Number.isFinite(value.nodeLimit) ? Number(value.nodeLimit) : 40,
    };
  } catch {
    return { edgeUrl: "", secret: "", nodeLimit: 40 };
  }
}

export function saveCloudPublishSettings(settings: CloudPublishSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface CloudPublishStatus {
  warning: boolean;
  at: number | null;
  results: CloudPublishResult[];
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
  const status: CloudPublishStatus = {
    warning: results.some((item) => !item.ok),
    at: Date.now(),
    results: results.slice(-10),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new CustomEvent("relay:cloud-status"));
  }
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
    // Publication must not fail because local logging is unavailable.
  }
}

function normalizeEdgeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export async function publishToEdge(settings = loadCloudPublishSettings()): Promise<CloudPublishResult[]> {
  const edgeUrl = normalizeEdgeUrl(settings.edgeUrl);
  if (!edgeUrl) throw new Error("Edge URL не задан");
  if (!settings.secret) throw new Error("Секрет Edge не задан");

  const results: CloudPublishResult[] = [];
  for (const fmt of ["b64", "clash"] as const) {
    const startedAt = Date.now();
    try {
      const local = new URL("/api/sub", window.location.origin);
      local.searchParams.set("live", "1");
      local.searchParams.set("fmt", fmt);
      const sourceResponse = await fetch(local, { cache: "no-store" });
      if (!sourceResponse.ok) throw new Error(`local subscription HTTP ${sourceResponse.status}`);
      const payload = await sourceResponse.text();
      if (!payload || payload.length < 16) throw new Error("empty local subscription");

      const target = new URL(edgeUrl);
      target.searchParams.set("secret", settings.secret);
      target.searchParams.set("fmt", fmt);
      const response = await fetch(target, {
        method: "POST",
        headers: { "content-type": fmt === "clash" ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8" },
        body: payload,
      });
      const item: CloudPublishResult = {
        fmt,
        status: response.status,
        ok: response.ok,
        bytes: new TextEncoder().encode(payload).byteLength,
        at: startedAt,
      };
      results.push(item);
      await writeLog(response.ok ? "info" : "warn", `Cloud publish ${fmt}: HTTP ${response.status}`, {
        fmt,
        status: response.status,
        bytes: item.bytes,
        at: startedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      const item: CloudPublishResult = { fmt, status: 0, ok: false, bytes: 0, at: startedAt, error: message };
      results.push(item);
      await writeLog("warn", `Cloud publish ${fmt}: ${message}`, { fmt, status: 0, bytes: 0, at: startedAt, error: message });
    }
  }

  writeStatus(results);
  return results;
}
