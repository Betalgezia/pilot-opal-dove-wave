import { createFileRoute } from "@tanstack/react-router";
import type { LogLevel } from "@/lib/relay/logger";
import { relayLogger } from "@/lib/relay/logger";

const LEVELS = new Set<LogLevel>(["info", "warn", "error"]);

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawLevel = url.searchParams.get("level")?.toLowerCase();
        const level = rawLevel && LEVELS.has(rawLevel as LogLevel) ? rawLevel as LogLevel : undefined;
        const sinceRaw = Number(url.searchParams.get("since"));
        const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;
        return Response.json({ logs: relayLogger.getLogs({ level, since }) });
      },
    },
  },
});
