import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_SCAN_STRATEGY, DEFAULT_TEST_URL } from "@/lib/vpn/constants";
import { decodeSourceParam } from "@/lib/vpn/github";
import { relayLog } from "@/lib/vpn/log";
import { buildB64Subscription, buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { getPanelFilters } from "@/lib/vpn/panel-filters.server";
import { getLastScanResult, pickExportNodes, runScanCached } from "@/lib/vpn/scan.server";
import { filtersFromSearchParams, type SubscriptionFilters } from "@/lib/vpn/subscription-filter";
import type { ScanStrategy } from "@/lib/vpn/types";

function cors(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "*");
}

function hasExplicitFilters(url: URL): boolean {
  return ["proto", "cc", "wl", "bl", "blx"].some((key) => url.searchParams.has(key));
}

function parseScanStrategy(raw: string | null): ScanStrategy {
  if (raw === "batches" || raw === "groups" || raw === "full") return raw;
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
        const scanStrategy = parseScanStrategy(url.searchParams.get("sm") ?? url.searchParams.get("mode"));
        const idle = url.searchParams.get("idle") === "1";
        const geoip = url.searchParams.get("geoip") !== "0";
        const fpPanel = url.searchParams.get("fp") === "panel";
        const panel = await getPanelFilters();
        const explicit = !fpPanel && hasExplicitFilters(url);
        const filters: SubscriptionFilters = explicit
          ? filtersFromSearchParams(url.searchParams)
          : {
              protocols: panel.protocols,
              countryMode: panel.countryMode,
              countries: panel.countries,
              whitelistOnly: panel.whitelistOnly,
              blacklistEnabled: panel.blacklistEnabled,
              blacklistEntries: panel.blacklistEntries,
            };
        const testUrl = url.searchParams.get("test") || panel.testUrl || DEFAULT_TEST_URL;
        const urls = decodeSourceParam(packed);
        if (urls.length === 0) {
          const headers = new Headers({ "content-type": "text/plain; charset=utf-8" });
          cors(headers);
          return new Response(
            "Relay subscription\nPass ?u=<encoded sources>&fmt=b64|clash|uri&n=40&fp=panel&sm=full|batches|groups\n",
            { status: 400, headers },
          );
        }

        const sources = urls.map((u, i) => ({
          id: `s${i}`,
          name: `src-${i + 1}`,
          url: u,
          enabled: true,
        }));

        relayLog("/api/sub", {
          sm: scanStrategy,
          idle,
          fp: fpPanel ? "panel" : explicit ? "url" : "panel-default",
          n: limit,
          real,
        });

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
        headers.set("x-relay-filter-source", result && explicit ? "url" : "panel");
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
