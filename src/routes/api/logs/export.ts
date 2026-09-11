import { createFileRoute } from "@tanstack/react-router";
import { relayLogger } from "@/lib/relay/logger";

export const Route = createFileRoute("/api/logs/export")({
  server: {
    handlers: {
      GET: async () => {
        const payload = JSON.stringify(relayLogger.getLogs(), null, 2);
        return new Response(payload, {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": 'attachment; filename="relay-logs.json"',
          },
        });
      },
    },
  },
});
