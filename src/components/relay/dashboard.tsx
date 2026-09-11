import { useMutation } from "@tanstack/react-query";
import { Activity, Info, RefreshCcw, Server, Square, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LogPanel } from "@/components/relay/log-panel";
import { ExportPanel } from "@/components/relay/export-panel";
import { PoolPanel } from "@/components/relay/pool-panel";
import { SourcePanel } from "@/components/relay/source-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SOURCES, SETTINGS_KEY, STORAGE_KEY } from "@/lib/vpn/defaults";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_TEST_URL } from "@/lib/vpn/constants";
import { getProbeCaps, scanSources } from "@/lib/vpn/scan.functions";
import { formatMs, pickActive } from "@/lib/vpn/select";
import type { ExportFormat, ProbedNode, ScanResult, SelectStrategy, SourceDef } from "@/lib/vpn/types";

interface Settings {
  autoRefresh: boolean;
  strategy: SelectStrategy;
  realProbe: boolean;
  testUrl: string;
  exportFmt: ExportFormat;
  exportN: number;
}

const DEFAULT_SETTINGS: Settings = {
  autoRefresh: false,
  strategy: "fastest",
  realProbe: true,
  testUrl: DEFAULT_TEST_URL,
  exportFmt: DEFAULT_EXPORT_FMT,
  exportN: DEFAULT_EXPORT_N,
};

function loadSources(): SourceDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOURCES;
    const parsed = JSON.parse(raw) as SourceDef[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SOURCES;
    return parsed;
  } catch { return DEFAULT_SOURCES; }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) };
  } catch { return DEFAULT_SETTINGS; }
}

export function Dashboard() {
  const [sources, setSources] = useState<SourceDef[]>(DEFAULT_SOURCES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<ProbedNode | null>(null);
  const [persist, setPersist] = useState(false);
  const [mihomoOk, setMihomoOk] = useState(true);
  const [scanStopped, setScanStopped] = useState(false);
  const cancelRequestedRef = useRef(false);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    setSources(loadSources());
    setSettings(loadSettings());
    setPersist(true);
    getProbeCaps().then((caps) => setMihomoOk(Boolean(caps.mihomo))).catch(() => setMihomoOk(false));
  }, []);

  useEffect(() => {
    if (!persist) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  }, [sources, persist]);

  useEffect(() => {
    if (!persist) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, persist]);

  const scan = useMutation({
    mutationFn: async () => {
      const enabled = sourcesRef.current.filter((s) => s.enabled);
      if (enabled.length === 0) throw new Error("Включите хотя бы один источник");
      return scanSources({ data: {
        sources: enabled,
        perSource: 5000,
        globalCap: 20000,
        timeoutMs: settings.realProbe ? 6000 : 2200,
        real: settings.realProbe,
        testUrl: settings.testUrl || DEFAULT_TEST_URL,
        force: true,
      } });
    },
    onSuccess: (data) => {
      cancelRequestedRef.current = false;
      setScanStopped(false);
      setResult(data);
      const next = pickActive(data, settings.strategy, active?.id);
      setActive(next);
      const nAlive = data.nodes.filter((n) => n.alive).length;
      if (nAlive === 0) toast.error(data.probeMode === "mihomo" ? "Ни один сервер не пропустил трафик. Смените списки или URL проверки." : "Живых портов не нашлось. Смените списки или повторите.");
      else if (data.probeMode === "mihomo") toast.success(`Настоящая проверка · ${nAlive} серверов пропустили трафик`);
      else toast.success(`Проверка порта · ${nAlive} открытых из ${data.nodes.length}`);
      if (data.probeNote) toast.message(data.probeNote);
    },
    onError: (err) => {
      if (cancelRequestedRef.current) return;
      toast.error(err instanceof Error ? err.message : "Скан не удался");
    },
  });

  function startScan() {
    if (scan.isPending) return;
    cancelRequestedRef.current = false;
    setScanStopped(false);
    scan.mutate();
  }

  async function stopScan() {
    if (!scan.isPending) return;
    cancelRequestedRef.current = true;
    setScanStopped(true);
    try {
      await fetch("/api/scan/cancel", { method: "POST" });
      toast.message("Сканирование остановлено");
    } catch {
      toast.error("Не удалось отправить отмену сканирования");
    }
  }

  useEffect(() => {
    if (!settings.autoRefresh) return;
    const id = window.setInterval(() => { if (!scan.isPending) startScan(); }, 180_000);
    return () => window.clearInterval(id);
  }, [settings.autoRefresh, scan.isPending]);

  const alive = result?.nodes.filter((n) => n.alive).length ?? 0;
  const unknown = result?.nodes.filter((n) => n.probeState === "unknown").length ?? 0;
  const total = result?.nodes.length ?? 0;
  const dead = Math.max(0, total - alive - unknown);
  const enabledSources = sources.filter((s) => s.enabled).length;
  const healthySources = result?.sources.filter((s) => s.ok && s.alive > 0).length ?? 0;
  const strategyLabel = useMemo(() => {
    if (settings.strategy === "fallback") return "сначала живой источник";
    if (settings.strategy === "balanced") return "чередование источников";
    return "самый быстрый";
  }, [settings.strategy]);
  const engineState = scan.isPending ? "running" : mihomoOk ? "ready" : "unavailable";
  const engineLabel = scan.isPending ? "Сканирование" : mihomoOk ? "Mihomo готов" : "Mihomo недоступен";

  function cycleStrategy() {
    const order: SelectStrategy[] = ["fastest", "fallback", "balanced"];
    const next = order[(order.indexOf(settings.strategy) + 1) % order.length];
    setSettings((s) => ({ ...s, strategy: next }));
    if (result) setActive(pickActive(result, next, active?.id));
  }

  async function copyActive() {
    if (!active) { toast.error("Нет выбранной ноды"); return; }
    await navigator.clipboard.writeText(active.uri);
    toast.success("URI скопирован");
  }

  return (
    <div className="min-h-dvh min-w-0 overflow-x-hidden bg-bg">
      <header className="border-b border-border/70 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface shadow-border"><Activity className="size-4 text-fg" /></div>
            <div className="min-w-0"><p className="font-display text-sm font-medium tracking-tight">Relay</p><p className="truncate text-xs text-fg-muted">live proxy intelligence</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
            <span className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1.5 shadow-border sm:inline-flex"><span className={engineState === "ready" ? "size-1.5 rounded-full bg-live" : engineState === "running" ? "size-1.5 animate-pulse rounded-full bg-warning" : "size-1.5 rounded-full bg-danger"} />{engineLabel}</span>
            <span className="hidden font-mono tabular-nums md:inline">{total} nodes</span>
            <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Как пользоваться"><Info /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Как пользоваться</DialogTitle><DialogDescription>Relay проверяет источники и собирает пул узлов. Для подключения используйте Hiddify или другой клиент с поддержкой выбранного формата.</DialogDescription></DialogHeader><ol className="space-y-3 text-sm text-fg-muted"><li><span className="font-medium text-fg">1.</span> Добавьте или включите источники.</li><li><span className="font-medium text-fg">2.</span> Запустите сканирование.</li><li><span className="font-medium text-fg">3.</span> Проверьте живые узлы и откройте логи при проблемах.</li><li><span className="font-medium text-fg">4.</span> Экспортируйте готовую подписку.</li></ol></DialogContent></Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full min-w-0 max-w-7xl gap-5 px-4 py-5 pb-16 sm:px-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start">
        <aside className="min-w-0 lg:sticky lg:top-5">
          <div className="overflow-hidden rounded-xl bg-surface shadow-border">
            <div className="border-b border-border p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Control</p>
              <div className="mt-2 flex items-end justify-between gap-3"><div><p className="font-mono text-2xl font-medium tabular-nums">{alive}</p><p className="text-xs text-fg-muted">живых сейчас</p></div><Server className="size-5 text-fg-subtle" /></div>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-2"><MiniStat label="узлы" value={String(total)} /><MiniStat label="источники" value={`${healthySources}/${enabledSources}`} /><MiniStat label="мёртвые" value={String(dead)} /><MiniStat label="unknown" value={String(unknown)} /></div>
              <div className="space-y-2"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Engine</p><div className="flex items-center justify-between rounded-lg bg-bg-subtle px-3 py-2.5"><span className="text-xs">Mihomo</span><span className="flex items-center gap-1.5 text-[11px] text-fg-muted"><span className={mihomoOk ? "size-1.5 rounded-full bg-live" : "size-1.5 rounded-full bg-danger"} />{mihomoOk ? "ready" : "offline"}</span></div></div>
              <div className="space-y-2"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Check</p><label className="block space-y-1"><span className="text-xs text-fg-muted">URL</span><input value={settings.testUrl} onChange={(e) => setSettings((s) => ({ ...s, testUrl: e.target.value }))} className="h-9 w-full min-w-0 rounded-lg bg-bg-subtle px-2.5 font-mono text-[11px] text-fg outline-none" /></label><button type="button" onClick={cycleStrategy} className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg bg-bg-subtle px-2.5 text-left"><span className="text-xs">Стратегия</span><span className="truncate text-[10px] text-fg-muted">{strategyLabel}</span></button></div>
              <div className="space-y-3 border-t border-border pt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium">Auto refresh</p><p className="text-[10px] text-fg-subtle">каждые 3 минуты</p></div><Switch checked={settings.autoRefresh} onCheckedChange={(autoRefresh) => setSettings((s) => ({ ...s, autoRefresh }))} /></div><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium">Real probe</p><p className="text-[10px] text-fg-subtle">трафик через mihomo</p></div><Switch checked={settings.realProbe && mihomoOk} disabled={!mihomoOk} onCheckedChange={(realProbe) => setSettings((s) => ({ ...s, realProbe }))} /></div></div>
              <div className="space-y-2"><Button type="button" className="h-10 w-full" onClick={() => (scan.isPending ? void stopScan() : startScan())} disabled={scan.isPending && cancelRequestedRef.current}>{scan.isPending ? <Square className="size-3.5 fill-current" /> : <RefreshCcw className="size-3.5" />}{scan.isPending ? "Остановить" : "Сканировать"}</Button><Button type="button" variant="secondary" className="h-10 w-full text-xs" onClick={copyActive} disabled={!active}>Скопировать URI</Button></div>
              {active && <div className="rounded-lg bg-bg-subtle p-3"><p className="text-[10px] uppercase tracking-wider text-fg-subtle">Active node</p><p className="mt-1 truncate text-xs">{active.country ?? "XX"} · {active.name}</p><p className="mt-1 truncate font-mono text-[10px] text-fg-subtle">{active.host}:{active.port} · {formatMs(active.latency)}</p></div>}
              {scanStopped && <p className="text-[10px] leading-relaxed text-warning">Последний готовый пул сохранён.</p>}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <Tabs defaultValue="pool">
            <div className="mb-4 flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between"><TabsList className="w-fit"><TabsTrigger value="sources">Источники</TabsTrigger><TabsTrigger value="pool">Пул</TabsTrigger><TabsTrigger value="logs" className="gap-1.5"><Terminal className="size-3.5" />Логи</TabsTrigger><TabsTrigger value="export">Экспорт</TabsTrigger></TabsList><div className="flex items-center gap-3 text-[11px] text-fg-subtle"><span>{enabledSources} источников</span><span className="font-mono">{alive}/{total || 0} live</span></div></div>
            <TabsContent value="sources"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-medium">Sources</h2><p className="mt-0.5 text-xs text-fg-subtle">Источники → fetch → parse → pool</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setSources(DEFAULT_SOURCES)}>Сброс</Button></div><SourcePanel sources={sources} scans={result?.sources ?? []} onChange={setSources} /></TabsContent>
            <TabsContent value="pool"><PoolPanel nodes={result?.nodes ?? []} activeId={active?.id ?? null} onPick={(node) => { setActive(node); toast.message(`Выбрано: ${node.host}:${node.port}`); }} /></TabsContent>
            <TabsContent value="logs"><LogPanel /></TabsContent>
            <TabsContent value="export"><ExportPanel result={result} sources={sources} fmt={settings.exportFmt} n={settings.exportN} real={settings.realProbe && mihomoOk} testUrl={settings.testUrl} onFmt={(exportFmt) => setSettings((s) => ({ ...s, exportFmt }))} onN={(exportN) => setSettings((s) => ({ ...s, exportN }))} /></TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-bg-subtle px-2.5 py-2.5"><p className="font-mono text-sm tabular-nums text-fg">{value}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">{label}</p></div>;
}
