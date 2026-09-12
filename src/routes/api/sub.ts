import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_TEST_URL } from "@/lib/vpn/constants";
import { decodeSourceParam } from "@/lib/vpn/github";
import { buildB64Subscription, buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { getPanelFilters } from "@/lib/vpn/panel-filters.server";
import { filtersFromSearchParams, type SubscriptionFilters } from "@/lib/vpn/subscription-filter";
import { getSubscriptionProfile, saveSubscriptionProfile } from "@/lib/vpn/subscription-profile.server";
import { pickExportNodes, runScanCached } from "@/lib/vpn/scan.server";
import type { ExportFormat, SourceDef } from "@/lib/vpn/types";

function cors(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "*");
}

function hasExplicitFilters(url: URL): boolean {
  return ["proto", "cc", "wl", "bl", "blx"].some((key) => url.searchParams.has(key));
}

function formatFromRaw(value: unknown): ExportFormat {
  return value === "clash" || value === "uri" || value === "b64" ? value : DEFAULT_EXPORT_FMT;
}

export const Route = createFileRoute("/api/sub")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const headers = new Headers();
        cors(headers);
        return new Response(null, { status: 204, headers });
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            sources?: unknown;
            fmt?: unknown;
            n?: unknown;
            real?: unknown;
            testUrl?: unknown;
          };
          const profile = await saveSubscriptionProfile({
            sources: Array.isArray(body.sources) ? body.sources as SourceDef[] : [],
            fmt: formatFromRaw(body.fmt),
            n: Number(body.n) || DEFAULT_EXPORT_N,
            real: body.real !== false,
            testUrl: typeof body.testUrl === "string" && body.testUrl.trim() ? body.testUrl.trim() : DEFAULT_TEST_URL,
          });
          const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          cors(headers);
          return Response.json({ ok: true, updatedAt: profile.updatedAt }, { headers });
        } catch (error) {
          const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
          cors(headers);
          return Response.json({ ok: false, error: error instanceof Error ? error.message : "invalid request" }, { status: 400, headers });
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const live = url.searchParams.get("live") === "1";
        const profile = live ? await getSubscriptionProfile() : null;
        const fmtRaw = url.searchParams.get("fmt") ?? (live ? profile?.fmt : null) ?? DEFAULT_EXPORT_FMT;
        const fmt = formatFromRaw(String(fmtRaw).toLowerCase());
        const limitRaw = live ? profile?.n : url.searchParams.get("n");
        const limit = Math.min(60, Math.max(4, Number(limitRaw || DEFAULT_EXPORT_N) || DEFAULT_EXPORT_N));
        const fpPanel = live || url.searchParams.get("fp") === "panel";
        const real = live ? profile?.real !== false : url.searchParams.get("real") !== "0";
        const panel = await getPanelFilters();
        const explicit = !fpPanel && hasExplicitFilters(url);
        const filters: SubscriptionFilters = explicit ? filtersFromSearchParams(url.searchParams) : {
          protocols: panel.protocols,
          countryMode: panel.countryMode,
          countries: panel.countries,
          whitelistOnly: panel.whitelistOnly,
          blacklistEnabled: panel.blacklistEnabled,
          blacklistEntries: panel.blacklistEntries,
        };
        const testUrl = live ? profile?.testUrl || panel.testUrl || DEFAULT_TEST_URL : url.searchParams.get("test") || panel.testUrl || DEFAULT_TEST_URL;
        const packed = url.searchParams.get("u") ?? "";
        const urls = live ? (profile?.sources ?? []).filter((source) => source.enabled).map((source) => source.url) : decodeSourceParam(packed);
        if (urls.length === 0) {
          const headers = new Headers({ "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
          cors(headers);
          return new Response(live ? "Relay live subscription is not configured yet.\n" : "Relay subscription\nPass ?u=<encoded sources>&fmt=b64|clash|uri&n=40&fp=panel\n", { status: 400, headers });
        }
        const sources = live
          ? (profile?.sources ?? []).filter((source) => source.enabled)
          : urls.map((u, i) => ({ id: `s${i}`, name: `src-${i + 1}`, url: u, enabled: true }));
        const result = await runScanCached(sources, {
          perSource: 5000,
          globalCap: 20000,
          timeoutMs: 6000,
          real,
          testUrl,
        });
        const nodes = pickExportNodes(result, limit, filters);
        const headers = new Headers();
        cors(headers);
        headers.set("cache-control", live ? "no-store" : "public, max-age=60");
        headers.set("profile-update-interval", "60");
        headers.set("profile-title", "Relay");
        headers.set("x-relay-live", live ? "1" : "0");
        headers.set("x-relay-probe", result.probeMode);
        headers.set("x-relay-alive", String(result.nodes.filter((node) => node.alive).length));
        headers.set("x-relay-filtered", String(nodes.length));
        headers.set("x-relay-filter-source", explicit ? "url" : "panel");
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
