import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_SCAN_STRATEGY } from "@/lib/vpn/constants";
import { decodeSourceParam } from "@/lib/vpn/github";
import { buildB64Subscription, buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { filtersFromSearchParams } from "@/lib/vpn/subscription-filter";
import { getLastScanResult, pickExportNodes, runScanCached } from "@/lib/vpn/scan.server";
import type { ScanStrategy } from "@/lib/vpn/types";

function cors(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "*");
}

function parseScanStrategy(raw: string | null): ScanStrategy {
  if (raw === "batches" || raw === "groups") return raw;
  return DEFAULT_SCAN_STRATEGY;
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
          60,
          Math.max(4, Number(url.searchParams.get("n") || DEFAULT_EXPORT_N) || DEFAULT_EXPORT_N),
        );
        const real = url.searchParams.get("real") !== "0";
        const testUrl = url.searchParams.get("test") || undefined;
        const scanStrategy = parseScanStrategy(url.searchParams.get("sm"));
        const idle = url.searchParams.get("idle") === "1";
        const geoip = url.searchParams.get("geoip") !== "0";
        const filters = filtersFromSearchParams(url.searchParams);
        const urls = decodeSourceParam(packed);
        if (urls.length === 0) {
          const headers = new Headers({ "content-type": "text/plain; charset=utf-8" });
          cors(headers);
          return new Response(
            "Relay subscription\nPass ?u=<encoded sources>&fmt=b64|clash|uri&n=40&real=1&sm=full|batches|groups&idle=0&proto=vless,vmess&cc=RU&wl=1&bl=1\n",
            { status: 400, headers },
          );
        }

        const sources = urls.map((u, i) => ({
          id: `s${i}`,
          name: `src-${i + 1}`,
          url: u,
          enabled: true,
        }));

        let result = idle ? getLastScanResult() : null;
        if (!result) {
          if (idle) {
            const headers = new Headers({ "content-type": "text/plain; charset=utf-8" });
            cors(headers);
            return new Response(
              "Нет готового пула. Сначала нажмите «Сканировать» в панели Relay.\n",
              { status: 503, headers },
            );
          }
          result = await runScanCached(sources, {
            perSource: 3000,
            globalCap: 20000,
            timeoutMs: 6000,
            real,
            testUrl,
            scanStrategy,
            geoip,
          });
        }
        const nodes = pickExportNodes(result, limit, filters);
        const headers = new Headers();
        cors(headers);
        headers.set("cache-control", "public, max-age=60");
        headers.set("profile-update-interval", "1");
        headers.set("profile-title", "Relay");
        headers.set("x-relay-probe", result.probeMode);
        headers.set("x-relay-strategy", result.scanStrategy ?? scanStrategy);
        headers.set("x-relay-idle", idle ? "1" : "0");
        headers.set("x-relay-alive", String(result.nodes.filter((node) => node.alive).length));
        headers.set("x-relay-filtered", String(nodes.length));
        headers.set("x-relay-scanned-at", String(result.scannedAt));

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
