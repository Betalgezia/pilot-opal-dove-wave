import { createFileRoute } from "@tanstack/react-router";
import { relayLogger } from "@/lib/relay/logger";

export const Route = createFileRoute("/api/logs/clear" as never)({
  server: {
    handlers: {
      POST: async () => {
        relayLogger.clear();
        return Response.json({ ok: true });
      },
    },
  },
});
