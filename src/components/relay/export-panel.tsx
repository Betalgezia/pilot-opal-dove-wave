import { Check, Copy, Download, Filter, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import {
  EMPTY_FILTERS,
  PROTOCOL_OPTIONS,
  filteredAliveCount,
  filtersToSearchParams,
  type SubscriptionFilters,
} from "@/lib/vpn/subscription-filter";
import { pickExportNodes } from "@/lib/vpn/select";
import type { ExportFormat, ScanResult, ScanStrategy, SourceDef } from "@/lib/vpn/types";

const FMT_OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "b64", label: "b64", hint: "Hiddify" },
  { id: "clash", label: "clash", hint: "YAML" },
  { id: "uri", label: "uri", hint: "список" },
];

const N_OPTIONS = [12, 24, 40, 60];

function toggle<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function ExportPanel({
  result,
  sources,
  fmt,
  n,
  real,
  testUrl,
  scanStrategy,
  idle,
  geoip,
  onFmt,
  onN,
}: {
  result: ScanResult | null;
  sources: SourceDef[];
  fmt: ExportFormat;
  n: number;
  real: boolean;
  testUrl: string;
  scanStrategy: ScanStrategy;
  idle: boolean;
  geoip: boolean;
  onFmt: (fmt: ExportFormat) => void;
  onN: (n: number) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [hostMode, setHostMode] = useState<"auto" | "localhost" | "lan">("auto");
  const [selectedLanIp, setSelectedLanIp] = useState<string | null>(null);
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("network lookup failed"))))
      .then((data: { ipv4?: unknown }) => {
        if (!cancelled && Array.isArray(data.ipv4)) {
          const ips = data.ipv4.filter((x): x is string => typeof x === "string");
          setLanIps(ips);
          setSelectedLanIp((current) => current && ips.includes(current) ? current : (ips[0] ?? null));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const selectedHost = useMemo(() => {
    if (hostMode === "localhost") return "localhost";
    if (hostMode === "lan") return selectedLanIp ?? "127.0.0.1";
    if (typeof window === "undefined") return "localhost";
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" ? "localhost" : hostname;
  }, [hostMode, selectedLanIp]);

  const countryOptions = useMemo(() => {
    return [...new Set((result?.nodes ?? []).map((node) => (node.country ?? "").toUpperCase()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [result?.nodes]);

  const filteredCount = result ? filteredAliveCount(result.nodes, filters) : 0;
  const aliveCount = result?.nodes.filter((node) => node.alive).length ?? 0;
  const activeFilterCount =
    filters.protocols.length +
    (filters.countryMode !== "all" ? 1 : 0) +
    (filters.whitelistOnly ? 1 : 0) +
    (filters.blacklistEnabled ? 1 : 0);

  const subPath = useMemo(() => {
    if (enabled.length === 0) return "";
    const params = new URLSearchParams();
    params.set("u", encodeSourceParam(enabled));
    params.set("fmt", fmt);
    params.set("n", String(n));
    params.set("real", real ? "1" : "0");
    params.set("sm", scanStrategy);
    if (idle) params.set("idle", "1");
    if (!geoip) params.set("geoip", "0");
    if (testUrl) params.set("test", testUrl);
    filtersToSearchParams(params, filters);
    return `/api/sub?${params.toString()}`;
  }, [enabled, fmt, n, real, testUrl, scanStrategy, idle, geoip, filters]);

  const exportNodes = result ? pickExportNodes(result, n, filters) : [];
  const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";
  const uris = exportNodes.length ? buildUriList(exportNodes) : "";

  async function copy(label: string, text: string) {
    if (!text) {
      toast.error("Сначала нажмите «Сканировать»");
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Скопировано");
    window.setTimeout(() => setCopied(null), 1500);
  }

  function downloadYaml() {
    if (!yaml) {
      toast.error("Сначала нажмите «Сканировать»");
      return;
    }
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "relay.yaml";
    a.click();
    URL.revokeObjectURL(href);
    toast.message("Ищите relay.yaml в папке «Загрузки». Если файла нет — скопируйте YAML.");
  }

  function resetFilters() {
    setFilters({ ...EMPTY_FILTERS, protocols: [], countries: [], blacklistEntries: [] });
  }

  const subUrl = subPath
    ? `${selectedHost === "localhost" ? "http://localhost:8080" : `http://${selectedHost}:8080`}${subPath}`
    : "";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="size-4" />
              Фильтры подписки
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-bg-subtle px-2 py-0.5 font-mono text-[10px] text-fg-muted">
                  {activeFilterCount} активных
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              Применяются после проверки живости и до выбора самых быстрых серверов.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-fg-muted hover:bg-bg-subtle"
          >
            <RotateCcw className="size-3.5" />
            Сбросить
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">Протокол</p>
            <div className="flex flex-wrap gap-2">
              {PROTOCOL_OPTIONS.map((protocol) => {
                const activeProtocol = filters.protocols.includes(protocol);
                return (
                  <button
                    key={protocol}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, protocols: toggle(current.protocols, protocol) }))}
                    className={`rounded-full border px-3 py-1.5 font-mono text-xs transition ${
                      activeProtocol ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"
                    }`}
                  >
                    {protocol}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-fg-muted">Страна</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, countryMode: "all", countries: [] }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${filters.countryMode === "all" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, countryMode: "ru", countries: ["RU"] }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${filters.countryMode === "ru" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}
                >
                  Только Россия
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, countryMode: "foreign", countries: [] }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${filters.countryMode === "foreign" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}
                >
                  Только зарубежные
                </button>
              </div>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-lg bg-bg-subtle/60 p-2">
              {countryOptions.length ? countryOptions.map((country) => {
                const selected = filters.countryMode === "custom" && filters.countries.includes(country);
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setFilters((current) => ({
                      ...current,
                      countryMode: "custom",
                      countries: toggle(current.countryMode === "custom" ? current.countries : [], country),
                    }))}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-fg-muted"}`}
                  >
                    {country}
                  </button>
                );
              }) : <span className="px-1 py-1 text-xs text-fg-subtle">Сначала выполните сканирование.</span>}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-xl border p-3 transition ${filters.whitelistOnly ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Только «белые» SNI</p>
                    <p className="text-[11px] leading-relaxed text-fg-muted">
                      Берёт ноды, у которых SNI или host — yandex, vk, gosuslugi и другие из списка. Это маскировка Reality, а не проверка, что через сервер открывается Яндекс.
                    </p>
                  </div>
                </div>
                <Switch checked={filters.whitelistOnly} onCheckedChange={(checked) => setFilters((current) => ({ ...current, whitelistOnly: checked }))} />
              </div>
            </div>

            <div className={`rounded-xl border p-3 transition ${filters.blacklistEnabled ? "border-primary/40 bg-primary/5" : "border-border bg-bg-subtle/40"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ShieldOff className="size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Исключить чёрные списки</p>
                    <p className="text-[11px] text-fg-muted">По SNI/host и CIDR сервера. Свои домены — строками ниже.</p>
                  </div>
                </div>
                <Switch checked={filters.blacklistEnabled} onCheckedChange={(checked) => setFilters((current) => ({ ...current, blacklistEnabled: checked }))} />
              </div>
              <textarea
                value={filters.blacklistEntries.join("\n")}
                onChange={(event) => setFilters((current) => ({ ...current, blacklistEntries: event.target.value.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) }))}
                rows={3}
                placeholder={"example.com\n203.0.113.0/24"}
                className="mt-3 min-h-20 w-full resize-y rounded-lg bg-bg-subtle px-3 py-2 font-mono text-xs text-fg outline-none ring-0 placeholder:text-fg-subtle"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2.5">
            <div className="text-xs text-fg-muted">
              Прошло фильтры: <span className="font-mono font-medium text-fg">{filteredCount}</span>
              <span className="mx-1">из</span>
              <span className="font-mono">{aliveCount}</span> живых
            </div>
            <div className="text-[11px] text-fg-subtle">
              В подписку попадут максимум {n} самых быстрых.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-border">
        <p className="text-sm font-medium">Пока Relay запущен — подписка живая</p>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Hiddify и Clash ходят сюда за свежим списком. Если закрыть это окно или выключить компьютер, ссылка перестанет отвечать. С телефона не используйте localhost: нужен LAN IP ПК в той же Wi‑Fi сети и разрешённый входящий TCP 8080 в брандмауэре.
        </p>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Живая подписка</p>
        <p className="mt-1 text-sm text-fg-muted">
          Готовая ссылка для Hiddify: New Profile → Add from clipboard. Формат,
          количество, режим скана и фильтры сразу вшиты в URL.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setHostMode("auto")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "auto" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>Авто</button>
          <button type="button" onClick={() => setHostMode("localhost")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "localhost" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>Этот ПК</button>
          {lanIps.map((ip) => (
            <button
              key={ip}
              type="button"
              onClick={() => { setSelectedLanIp(ip); setHostMode("lan"); }}
              className={`h-9 rounded-md px-3 font-mono text-xs ${hostMode === "lan" && selectedLanIp === ip ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}
            >
              {ip} · телефон
            </button>
          ))}
        </div>
        {hostMode === "lan" ? (
          <p className="mt-2 text-xs text-fg-muted">Телефон и ПК должны быть в одной сети. localhost с телефона не работает.</p>
        ) : (
          <p className="mt-2 text-xs text-fg-muted">Для Hiddify на этом компьютере достаточно localhost.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {FMT_OPTIONS.map((opt) => (
            <button key={opt.id} type="button" onClick={() => onFmt(opt.id)} className={`h-9 rounded-md px-3 text-xs ${fmt === opt.id ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>
              {opt.label}<span className="ml-1 opacity-70">{opt.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {N_OPTIONS.map((count) => (
            <button key={count} type="button" onClick={() => onN(count)} className={`h-9 min-w-11 rounded-md px-3 font-mono text-xs ${n === count ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>
              {count}
            </button>
          ))}
        </div>
        <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted">
          {subUrl || "Добавьте хотя бы один источник"}
        </pre>
        <div className="mt-1 text-xs text-fg-subtle">
          Адрес подписки: <span className="font-mono">{selectedHost}</span>
          {hostMode === "lan" && !selectedLanIp ? " · LAN IPv4 не найден" : ""}
          {idle ? " · без автоскана" : ""}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => { if (!subUrl) { toast.error("Добавьте источник"); return; } void copy("sub", subUrl); }}>
            {copied === "sub" ? <Check /> : <Copy />}
            Скопировать URL
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Файл для компьютера</p>
        <p className="mt-1 text-sm text-fg-muted">
          Локальный YAML и URI используют те же фильтры, что и живая подписка.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={downloadYaml}><Download />Скачать relay.yaml</Button>
          <Button type="button" variant="secondary" onClick={() => copy("yaml", yaml)}>{copied === "yaml" ? <Check /> : <Copy />}Скопировать YAML</Button>
          <Button type="button" variant="secondary" onClick={() => copy("uri", uris)}>{copied === "uri" ? <Check /> : <Copy />}Скопировать URI</Button>
        </div>
      </div>
    </div>
  );
}
