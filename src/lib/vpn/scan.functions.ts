import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sourceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  url: z.string().min(8).max(500),
  enabled: z.boolean(),
});

const scanStrategySchema = z.enum(["full", "batches", "groups"]);

export const scanSources = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sources: z.array(sourceSchema).min(1).max(16),
      perSource: z.number().min(4).max(5000).optional(),
      globalCap: z.number().min(8).max(20000).optional(),
      timeoutMs: z.number().min(800).max(8000).optional(),
      real: z.boolean().optional(),
      testUrl: z.string().max(300).optional(),
      force: z.boolean().optional(),
      scanStrategy: scanStrategySchema.optional(),
      mode: scanStrategySchema.optional(),
      geoip: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const scanStrategy = data.scanStrategy ?? data.mode;
    const { relayLog } = await import("./log");
    relayLog("scanSources", {
      scanStrategy: scanStrategy ?? "full",
      real: data.real,
      force: data.force,
      sources: data.sources.length,
      perSource: data.perSource,
      globalCap: data.globalCap,
    });
    const { runScanCached } = await import("./scan.server");
    return runScanCached(data.sources, {
      perSource: data.perSource,
      globalCap: data.globalCap,
      timeoutMs: data.timeoutMs,
      real: data.real,
      testUrl: data.testUrl,
      force: data.force,
      scanStrategy,
      geoip: data.geoip,
    });
  });

export const getProbeCaps = createServerFn({ method: "GET" }).handler(async () => {
  const { canRunMihomo, mihomoInstallDir } = await import("./mihomo-bin.server");
  return { mihomo: canRunMihomo(), installDir: mihomoInstallDir() };
});
