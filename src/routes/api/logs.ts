import { createFileRoute } from "@tanstack/react-router";
import { relayLogger, type LogLevel } from "@/lib/relay/logger";

const levels = new Set<LogLevel>(["info", "warn", "error"]);

export const Route = createFileRoute("/api/logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawLevel = url.searchParams.get("level") as LogLevel | null;
        const level = rawLevel && levels.has(rawLevel) ? rawLevel : undefined;
        const sinceRaw = Number(url.searchParams.get("since") || "0");
        const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : undefined;
        return Response.json({ logs: relayLogger.getLogs({ level, since }) });
      },
    },
  },
});
