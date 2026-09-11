import QRCode from "qrcode";
import { Check, Copy, Download, Link2, QrCode, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
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
function toggle<T>(items: T[], value: T): T[] { return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]; }

export function ExportPanel({ result, sources, fmt, n, real, testUrl, onFmt, onN }: { result: ScanResult | null; sources: SourceDef[]; fmt: ExportFormat; n: number; real: boolean; testUrl: string; onFmt: (fmt: ExportFormat) => void; onN: (n: number) => void; }) {
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);

  useEffect(() => { void getPanelFilters().then((saved) => { setFilters({ protocols: saved.protocols, countryMode: saved.countryMode, countries: saved.countries, whitelistOnly: saved.whitelistOnly, blacklistEnabled: saved.blacklistEnabled, blacklistEntries: saved.blacklistEntries }); setFiltersLoaded(true); }).catch(() => setFiltersLoaded(true)); }, []);
  useEffect(() => { if (filtersLoaded) void savePanelFilters({ data: { ...filters, testUrl } }); }, [filters, testUrl, filtersLoaded]);
  const panelUrl = useMemo(() => { if (!enabled.length || typeof window === "undefined") return ""; const params = new URLSearchParams({ u: encodeSourceParam(enabled), fmt, n: String(n), real: real ? "1" : "0", fp: "panel" }); return `${window.location.origin}/api/sub?${params.toString()}`; }, [enabled, fmt, n, real]);
  const countryOptions = useMemo(() => [...new Set((result?.nodes ?? []).map((node) => (node.country ?? "").toUpperCase()).filter(Boolean))].sort(), [result?.nodes]);
  const alive = result?.nodes.filter((node) => node.alive).length ?? 0;
  const filteredCount = result ? filteredAliveCount(result.nodes, filters) : 0;
  const exportNodes = result ? pickExportNodes(result, n, filters) : [];
  const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";
  useEffect(() => { let cancelled = false; if (!panelUrl) { setQr(""); return; } QRCode.toDataURL(panelUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then((url) => { if (!cancelled) setQr(url); }).catch(() => { if (!cancelled) setQr(""); }); return () => { cancelled = true; }; }, [panelUrl]);
  async function copy(text: string) { if (!text) { toast.error("Сначала выполните сканирование"); return; } await navigator.clipboard.writeText(text); setCopied(true); toast.success("Ссылка скопирована"); window.setTimeout(() => setCopied(false), 1500); }
  function download(text: string, filename: string, mime: string) { if (!text) { toast.error("Сначала выполните сканирование"); return; } const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  function resetFilters() { setFilters({ ...EMPTY_FILTERS, blacklistEntries: [] }); }

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl bg-surface shadow-border">
      <div className="border-b border-border p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Link2 className="size-4" /><h2 className="text-sm font-medium">Живая подписка</h2></div><p className="mt-1 max-w-xl text-xs leading-relaxed text-fg-muted">Одна ссылка для телефона или Hiddify. Она обновляется вместе с текущим пулом и выбранными фильтрами.</p></div><span className="rounded-full bg-live/10 px-2.5 py-1 text-[10px] font-medium text-live">LIVE</span></div></div>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="min-w-0"><div className="rounded-xl bg-bg-subtle p-3 font-mono text-[11px] leading-relaxed break-all text-fg-muted">{panelUrl || "Выполните сканирование, чтобы получить ссылку."}</div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void copy(panelUrl)} disabled={!panelUrl}>{copied ? <Check /> : <Copy />}Скопировать</Button><Button variant="secondary" onClick={() => download(yaml, "relay.yaml", "text/yaml;charset=utf-8")} disabled={!yaml}><Download />relay.yaml</Button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs font-medium text-fg-muted">Формат</p><div className="flex flex-wrap gap-2">{FMT_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => onFmt(opt.id)} className={`rounded-lg border px-3 py-2 text-xs ${fmt === opt.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{opt.label}<span className="ml-1 opacity-60">{opt.hint}</span></button>)}</div></div><div><p className="mb-2 text-xs font-medium text-fg-muted">Количество</p><div className="flex flex-wrap gap-2">{N_OPTIONS.map((count) => <button key={count} type="button" onClick={() => onN(count)} className={`rounded-lg border px-3 py-2 font-mono text-xs ${n === count ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{count}</button>)}</div></div></div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted"><span><b className="text-fg">{alive}</b> live</span><span><b className="text-fg">{filteredCount}</b> проходят фильтры</span><span>выбрано <b className="text-fg">{exportNodes.length}</b></span></div>
        </div>
        <div className="flex min-h-[180px] items-center justify-center rounded-xl bg-white p-3">{qr ? <img src={qr} alt="QR-код подписки Relay" className="size-40" /> : <div className="text-center text-xs text-fg-subtle"><QrCode className="mx-auto mb-2 size-8" /><p>QR появится<br />после сканирования</p></div>}</div>
      </div>
    </section>
    <section className="rounded-2xl bg-surface p-5 shadow-border"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">Фильтры подписки</div><p className="mt-1 text-xs text-fg-muted">Они влияют только на экспорт, сам пул не изменяется.</p></div><button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-fg-muted hover:bg-bg-subtle"><RotateCcw className="size-3.5" />Сбросить</button></div>
      <div className="mt-4 space-y-4"><div><p className="mb-2 text-xs font-medium text-fg-muted">Протокол</p><div className="flex flex-wrap gap-2">{PROTOCOL_OPTIONS.map((protocol: VpnProtocol) => <button key={protocol} type="button" onClick={() => setFilters((current) => ({ ...current, protocols: toggle(current.protocols, protocol) }))} className={`rounded-full border px-3 py-1.5 font-mono text-xs ${filters.protocols.includes(protocol) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{protocol}</button>)}</div></div>
      <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-fg-muted">Страна</p><div className="flex gap-1.5">{(["all", "ru", "foreign"] as const).map((mode) => <button key={mode} type="button" onClick={() => setFilters((current) => ({ ...current, countryMode: mode, countries: mode === "ru" ? ["RU"] : [] }))} className={`rounded-lg px-2.5 py-1 text-[11px] ${filters.countryMode === mode ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{mode === "all" ? "Все" : mode === "ru" ? "Только RU" : "Только вне RU"}</button>)}</div></div><div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-xl bg-bg-subtle/60 p-2">{countryOptions.length ? countryOptions.map((country) => <button key={country} type="button" onClick={() => setFilters((current) => ({ ...current, countryMode: "custom", countries: toggle(current.countryMode === "custom" ? current.countries : [], country) }))} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${filters.countryMode === "custom" && filters.countries.includes(country) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-fg-muted"}`}>{country}</button>) : <span className="text-xs text-fg-subtle">После сканирования здесь появятся страны.</span>}</div></div>
      <div className="grid gap-3 md:grid-cols-2"><div className={`rounded-xl border p-3 ${filters.whitelistOnly ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm">Только whitelist</p><p className="mt-1 text-[11px] text-fg-muted">SNI/host или IP из whitelist.</p></div><Switch checked={filters.whitelistOnly} onCheckedChange={(checked) => setFilters((current) => ({ ...current, whitelistOnly: checked }))} /></div></div><div className={`rounded-xl border p-3 ${filters.blacklistEnabled ? "border-danger/30 bg-danger/5" : "border-border bg-bg-subtle/40"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm">Исключить blacklist</p><p className="mt-1 text-[11px] text-fg-muted">Статика + свои записи.</p></div><Switch checked={filters.blacklistEnabled} onCheckedChange={(checked) => setFilters((current) => ({ ...current, blacklistEnabled: checked }))} /></div><textarea value={filters.blacklistEntries.join("\n")} onChange={(event) => setFilters((current) => ({ ...current, blacklistEntries: event.target.value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) }))} disabled={!filters.blacklistEnabled} rows={2} placeholder="example.com\n203.0.113.0/24" className="mt-3 w-full resize-y rounded-lg bg-bg-subtle px-3 py-2 font-mono text-xs disabled:opacity-40" /></div></div></div>
    </section>
  </div>;
}
