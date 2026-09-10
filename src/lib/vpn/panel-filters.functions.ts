import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_TEST_URL } from "./constants";
import { relayError, relayLog } from "./log";
import type { PanelFilters } from "./panel-filters.server";

const protocolSchema = z.enum(["vless", "vmess", "ss", "trojan", "hysteria2", "tuic"]);

const filtersSchema = z.object({
  protocols: z.array(protocolSchema).max(8).default([]),
  countryMode: z.enum(["all", "ru", "foreign", "custom"]).default("all"),
  countries: z.array(z.string().min(1).max(8)).max(256).default([]),
  whitelistOnly: z.boolean().default(false),
  blacklistEnabled: z.boolean().default(false),
  blacklistEntries: z.array(z.string().max(253)).max(512).default([]),
  testUrl: z.string().max(300).optional(),
});

export const getPanelFilters = createServerFn({ method: "POST" })
  .validator(z.object({}).optional())
  .handler(async () => {
    try {
      const { getPanelFilters: read } = await import("./panel-filters.server");
      const filters = await read();
      relayLog("getPanelFilters ok");
      return filters;
    } catch (err) {
      relayError("getPanelFilters failed", err);
      throw err;
    }
  });

export const savePanelFilters = createServerFn({ method: "POST" })
  .validator(filtersSchema)
  .handler(async ({ data }) => {
    try {
      const { savePanelFilters: write } = await import("./panel-filters.server");
      const payload: PanelFilters = {
        ...data,
        testUrl: data.testUrl?.trim() || DEFAULT_TEST_URL,
      };
      const saved = await write(payload);
      relayLog("savePanelFilters ok");
      return saved;
    } catch (err) {
      relayError("savePanelFilters failed", err);
      throw err;
    }
  });
