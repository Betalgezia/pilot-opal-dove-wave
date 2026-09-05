import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sourceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  url: z.string().min(8).max(500),
  enabled: z.boolean(),
});

export const scanSources = createServerFn({ method: "POST" })
  .validator(
    z.object({
      sources: z.array(sourceSchema).min(1).max(16),
      perSource: z.number().min(4).max(32).optional(),
      globalCap: z.number().min(8).max(80).optional(),
      timeoutMs: z.number().min(800).max(8000).optional(),
      real: z.boolean().optional(),
      testUrl: z.string().max(300).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { runScan } = await import("./scan.server");
    return runScan(data.sources, {
      perSource: data.perSource,
      globalCap: data.globalCap,
      timeoutMs: data.timeoutMs,
      real: data.real,
      testUrl: data.testUrl,
    });
  });

export const getProbeCaps = createServerFn({ method: "GET" }).handler(async () => {
  const { canRunMihomo } = await import("./mihomo-bin.server");
  return { mihomo: canRunMihomo() };
});
