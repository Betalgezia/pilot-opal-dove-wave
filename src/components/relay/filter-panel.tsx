import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Globe2, RotateCcw, Save, ShieldBan, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getPanelFilters, savePanelFilters } from "@/lib/vpn/panel-filters.functions";
import { EMPTY_FILTERS, PROTOCOL_OPTIONS, type SubscriptionFilters } from "@/lib/vpn/subscription-filter";
import type { ScanResult, VpnProtocol } from "@/lib/vpn/types";

const COUNTRY_MODES: Array<{ id: SubscriptionFilters["countryMode"]; label: string }> = [
  { id: "all", label: "Любые" },
  { id: "ru", label: "RU" },
  { id: "foreign", label: "Не RU" },
  { id: "custom", label: "Выбранные" },
];

const PROTOCOL_LABELS: Record<VpnProtocol, string> = {
  vless: "VLESS",
  vmess: "VMess",
  ss: "SS",
  trojan: "Trojan",
  hysteria2: "Hysteria2",
  tuic: "TUIC",
};

export function FilterPanel({ result, testUrl, onTestUrl }: { result: ScanResult | null; testUrl: string; onTestUrl: (value: string) => void }) {
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const [loaded, setLoaded] = useState(false);
  const [blacklistText, setBlacklistText] = useState("");

  useEffect(() => {
    void getPanelFilters().then((saved) => {
      setFilters({
        protocols: saved.protocols,
        countryMode: saved.countryMode,
        countries: saved.countries,
        whitelistOnly: saved.whitelistOnly,
        blacklistEnabled: saved.blacklistEnabled,
        blacklistEntries: saved.blacklistEntries,
      });
      setBlacklistText(saved.blacklistEntries.join("\n"));
      onTestUrl(saved.testUrl);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  // Parent callback is intentionally used only to seed the shared test URL on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countryOptions = useMemo(
    () => [...new Set((result?.nodes ?? []).map((node) => (node.country ?? "").toUpperCase()).filter(Boolean))].sort(),
    [result?.nodes],
  );
  const alive = result?.nodes.filter((node) => node.alive).length ?? 0;

  function toggleProtocol(protocol: VpnProtocol) {
    setFilters((current) => ({ ...current, protocols: current.protocols.includes(protocol) ? current.protocols.filter((item) => item !== protocol) : [...current.protocols, protocol] }));
  }

  function toggleCountry(country: string) {
    setFilters((current) => ({ ...current, countries: current.countries.includes(country) ? current.countries.filter((item) => item !== country) : [...current.countries, country] }));
  }

  async function save() {
    try {
      const normalizedBlacklist = blacklistText.split(/\r?\n|,/).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      const next = { ...filters, blacklistEntries: normalizedBlacklist, testUrl };
      const saved = await savePanelFilters({ data: next });
      setFilters({ protocols: saved.protocols, countryMode: saved.countryMode, countries: saved.countries, whitelistOnly: saved.whitelistOnly, blacklistEnabled: saved.blacklistEnabled, blacklistEntries: saved.blacklistEntries });
      setBlacklistText(saved.blacklistEntries.join("\n"));
      onTestUrl(saved.testUrl);
      toast.success("Фильтры сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить фильтры");
    }
  }

  async function reset() {
    const next = { ...EMPTY_FILTERS, blacklistEntries: [...EMPTY_FILTERS.blacklistEntries], testUrl };
    setFilters(next);
    setBlacklistText(next.blacklistEntries.join("\n"));
    try {
      await savePanelFilters({ data: next });
      toast.success("Фильтры сброшены");
    } catch {
      toast.error("Не удалось сохранить сброс");
    }
  }

  return (
    <div className="space-y-4">
      <PanelHeader icon={<SlidersHorizontal className="size-4 text-primary" />} title="Фильтрация подписки" description="Фильтры применяются к live-подписке и экспортируемому пулу." actions={<><Button variant="ghost" size="sm" onClick={() => void reset()}><RotateCcw />Сброс</Button><Button size="sm" onClick={() => void save()} disabled={!loaded}><Save />Сохранить</Button></>} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-border">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-live" /><h2 className="text-sm font-semibold">Protocol filter</h2></div><p className="mt-1 text-xs text-fg-muted">Пустой список = разрешены все протоколы.</p></div><Badge variant={filters.protocols.length ? "default" : "live"}>{filters.protocols.length ? `${filters.protocols.length} выбрано` : "all"}</Badge></div>
          <div className="mt-4 flex flex-wrap gap-2">{PROTOCOL_OPTIONS.map((protocol) => { const selected = filters.protocols.includes(protocol); return <button key={protocol} type="button" onClick={() => toggleProtocol(protocol)} className={`rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{selected ? <Check className="mr-1 inline size-3" /> : null}{PROTOCOL_LABELS[protocol]}</button>; })}</div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-border">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Globe2 className="size-4 text-primary" /><h2 className="text-sm font-semibold">Country filter</h2></div><p className="mt-1 text-xs text-fg-muted">Ограничивает узлы по GeoIP.</p></div><Badge>{filters.countryMode}</Badge></div>
          <div className="mt-4 flex flex-wrap gap-2">{COUNTRY_MODES.map((mode) => <button key={mode.id} type="button" onClick={() => setFilters((current) => ({ ...current, countryMode: mode.id }))} className={`rounded-lg border px-3 py-2 text-xs ${filters.countryMode === mode.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{mode.label}</button>)}</div>
          {filters.countryMode === "custom" ? <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-auto rounded-xl bg-bg-subtle p-2">{countryOptions.length ? countryOptions.map((country) => { const selected = filters.countries.includes(country); return <button key={country} type="button" onClick={() => toggleCountry(country)} className={`rounded-md px-2 py-1 font-mono text-[10px] ${selected ? "bg-live/15 text-live" : "text-fg-muted hover:bg-bg"}`}>{country}</button>; }) : <span className="px-1 text-xs text-fg-subtle">Страны появятся после сканирования.</span>}</div> : null}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-border">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-live" /><h2 className="text-sm font-semibold">Whitelist</h2></div><p className="mt-1 text-xs text-fg-muted">Разрешать только домены/IP из встроенного whitelist.</p></div><Switch checked={filters.whitelistOnly} onCheckedChange={(whitelistOnly) => setFilters((current) => ({ ...current, whitelistOnly }))} /></div>
          <div className="mt-4 rounded-xl border border-live/15 bg-live/[0.035] p-3 text-[11px] text-fg-muted">Используются преднастроенные домены и CIDR из конфигурации Relay. Редактировать их здесь не требуется.</div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 shadow-border">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldBan className="size-4 text-danger" /><h2 className="text-sm font-semibold">Blacklist</h2></div><p className="mt-1 text-xs text-fg-muted">По одному домену или CIDR на строку.</p></div><Switch checked={filters.blacklistEnabled} onCheckedChange={(blacklistEnabled) => setFilters((current) => ({ ...current, blacklistEnabled }))} /></div>
          <textarea value={blacklistText} onChange={(event) => setBlacklistText(event.target.value)} disabled={!filters.blacklistEnabled} className="mt-4 min-h-32 w-full resize-y rounded-xl border border-border bg-bg-subtle p-3 font-mono text-[11px] text-fg outline-none placeholder:text-fg-subtle focus:border-primary disabled:opacity-50" placeholder={"example.com\n10.0.0.0/8"} />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-border">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="text-sm font-semibold">Probe target</h2></div><p className="mt-1 text-xs text-fg-muted">URL используется для реальной проверки через mihomo.</p></div><Badge variant={testUrl ? "live" : "warn"}>{alive} live nodes</Badge></div>
        <div className="mt-4 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-center"><Label htmlFor="filter-test-url">Test URL</Label><Input id="filter-test-url" value={testUrl} onChange={(event) => onTestUrl(event.target.value)} className="font-mono text-xs" /></div>
      </section>
    </div>
  );
}

function PanelHeader({ icon, title, description, actions }: { icon: ReactNode; title: string; description: string; actions: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bg-subtle">{icon}</span><div><h1 className="text-base font-semibold tracking-tight">{title}</h1><p className="mt-1 text-xs text-fg-muted">{description}</p></div></div><div className="flex shrink-0 items-center gap-2">{actions}</div></div>;
}
