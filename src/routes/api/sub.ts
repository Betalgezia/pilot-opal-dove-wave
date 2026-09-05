import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N } from "@/lib/vpn/constants";
import { decodeSourceParam } from "@/lib/vpn/github";
import { buildB64Subscription, buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { pickExportNodes, runScan } from "@/lib/vpn/scan.server";

function cors(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "*");
}

export const Route = createFileRoute("/api/sub")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const headers = new Headers();
        cors(headers);
        return new Response(null, { status: 204, headers });
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const packed = url.searchParams.get("u") ?? "";
        const fmtRaw = (url.searchParams.get("fmt") ?? DEFAULT_EXPORT_FMT).toLowerCase();
        const fmt = fmtRaw === "clash" || fmtRaw === "uri" ? fmtRaw : "b64";
        const limit = Math.min(
          80,
          Math.max(4, Number(url.searchParams.get("n") || DEFAULT_EXPORT_N) || DEFAULT_EXPORT_N),
        );
        const real = url.searchParams.get("real") !== "0";
        const testUrl = url.searchParams.get("test") || undefined;
        const urls = decodeSourceParam(packed);
        if (urls.length === 0) {
          const headers = new Headers({ "content-type": "text/plain; charset=utf-8" });
          cors(headers);
          return new Response(
            "Relay subscription\nPass ?u=<encoded sources>&fmt=b64|clash|uri&n=40&real=1\n",
            { status: 400, headers },
          );
        }

        const sources = urls.map((u, i) => ({
          id: `s${i}`,
          name: `src-${i + 1}`,
          url: u,
          enabled: true,
        }));
        const result = await runScan(sources, {
          perSource: 14,
          globalCap: Math.min(64, Math.max(24, limit)),
          timeoutMs: 2000,
          real,
          testUrl,
        });
        const nodes = pickExportNodes(result, limit);
        const headers = new Headers();
        cors(headers);
        headers.set("cache-control", "public, max-age=60");
        headers.set("profile-update-interval", "1");
        headers.set("profile-title", "Relay");
        headers.set("x-relay-probe", result.probeMode);
        headers.set(
          "x-relay-alive",
          String(result.nodes.filter((n) => n.alive).length),
        );

        if (fmt === "uri") {
          headers.set("content-type", "text/plain; charset=utf-8");
          headers.set("content-disposition", 'attachment; filename="relay.txt"');
          return new Response(buildUriList(nodes), { headers });
        }
        if (fmt === "b64") {
          headers.set("content-type", "text/plain; charset=utf-8");
          headers.set("content-disposition", 'attachment; filename="relay.txt"');
          return new Response(buildB64Subscription(nodes), { headers });
        }

        headers.set("content-type", "text/yaml; charset=utf-8");
        headers.set("content-disposition", 'attachment; filename="relay.yaml"');
        return new Response(buildMihomoYaml(nodes, result.sources), { headers });
      },
    },
  },
});
