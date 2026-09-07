import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PanelFilters } from "./panel-filters.server";
import { PROTOCOL_OPTIONS } from "./subscription-filter";

const filtersSchema = z.object({
  protocols: z.array(z.enum(PROTOCOL_OPTIONS as [string, ...string[]])).max(PROTOCOL_OPTIONS.length),
  countryMode: z.enum(["all", "ru", "foreign", "custom"]),
  countries: z.array(z.string().min(2).max(8)).max(256),
  whitelistOnly: z.boolean(),
  blacklistEnabled: z.boolean(),
  blacklistEntries: z.array(z.string().max(253)).max(512),
  testUrl: z.string().url().max(300),
});

export const getPanelFilters = createServerFn({ method: "GET" }).handler(async () => {
  const { getPanelFilters: read } = await import("./panel-filters.server");
  return read();
});

export const savePanelFilters = createServerFn({ method: "POST" })
  .validator(filtersSchema)
  .handler(async ({ data }) => {
    const { savePanelFilters: write } = await import("./panel-filters.server");
    return write(data as PanelFilters);
  });
