import QRCode from "qrcode";
import { Check, Copy, Download, Link2, QrCode, RotateCcw, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml } from "@/lib/vpn/mihomo";
import { getPanelFilters, savePanelFilters } from "@/lib/vpn/panel-filters.functions";
import { EMPTY_FILTERS, PROTOCOL_OPTIONS, filteredAliveCount, type SubscriptionFilters } from "@/lib/vpn/subscription-filter";
import { pickExportNodes } from "@/lib/vpn/select";
import type { ExportFormat, ScanResult, SourceDef, VpnProtocol } from "@/lib/vpn/types";

const FMT_OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "clash", label: "Mihomo YAML", hint: "конфиг" },
  { id: "b64", label: "Base64", hint: "подписка" },
  { id: "uri", label: "URI", hint: "текст" },
];
const N_OPTIONS = [12, 24, 40, 60];
type HostMode = "auto" | "localhost" | "lan";

function toggle<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function hostLabel(host: string) {
  return host === "localhost" ? "localhost" : host;
}

export function ExportPanel({
  result,
  sources,
  fmt,
  n,
  real,
  testUrl,
  onFmt,
  onN,
}: {
  result: ScanResult | null;
  sources: SourceDef[];
  fmt: ExportFormat;
  n: number;
  real: boolean;
  testUrl: string;
  onFmt: (fmt: ExportFormat) => void;
  onN: (n: number) => void;
}) {
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [hostMode, setHostMode] = useState<HostMode>("auto");
  const [selectedLanIp, setSelectedLanIp] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);

  useEffect(() => {
    void getPanelFilters()
      .then((saved) => {
        setFilters({
          protocols: saved.protocols,
          countryMode: saved.countryMode,
          countries: saved.countries,
          whitelistOnly: saved.whitelistOnly,
          blacklistEnabled: saved.blacklistEnabled,
          blacklistEntries: saved.blacklistEntries,
        });
        setFiltersLoaded(true);
      })
      .catch(() => setFiltersLoaded(true));
  }, []);

  useEffect(() => {
    if (filtersLoaded) void savePanelFilters({ data: { ...filters, testUrl } });
  }, [filters, testUrl, filtersLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { ipv4: [] }))
      .then((data: { ipv4?: unknown }) => {
        if (cancelled) return;
        const ips = Array.isArray(data.ipv4) ? data.ipv4.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
        setLanIps(ips);
        setSelectedLanIp((current) => current || ips[0] || "");
      })
      .catch(() => {
        if (!cancelled) setLanIps([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedHost = useMemo(() => {
    if (hostMode === "localhost") return "localhost";
    if (hostMode === "lan") return selectedLanIp || lanIps[0] || "127.0.0.1";
    if (lanIps.length > 0) return lanIps[0];
    if (typeof window === "undefined") return "localhost";
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" ? "127.0.0.1" : hostname;
  }, [hostMode, selectedLanIp, lanIps]);

  const panelUrl = useMemo(() => {
    if (!enabled.length) return "";
    const params = new URLSearchParams({
      u: encodeSourceParam(enabled),
      fmt,
      n: String(n),
      real: real ? "1" : "0",
      fp: "panel",
    });
    const port = typeof window !== "undefined" && window.location.port ? window.location.port : "8080";
    const base = selectedHost === "localhost" ? `http://localhost:${port}` : `http://${selectedHost}:${port}`;
    return `${base}/api/sub?${params.toString()}`;
  }, [enabled, fmt, n, real, selectedHost]);

  const countryOptions = useMemo(
    () => [...new Set((result?.nodes ?? []).map((node) => (node.country ?? "").toUpperCase()).filter(Boolean))].sort(),
    [result?.nodes],
  );
  const alive = result?.nodes.filter((node) => node.alive).length ?? 0;
  const filteredCount = result ? filteredAliveCount(result.nodes, filters) : 0;
  const exportNodes = result ? pickExportNodes(result, n, filters) : [];
  const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";

  useEffect(() => {
    let cancelled = false;
    if (!panelUrl) {
      setQr("");
      return () => {
        cancelled = true;
      };
    }
    void QRCode.toDataURL(panelUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [panelUrl]);

  async function copy(text: string) {
    if (!text) {
      toast.error("Сначала выполните сканирование");
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Ссылка скопирована");
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function downloadSubscription() {
    if (!panelUrl) {
      toast.error("Сначала выполните сканирование");
      return;
    }
    try {
      const response = await fetch(panelUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const extension = fmt === "clash" ? "yaml" : fmt === "b64" ? "txt" : "txt";
      const mime = fmt === "clash" ? "text/yaml;charset=utf-8" : "text/plain;charset=utf-8";
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relay-subscription.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось получить подписку");
    }
  }

  function resetFilters() {
    setFilters({ ...EMPTY_FILTERS, blacklistEntries: [] });
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-border">
        <div className="border-b border-border bg-primary/[0.035] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                <h2 className="text-sm font-medium">Живая подписка</h2>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-fg-muted">
                Ссылка постоянно отдаёт актуальный пул. Для телефона используй IP этого ПК, а не localhost.
              </p>
            </div>
            <span className="rounded-full bg-live/10 px-2.5 py-1 text-[10px] font-medium text-live">LIVE</span>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_190px]">
          <div className="min-w-0">
            <div className="rounded-xl border border-primary/10 bg-bg-subtle p-3 font-mono text-[11px] leading-relaxed break-all text-fg">
              {panelUrl || "Выполните сканирование, чтобы получить ссылку."}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void copy(panelUrl)} disabled={!panelUrl}>
                {copied ? <Check /> : <Copy />}
                Скопировать
              </Button>
              <Button variant="secondary" onClick={() => void downloadSubscription()} disabled={!panelUrl}>
                <Download />
                Скачать подписку
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-live/20 bg-live/[0.035] p-4">
              <div className="flex items-center gap-2">
                <Wifi className="size-4 text-live" />
                <div>
                  <p className="text-xs font-medium">Адрес для подключения</p>
                  <p className="text-[11px] text-fg-muted">В Hiddify используй адрес с IP локальной сети.</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHostMode("auto")}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${hostMode === "auto" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                >
                  IP ПК (авто)
                </button>
                <button
                  type="button"
                  onClick={() => setHostMode("localhost")}
                  className={`rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${hostMode === "localhost" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                >
                  localhost
                </button>
                {lanIps.map((ip) => (
                  <button
                    key={ip}
                    type="button"
                    onClick={() => {
                      setHostMode("lan");
                      setSelectedLanIp(ip);
                    }}
                    className={`rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${hostMode === "lan" && selectedLanIp === ip ? "border-live bg-live text-bg" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                  >
                    {ip}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="font-mono text-fg">{hostLabel(selectedHost)}:8080</span>
                <span className="text-fg-subtle">·</span>
                <span className="text-fg-muted">{selectedHost === "localhost" || selectedHost === "127.0.0.1" ? "только этот ПК" : "доступно устройствам в сети"}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-fg-muted">Формат</p>
                <div className="flex flex-wrap gap-2">
                  {FMT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onFmt(opt.id)}
                      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${fmt === opt.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                    >
                      {opt.label}
                      <span className="ml-1 opacity-60">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-fg-muted">Количество</p>
                <div className="flex flex-wrap gap-2">
                  {N_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onN(count)}
                      className={`rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${n === count ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted">
              <span><b className="text-live">{alive}</b> live</span>
              <span><b className="text-fg">{filteredCount}</b> проходят фильтры</span>
              <span>выбрано <b className="text-primary">{exportNodes.length}</b></span>
            </div>
          </div>

          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-primary/10 bg-white p-4">
            <div className="mb-2 flex w-full items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <span>QR subscription</span>
              <span className="font-mono">{selectedHost}</span>
            </div>
            {qr ? (
              <img src={qr} alt={`QR-код подписки Relay для ${selectedHost}`} className="size-40" />
            ) : (
              <div className="text-center text-xs text-slate-500">
                <QrCode className="mx-auto mb-2 size-8" />
                <p>{panelUrl ? "Генерация QR…" : "QR появится после сканирования"}</p>
              </div>
            )}
            {panelUrl && selectedHost !== "localhost" && selectedHost !== "127.0.0.1" ? (
              <span className="mt-3 rounded-full bg-live/10 px-2 py-1 text-[10px] font-medium text-live">Доступен телефону</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Фильтры подписки</div>
            <p className="mt-1 text-xs text-fg-muted">Они влияют только на экспорт, сам пул не изменяется.</p>
          </div>
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-fg-muted hover:bg-bg-subtle">
            <RotateCcw className="size-3.5" />
            Сбросить
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">Протокол</p>
            <div className="flex flex-wrap gap-2">
              {PROTOCOL_OPTIONS.map((protocol: VpnProtocol) => (
                <button
                  key={protocol}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, protocols: toggle(current.protocols, protocol) }))}
                  className={`rounded-full border px-3 py-1.5 font-mono text-xs ${filters.protocols.includes(protocol) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}
                >
                  {protocol}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-fg-muted">Страна</p>
              <div className="flex gap-1.5">
                {(["all", "ru", "foreign"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, countryMode: mode, countries: mode === "ru" ? ["RU"] : [] }))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] ${filters.countryMode === mode ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}
                  >
                    {mode === "all" ? "Все" : mode === "ru" ? "Только RU" : "Только вне RU"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-xl bg-bg-subtle/60 p-2">
              {countryOptions.length ? (
                countryOptions.map((country) => (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, countryMode: "custom", countries: toggle(current.countryMode === "custom" ? current.countries : [], country) }))}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${filters.countryMode === "custom" && filters.countries.includes(country) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-fg-muted"}`}
                  >
                    {country}
                  </button>
                ))
              ) : (
                <span className="text-xs text-fg-subtle">После сканирования здесь появятся страны.</span>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-xl border p-3 ${filters.whitelistOnly ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Только whitelist</p>
                  <p className="mt-1 text-[11px] text-fg-muted">SNI/host или IP из whitelist.</p>
                </div>
                <Switch checked={filters.whitelistOnly} onCheckedChange={(checked) => setFilters((current) => ({ ...current, whitelistOnly: checked }))} />
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${filters.blacklistEnabled ? "border-danger/30 bg-danger/5" : "border-border bg-bg-subtle/40"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Исключить blacklist</p>
                  <p className="mt-1 text-[11px] text-fg-muted">Статика + свои записи.</p>
                </div>
                <Switch checked={filters.blacklistEnabled} onCheckedChange={(checked) => setFilters((current) => ({ ...current, blacklistEnabled: checked }))} />
              </div>
              <textarea
                value={filters.blacklistEntries.join("\n")}
                onChange={(event) => setFilters((current) => ({ ...current, blacklistEntries: event.target.value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) }))}
                disabled={!filters.blacklistEnabled}
                rows={2}
                placeholder="example.com\n203.0.113.0/24"
                className="mt-3 w-full resize-y rounded-lg bg-bg-subtle px-3 py-2 font-mono text-xs disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
