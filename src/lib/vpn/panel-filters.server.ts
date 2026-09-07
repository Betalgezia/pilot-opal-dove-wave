import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SubscriptionFilters } from "./subscription-filter";

export interface PanelFilters extends SubscriptionFilters {
  testUrl: string;
}

const DEFAULT_TEST_URL = "https://www.youtube.com/generate_204";
const FILTERS_PATH = path.join(process.cwd(), ".relay", "filters.json");

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
      ? value.blacklistEntries
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
      : [],
    testUrl: typeof value.testUrl === "string" && value.testUrl.trim() ? value.testUrl.trim() : DEFAULT_TEST_URL,
  };
}

export async function getPanelFilters(): Promise<PanelFilters> {
  try {
    return normalize(JSON.parse(await readFile(FILTERS_PATH, "utf8")));
  } catch {
    return { ...DEFAULT_PANEL_FILTERS };
  }
}

export async function savePanelFilters(filters: PanelFilters): Promise<PanelFilters> {
  const normalized = normalize(filters);
  try {
    await mkdir(path.dirname(FILTERS_PATH), { recursive: true });
    await writeFile(FILTERS_PATH, JSON.stringify(normalized, null, 2), "utf8");
  } catch {
    // Read-only/serverless hosts simply keep the request functional.
  }
  return normalized;
}
