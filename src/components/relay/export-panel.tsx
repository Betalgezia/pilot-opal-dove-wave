import { Check, Copy, Download, Filter, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { getPanelFilters, savePanelFilters } from "@/lib/vpn/panel-filters.functions";
import { EMPTY_FILTERS, PROTOCOL_OPTIONS, filteredAliveCount, filtersToSearchParams, type SubscriptionFilters } from "@/lib/vpn/subscription-filter";
import { pickExportNodes } from "@/lib/vpn/select";
import type { ExportFormat, ScanResult, SourceDef, VpnProtocol } from "@/lib/vpn/types";

const FMT_OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "b64", label: "b64", hint: "Hiddify" },
  { id: "clash", label: "clash", hint: "YAML" },
  { id: "uri", label: "uri", hint: "список" },
];
const N_OPTIONS = [12, 24, 40, 60];

function toggle<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function hostUrl(host: string, path: string): string {
  return `${host === "localhost" ? "http://localhost:8080" : `http://${host}:8080`}${path}`;
}

export function ExportPanel({ result, sources, fmt, n, real, testUrl, onFmt, onN }: {
  result: ScanResult | null;
  sources: SourceDef[];
  fmt: ExportFormat;
  n: number;
  real: boolean;
  testUrl: string;
  onFmt: (fmt: ExportFormat) => void;
  onN: (n: number) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [hostMode, setHostMode] = useState<"auto" | "localhost" | "lan">("auto");
  const [selectedLanIp, setSelectedLanIp] = useState<string | null>(null);
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);

  useEffect(() => {
    let cancelled = false;
    void getPanelFilters().then((saved) => {
      if (cancelled) return;
      setFilters({ protocols: saved.protocols, countryMode: saved.countryMode, countries: saved.countries, whitelistOnly: saved.whitelistOnly, blacklistEnabled: saved.blacklistEnabled, blacklistEntries: saved.blacklistEntries });
      setFiltersLoaded(true);
    }).catch(() => setFiltersLoaded(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network").then((res) => (res.ok ? res.json() : Promise.reject(new Error("network lookup failed"))))
      .then((data: { ipv4?: unknown }) => {
        if (cancelled || !Array.isArray(data.ipv4)) return;
        const ips = data.ipv4.filter((x): x is string => typeof x === "string");
        setLanIps(ips);
        setSelectedLanIp((current) => current && ips.includes(current) ? current : (ips[0] ?? null));
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void savePanelFilters({ ...filters, testUrl }); }, 500);
    return () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [filters, testUrl, filtersLoaded]);

  const selectedHost = useMemo(() => {
    if (hostMode === "localhost") return "localhost";
    if (hostMode === "lan") return selectedLanIp ?? "127.0.0.1";
    if (typeof window === "undefined") return "localhost";
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" ? "localhost" : hostname;
  }, [hostMode, selectedLanIp]);

  const countryOptions = useMemo(() => [...new Set((result?.nodes ?? []).map((node) => (node.country ?? "").toUpperCase()).filter(Boolean))].sort(), [result?.nodes]);
  const filteredCount = result ? filteredAliveCount(result.nodes, filters) : 0;
  const aliveCount = result?.nodes.filter((node) => node.alive).length ?? 0;
  const activeFilterCount = filters.protocols.length + (filters.countryMode !== "all" ? 1 : 0) + (filters.whitelistOnly ? 1 : 0) + (filters.blacklistEnabled ? 1 : 0);

  const panelPath = useMemo(() => {
    if (!enabled.length) return "";
    const params = new URLSearchParams({ u: encodeSourceParam(enabled), fmt, n: String(n), real: real ? "1" : "0", fp: "panel" });
    return `/api/sub?${params.toString()}`;
  }, [enabled, fmt, n, real]);

  const frozenPath = useMemo(() => {
    if (!enabled.length) return "";
    const params = new URLSearchParams({ u: encodeSourceParam(enabled), fmt, n: String(n), real: real ? "1" : "0" });
    if (testUrl) params.set("test", testUrl);
    filtersToSearchParams(params, filters);
    return `/api/sub?${params.toString()}`;
  }, [enabled, fmt, n, real, testUrl, filters]);

  const exportNodes = result ? pickExportNodes(result, n, filters) : [];
  const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";
  const uris = exportNodes.length ? buildUriList(exportNodes) : "";
  const panelUrl = panelPath ? hostUrl(selectedHost, panelPath) : "";
  const frozenUrl = frozenPath ? hostUrl(selectedHost, frozenPath) : "";

  async function copy(label: string, text: string) {
    if (!text) { toast.error("Сначала нажмите «Обновить пул»"); return; }
    await navigator.clipboard.writeText(text);
    setCopied(label); toast.success("Скопировано");
    window.setTimeout(() => setCopied(null), 1500);
  }

  function downloadYaml() {
    if (!yaml) { toast.error("Сначала нажмите «Обновить пул»"); return; }
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const href = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = href; a.download = "relay.yaml"; a.click(); URL.revokeObjectURL(href);
  }

  function resetFilters() { setFilters({ ...EMPTY_FILTERS, blacklistEntries: [] }); }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-border">
        <div className="flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4" />Фильтры подписки{activeFilterCount > 0 && <span className="rounded-full bg-bg-subtle px-2 py-0.5 font-mono text-[10px] text-fg-muted">{activeFilterCount} активных</span>}</div><p className="mt-1 text-xs text-fg-muted">Меняйте фильтры здесь — уже добавленная подписка обновится сама.</p></div>
          <button type="button" onClick={resetFilters} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-fg-muted hover:bg-bg-subtle"><RotateCcw className="size-3.5" />Сбросить</button>
        </div>
        <div className="mt-4 space-y-4">
          <div><p className="mb-2 text-xs font-medium text-fg-muted">Протокол</p><div className="flex flex-wrap gap-2">{PROTOCOL_OPTIONS.map((protocol: VpnProtocol) => <button key={protocol} type="button" onClick={() => setFilters((current) => ({ ...current, protocols: toggle(current.protocols, protocol) }))} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${filters.protocols.includes(protocol) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{protocol}</button>)}</div></div>
          <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-fg-muted">Страна</p><div className="flex flex-wrap gap-1.5">{(["all", "ru", "foreign"] as const).map((mode) => <button key={mode} type="button" onClick={() => setFilters((current) => ({ ...current, countryMode: mode, countries: mode === "ru" ? ["RU"] : [] }))} className={`rounded-full px-2.5 py-1 text-[11px] ${filters.countryMode === mode ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{mode === "all" ? "Все" : mode === "ru" ? "Только Россия" : "Только зарубежные"}</button>)}</div></div><div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-lg bg-bg-subtle/60 p-2">{countryOptions.length ? countryOptions.map((country) => <button key={country} type="button" onClick={() => setFilters((current) => ({ ...current, countryMode: "custom", countries: toggle(current.countryMode === "custom" ? current.countries : [], country) }))} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${filters.countryMode === "custom" && filters.countries.includes(country) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-fg-muted"}`}>{country}</button>) : <span className="px-1 py-1 text-xs text-fg-subtle">Сначала выполните сканирование.</span>}</div></div>
          <div className="grid gap-3 md:grid-cols-2"><div className={`rounded-xl border p-3 ${filters.whitelistOnly ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><ShieldCheck className="size-4 shrink-0" /><div><p className="text-sm font-medium">Только whitelist-совместимые</p><p className="text-[11px] text-fg-muted">SNI/host или IP из whitelist.</p></div></div><Switch checked={filters.whitelistOnly} onCheckedChange={(checked) => setFilters((current) => ({ ...current, whitelistOnly: checked }))} /></div></div><div className={`rounded-xl border p-3 ${filters.blacklistEnabled ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><ShieldOff className="size-4 shrink-0" /><div><p className="text-sm font-medium">Исключить чёрные списки</p><p className="text-[11px] text-fg-muted">Статика + ваши домены/CIDR.</p></div></div><Switch checked={filters.blacklistEnabled} onCheckedChange={(checked) => setFilters((current) => ({ ...current, blacklistEnabled: checked }))} /></div><textarea value={filters.blacklistEntries.join("\n")} onChange={(event) => setFilters((current) => ({ ...current, blacklistEntries: event.target.value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) }))} rows={3} placeholder="example.com\n203.0.113.0/24" className="mt-3 min-h-20 w-full resize-y rounded-lg bg-bg-subtle px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-subtle" /></div></div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2.5"><div className="text-xs text-fg-muted">Прошло фильтры: <span className="font-mono font-medium text-fg">{filteredCount}</span> из <span className="font-mono">{aliveCount}</span> живых</div><div className="text-[11px] text-fg-subtle">Максимум {n} самых быстрых.</div></div>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Живая подписка</p>
        <p className="mt-1 text-sm text-fg-muted">Скопируйте эту ссылку один раз. Она использует сохранённые фильтры панели — менять ссылку в Hiddify не нужно.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setHostMode("auto")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "auto" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>Авто</button><button type="button" onClick={() => setHostMode("localhost")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "localhost" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>localhost</button>{lanIps.map((ip) => <button key={ip} type="button" onClick={() => { setSelectedLanIp(ip); setHostMode("lan"); }} className={`h-9 rounded-md px-3 font-mono text-xs ${hostMode === "lan" && selectedLanIp === ip ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{ip}</button>)}</div>
        <div className="mt-2 flex flex-wrap gap-2">{FMT_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => onFmt(opt.id)} className={`h-9 rounded-md px-3 text-xs ${fmt === opt.id ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{opt.label}<span className="ml-1 opacity-70">{opt.hint}</span></button>)}</div>
        <div className="mt-2 flex flex-wrap gap-2">{N_OPTIONS.map((count) => <button key={count} type="button" onClick={() => onN(count)} className={`h-9 min-w-11 rounded-md px-3 font-mono text-xs ${n === count ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{count}</button>)}</div>
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted">{panelUrl || "Добавьте хотя бы один источник"}</pre>
        <div className="mt-1 text-xs text-fg-subtle">Адрес подписки: <span className="font-mono">{selectedHost}</span> · фильтры: <span className="font-medium text-fg">панель</span></div>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={() => copy("sub", panelUrl)}>{copied === "sub" ? <Check /> : <Copy />}Скопировать URL</Button><Button type="button" variant="secondary" onClick={() => copy("frozen", frozenUrl)}>{copied === "frozen" ? <Check /> : <Copy />}Скопировать ссылку с текущими фильтрами в URL</Button></div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-border"><p className="text-sm font-medium">Файл для компьютера</p><p className="mt-1 text-sm text-fg-muted">YAML и URI используют текущие фильтры. Изменение фильтров не запускает новое сканирование.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={downloadYaml}><Download />Скачать relay.yaml</Button><Button type="button" variant="secondary" onClick={() => copy("yaml", yaml)}>{copied === "yaml" ? <Check /> : <Copy />}Скопировать YAML</Button><Button type="button" variant="secondary" onClick={() => copy("uri", uris)}>{copied === "uri" ? <Check /> : <Copy />}Скопировать URI</Button></div></div>

      <p className="text-xs text-fg-subtle">URL проверки сохраняется вместе с фильтрами. После его изменения нажмите «Обновить пул», чтобы выполнить новую проверку; сама подписка затем возьмёт сохранённый URL.</p>
    </div>
  );
}
