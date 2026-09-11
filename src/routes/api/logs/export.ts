import { createFileRoute } from "@tanstack/react-router";
import { relayLogger } from "@/lib/relay/logger";

export const Route = createFileRoute("/api/logs/export")({
  server: {
    handlers: {
      GET: async () => {
        const body = JSON.stringify({ exportedAt: Date.now(), logs: relayLogger.getLogs() }, null, 2);
        return new Response(body, {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": 'attachment; filename="relay-logs.json"',
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
