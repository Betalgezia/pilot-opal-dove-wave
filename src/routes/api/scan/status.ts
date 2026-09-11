import { createFileRoute } from "@tanstack/react-router";
import { getScanProgress } from "@/lib/vpn/scan-control.server";

export const Route = createFileRoute("/api/scan/status" as never)({
  server: {
    handlers: {
      GET: async () => Response.json(getScanProgress()),
    },
  },
});
