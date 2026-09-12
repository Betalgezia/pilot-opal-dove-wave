import { createFileRoute } from "@tanstack/react-router";
import { relayLogger, type LogCategory, type LogLevel } from "@/lib/relay/logger";

const levels = new Set<LogLevel>(["info", "warn", "error"]);
const categories = new Set<LogCategory>(["scan", "mihomo", "fetch", "parse", "system", "publish"]);

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawLevel = url.searchParams.get("level") as LogLevel | null;
        const rawCategory = url.searchParams.get("category") as LogCategory | null;
        const level = rawLevel && levels.has(rawLevel) ? rawLevel : undefined;
        const category = rawCategory && categories.has(rawCategory) ? rawCategory : undefined;
        const sinceRaw = Number(url.searchParams.get("since") || "0");
        const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;
        return Response.json({ logs: relayLogger.getLogs({ level, category, since }) });
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { level?: unknown; category?: unknown; message?: unknown; data?: unknown };
          const level = body.level && levels.has(body.level as LogLevel) ? body.level as LogLevel : null;
          const category = body.category && categories.has(body.category as LogCategory) ? body.category as LogCategory : null;
          if (!level || !category || typeof body.message !== "string" || !body.message.trim()) {
            return new Response("invalid log entry", { status: 400 });
          }
          const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : undefined;
          relayLogger[level](category, body.message.trim(), data);
          return Response.json({ ok: true }, { status: 201 });
        } catch {
          return new Response("invalid json", { status: 400 });
        }
      },
    },
  },
});