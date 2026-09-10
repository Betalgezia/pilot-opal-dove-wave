import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TEST_URL } from "./constants";
import { relayError, relayLog } from "./log";
import type { SubscriptionFilters } from "./subscription-filter";

export interface PanelFilters extends SubscriptionFilters {
  testUrl: string;
}

function projectRoot(): string {
  return process.env.RELAY_HOME || process.cwd();
}

function filtersPath(): string {
  return path.join(projectRoot(), ".relay", "filters.json");
}

export const DEFAULT_PANEL_FILTERS: PanelFilters = {
  protocols: [],
  countryMode: "all",
  countries: [],
  whitelistOnly: false,
  blacklistEnabled: false,
  blacklistEntries: [],
  testUrl: DEFAULT_TEST_URL,
};

function normalize(input: unknown): PanelFilters {
  if (!input || typeof input !== "object") return { ...DEFAULT_PANEL_FILTERS };
  const value = input as Partial<PanelFilters>;
  return {
    protocols: Array.isArray(value.protocols)
      ? value.protocols.filter((x): x is PanelFilters["protocols"][number] => typeof x === "string")
      : [],
    countryMode:
      value.countryMode === "ru" || value.countryMode === "foreign" || value.countryMode === "custom"
        ? value.countryMode
        : "all",
    countries: Array.isArray(value.countries)
      ? value.countries.filter((x): x is string => typeof x === "string").map((x) => x.toUpperCase())
      : [],
    whitelistOnly: value.whitelistOnly === true,
    blacklistEnabled: value.blacklistEnabled === true,
    blacklistEntries: Array.isArray(value.blacklistEntries)
      ? value.blacklistEntries.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean)
      : [],
    testUrl: typeof value.testUrl === "string" && value.testUrl.trim() ? value.testUrl.trim() : DEFAULT_TEST_URL,
  };
}

export async function getPanelFilters(): Promise<PanelFilters> {
  const file = filtersPath();
  try {
    const parsed = normalize(JSON.parse(await readFile(file, "utf8")));
    relayLog("filters loaded", file);
    return parsed;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code !== "ENOENT") relayError("filters read failed", file, err);
    else relayLog("filters missing, using defaults", file);
    return { ...DEFAULT_PANEL_FILTERS };
  }
}

export async function savePanelFilters(filters: PanelFilters): Promise<PanelFilters> {
  const normalized = normalize(filters);
  const file = filtersPath();
  const dir = path.dirname(file);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file, JSON.stringify(normalized, null, 2), "utf8");
    relayLog("filters saved", file, {
      protocols: normalized.protocols,
      countryMode: normalized.countryMode,
      whitelistOnly: normalized.whitelistOnly,
      blacklistEnabled: normalized.blacklistEnabled,
    });
  } catch (err) {
    relayError("filters save failed", file, err);
    throw err;
  }
  return normalized;
}
