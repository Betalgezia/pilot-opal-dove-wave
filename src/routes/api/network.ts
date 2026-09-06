import { networkInterfaces } from "node:os";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/network")({
  server: {
    handlers: {
      GET: async () => {
        const ipv4: string[] = [];
        for (const entries of Object.values(networkInterfaces())) {
          for (const entry of entries ?? []) {
            if (entry.family !== "IPv4" || entry.internal) continue;
            if (!ipv4.includes(entry.address)) ipv4.push(entry.address);
          }
        }
        const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
        headers.set("cache-control", "no-store");
        headers.set("access-control-allow-origin", "*");
        return new Response(JSON.stringify({ ipv4 }), { headers });
      },
    },
  },
});
