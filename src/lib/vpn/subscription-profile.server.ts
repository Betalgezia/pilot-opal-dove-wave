import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_TEST_URL } from "./constants";
import type { ExportFormat, SourceDef } from "./types";

export interface SubscriptionProfile {
  sources: SourceDef[];
  fmt: ExportFormat;
  n: number;
  real: boolean;
  testUrl: string;
  updatedAt: number;
}

const PROFILE_PATH = path.join(process.cwd(), ".relay", "subscription.json");

const DEFAULT_PROFILE: SubscriptionProfile = {
  sources: [],
  fmt: DEFAULT_EXPORT_FMT,
  n: DEFAULT_EXPORT_N,
  real: true,
  testUrl: DEFAULT_TEST_URL,
  updatedAt: 0,
};

function normalizeSource(value: unknown, index: number): SourceDef | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<SourceDef>;
  if (typeof source.url !== "string" || !source.url.trim()) return null;
  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id : `s${index}`,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : `src-${index + 1}`,
    url: source.url.trim(),
    enabled: source.enabled !== false,
  };
}

function normalize(input: unknown): SubscriptionProfile {
  if (!input || typeof input !== "object") return { ...DEFAULT_PROFILE, sources: [] };
  const value = input as Partial<SubscriptionProfile>;
  const sources = Array.isArray(value.sources)
    ? value.sources.map((source, index) => normalizeSource(source, index)).filter((source): source is SourceDef => source !== null)
    : [];
  const fmt: ExportFormat = value.fmt === "clash" || value.fmt === "uri" || value.fmt === "b64" ? value.fmt : DEFAULT_EXPORT_FMT;
  const rawN = Number(value.n);
  const n = Number.isFinite(rawN) ? Math.min(60, Math.max(4, Math.round(rawN))) : DEFAULT_EXPORT_N;
  const testUrl = typeof value.testUrl === "string" && value.testUrl.trim() ? value.testUrl.trim() : DEFAULT_TEST_URL;
  return {
    sources,
    fmt,
    n,
    real: value.real !== false,
    testUrl,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
  };
}

export async function getSubscriptionProfile(): Promise<SubscriptionProfile> {
  try {
    return normalize(JSON.parse(await readFile(PROFILE_PATH, "utf8")));
  } catch {
    return { ...DEFAULT_PROFILE, sources: [] };
  }
}

export async function saveSubscriptionProfile(input: Omit<SubscriptionProfile, "updatedAt">): Promise<SubscriptionProfile> {
  const normalized = normalize(input);
  const next: SubscriptionProfile = { ...normalized, updatedAt: Date.now() };
  try {
    await mkdir(path.dirname(PROFILE_PATH), { recursive: true });
    await writeFile(PROFILE_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // Read-only/serverless hosts keep the request functional, but cannot persist the profile.
  }
  return next;
}
