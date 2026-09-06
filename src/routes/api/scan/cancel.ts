import { createFileRoute } from "@tanstack/react-router";
import { cancelActiveScan } from "@/lib/vpn/scan-control.server";

export const Route = createFileRoute("/api/scan/cancel")({
  server: {
    handlers: {
      POST: async () => {
        const cancelled = await cancelActiveScan();
        const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
        headers.set("cache-control", "no-store");
        headers.set("access-control-allow-origin", "*");
        headers.set("access-control-allow-methods", "POST, OPTIONS");
        return new Response(JSON.stringify({ cancelled }), {
          status: 200,
          headers,
        });
      },
      OPTIONS: async () => {
        const headers = new Headers();
        headers.set("access-control-allow-origin", "*");
        headers.set("access-control-allow-methods", "POST, OPTIONS");
        headers.set("access-control-allow-headers", "*");
        return new Response(null, { status: 204, headers });
      },
    },
  },
});
