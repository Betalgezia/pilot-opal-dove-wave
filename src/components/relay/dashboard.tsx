import { useMutation } from "@tanstack/react-query";
import { Activity, BarChart3, Check, ChevronRight, Clock3, Database, Download, FileText, Gauge, Globe2, Info, LayoutDashboard, Radio, RefreshCcw, RotateCcw, Server, Settings2, ShieldCheck, SlidersHorizontal, Square, Wifi, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { toast } from "sonner";
import { ExportPanel } from "@/components/relay/export-panel";
import { FilterPanel } from "@/components/relay/filter-panel";
import { LogPanel } from "@/components/relay/log-panel";
import { PoolPanel } from "@/components/relay/pool-panel";
import { SourcePanel } from "@/components/relay/source-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_SOURCES, SETTINGS_KEY, STORAGE_KEY } from "@/lib/vpn/defaults";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_TEST_URL } from "@/lib/vpn/constants";
import { formatMs, pickActive } from "@/lib/vpn/select";
import { getProbeCaps, scanSources } from "@/lib/vpn/scan.functions";
import type { ExportFormat, ProbedNode, ScanResult, SelectStrategy, SourceDef } from "@/lib/vpn/types";

interface Settings {
  autoRefresh: boolean;
  refreshMinutes: number;
  strategy: SelectStrategy;
  realProbe: boolean;
  testUrl: string;
  exportFmt: ExportFormat;
  exportN: number;
  perSource: number;
  globalCap: number;
  timeoutMs: number;
}

interface ScanProgress {
  active: boolean;
  phase: "idle" | "fetch" | "parse" | "sample" | "probe" | "geoip" | "deep" | "quality" | "done" | "error";
  percent: number;
  message: string;
  startedAt: number | null;
  updatedAt: number;
}

type ViewId = "home" | "sources" | "pool" | "filters" | "stats" | "logs" | "export" | "settings";

const DEFAULT_SETTINGS: Settings = {
  autoRefresh: false,
  refreshMinutes: 3,
  strategy: "fastest",
  realProbe: true,
  testUrl: DEFAULT_TEST_URL,
  exportFmt: DEFAULT_EXPORT_FMT,
  exportN: DEFAULT_EXPORT_N,
  perSource: 5000,
  globalCap: 20000,
  timeoutMs: 6000,
};

const DEFAULT_PROGRESS: ScanProgress = {
  active: false,
  phase: "idle",
  percent: 0,
  message: "Готово к сканированию",
  startedAt: null,
  updatedAt: Date.now(),
};

const NAV_GROUPS: Array<{ title: string; items: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> }> = [
  { title: "Обзор", items: [{ id: "home", label: "Главная", icon: LayoutDashboard }] },
  { title: "Данные", items: [{ id: "sources", label: "Источники", icon: Globe2 }, { id: "pool", label: "Пул", icon: Database }] },
  { title: "Управление", items: [{ id: "filters", label: "Фильтры", icon: SlidersHorizontal }, { id: "export", label: "Экспорт", icon: Download }] },
  { title: "Мониторинг", items: [{ id: "stats", label: "Статистика", icon: BarChart3 }, { id: "logs", label: "Логи", icon: FileText }] },
  { title: "Система", items: [{ id: "settings", label: "Настройки", icon: Settings2 }] },
];

function loadSources(): SourceDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOURCES;
    const parsed = JSON.parse(raw) as SourceDef[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function Dashboard() {
  const [view, setView] = useState<ViewId>("home");
  const [sources, setSources] = useState<SourceDef[]>(DEFAULT_SOURCES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<ProbedNode | null>(null);
  const [persist, setPersist] = useState(false);
  const [mihomoOk, setMihomoOk] = useState(true);
  const [progress, setProgress] = useState<ScanProgress>(DEFAULT_PROGRESS);
  const [logsUnread, setLogsUnread] = useState(0);
  const cancelRequestedRef = useRef(false);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    setSources(loadSources());
    setSettings(loadSettings());
    setPersist(true);
    getProbeCaps().then((caps) => setMihomoOk(Boolean(caps.mihomo))).catch(() => setMihomoOk(false));
  }, []);
  useEffect(() => { if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(sources)); }, [sources, persist]);
  useEffect(() => { if (persist) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings, persist]);
  useEffect(() => {
    if (!persist) return;
    void fetch("/api/sub", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sources, fmt: settings.exportFmt, n: settings.exportN, real: settings.realProbe && mihomoOk, testUrl: settings.testUrl || DEFAULT_TEST_URL }) }).catch(() => {});
  }, [sources, settings.exportFmt, settings.exportN, settings.realProbe, settings.testUrl, mihomoOk, persist]);

  async function pollProgress() {
    try {
      const response = await fetch("/api/scan/status", { cache: "no-store" });
      if (response.ok) setProgress(await response.json() as ScanProgress);
    } catch {}
  }
  useEffect(() => { void pollProgress(); const id = window.setInterval(() => void pollProgress(), 800); return () => window.clearInterval(id); }, []);
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/logs?since=${Date.now() - 10 * 60_000}`);
        if (!response.ok) return;
        const data = await response.json() as { logs: Array<{ level: string }> };
        setLogsUnread(data.logs.filter((log) => log.level === "error").length);
      } catch {}
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const scan = useMutation({
    mutationFn: async () => {
      const enabled = sourcesRef.current.filter((source) => source.enabled);
      if (!enabled.length) throw new Error("Включите хотя бы один источник");
      return scanSources({ data: { sources: enabled, perSource: Math.max(100, settings.perSource), globalCap: Math.max(100, settings.globalCap), timeoutMs: Math.max(500, settings.timeoutMs), real: settings.realProbe, testUrl: settings.testUrl || DEFAULT_TEST_URL, force: true } });
    },
    onSuccess: (data) => {
      cancelRequestedRef.current = false;
      setResult(data);
      setActive(pickActive(data, settings.strategy, active?.id));
      const nAlive = data.nodes.filter((node) => node.alive).length;
      setProgress((current) => ({ ...current, active: false, phase: "done", percent: 100, message: `${nAlive} живых узлов` }));
      if (!nAlive) toast.error(data.probeMode === "mihomo" ? "Живых узлов не найдено" : "Открытых портов не найдено");
      else toast.success(`Скан завершён · ${nAlive} живых`);
      if (data.probeNote) toast.message(data.probeNote);
    },
    onError: (error) => {
      if (cancelRequestedRef.current) return;
      const message = error instanceof Error ? error.message : "Скан не удался";
      setProgress((current) => ({ ...current, active: false, phase: "error", message }));
      toast.error(message);
    },
  });

  function startScan() {
    if (scan.isPending) return;
    cancelRequestedRef.current = false;
    setProgress({ active: true, phase: "fetch", percent: 2, message: "Запуск сканирования…", startedAt: Date.now(), updatedAt: Date.now() });
    scan.mutate();
  }
  async function stopScan() {
    if (!scan.isPending) return;
    cancelRequestedRef.current = true;
    try { await fetch("/api/scan/cancel", { method: "POST" }); toast.message("Сканирование остановлено"); }
    catch { toast.error("Не удалось остановить сканирование"); }
  }
  useEffect(() => {
    if (!settings.autoRefresh) return;
    const id = window.setInterval(() => { if (!scan.isPending) startScan(); }, Math.max(1, settings.refreshMinutes) * 60_000);
    return () => window.clearInterval(id);
  }, [settings.autoRefresh, settings.refreshMinutes, scan.isPending]);

  const alive = result?.nodes.filter((node) => node.alive).length ?? 0;
  const total = result?.nodes.length ?? 0;
  const unknown = result?.nodes.filter((node) => node.probeState === "unknown").length ?? 0;
  const dead = Math.max(0, total - alive - unknown);
  const healthySources = result?.sources.filter((source) => source.ok && source.alive > 0).length ?? 0;
  const parsedTotal = result?.parsedTotal ?? 0;
  const livePercent = total > 0 ? Math.round((alive / total) * 100) : 0;
  const status = progress.active ? "scanning" : progress.phase === "error" ? "error" : result ? (alive > 0 ? "live" : unknown > 0 ? "unknown" : "dead") : "idle";
  const strategyLabel = settings.strategy === "fallback" ? "сначала живой источник" : settings.strategy === "balanced" ? "чередование источников" : "самый быстрый";
  const statusLabel = status === "scanning" ? "SCANNING" : status === "live" ? "READY" : status === "error" ? "ERROR" : status === "dead" ? "DEAD" : "IDLE";
  const statusTone = status === "live" ? "bg-live" : status === "scanning" ? "bg-warning animate-pulse" : status === "error" || status === "dead" ? "bg-danger" : "bg-fg-subtle";

  function cycleStrategy() {
    const order: SelectStrategy[] = ["fastest", "fallback", "balanced"];
    const next = order[(order.indexOf(settings.strategy) + 1) % order.length];
    setSettings((current) => ({ ...current, strategy: next }));
    if (result) setActive(pickActive(result, next, active?.id));
  }
  function updateNumber(key: keyof Pick<Settings, "refreshMinutes" | "perSource" | "globalCap" | "timeoutMs">, value: string) {
    const next = Number(value);
    if (Number.isFinite(next)) setSettings((current) => ({ ...current, [key]: next }));
  }

  return <div className="min-h-dvh min-w-0 overflow-x-hidden bg-bg">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-xl"><div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface shadow-border"><Radio className="size-5 text-primary" /></span><div className="min-w-0"><p className="font-display text-sm font-semibold tracking-tight">Relay</p><p className="truncate text-[11px] text-fg-muted">network subscription control plane</p></div></div>
      <div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px] font-mono text-fg-muted sm:flex"><span className={`size-1.5 rounded-full ${statusTone}`} />{statusLabel}</span><Badge variant={mihomoOk ? "live" : "warn"}>mihomo {mihomoOk ? "ready" : "off"}</Badge><Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Справка"><Info /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Relay</DialogTitle><DialogDescription>Relay собирает источники, проверяет узлы, формирует пул и отдаёт постоянную live-подписку. Панель рассчитана на эксплуатацию и диагностику.</DialogDescription></DialogHeader></DialogContent></Dialog></div>
    </div></header>

    <main className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:px-8">
      <aside className="lg:sticky lg:top-[84px] lg:self-start"><nav className="rounded-2xl border border-border bg-surface p-2 shadow-border">
        {NAV_GROUPS.map((group) => <div key={group.title} className="not-first:mt-3"><p className="px-2.5 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{group.title}</p><div className="space-y-0.5">{group.items.map((item) => { const Icon = item.icon; const selected = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selected ? "bg-primary text-primary-foreground" : "text-fg-muted hover:bg-bg-subtle hover:text-fg"}`}><Icon className="size-3.5 shrink-0" /><span className="min-w-0 flex-1">{item.label}</span>{item.id === "logs" && logsUnread > 0 ? <span className={`font-mono text-[9px] ${selected ? "text-primary-foreground/70" : "text-danger"}`}>{logsUnread}</span> : null}{selected ? <ChevronRight className="size-3 opacity-60" /> : null}</button>; })}</div></div>)}
      </nav>
      <section className={`mt-3 rounded-2xl border p-3 shadow-border transition-colors ${progress.active || settings.autoRefresh ? "border-primary/30 bg-primary/[0.035]" : "border-border bg-surface"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">Control</p><p className="mt-0.5 text-[10px] text-fg-muted">{progress.active ? progress.message : settings.autoRefresh ? `auto · ${settings.refreshMinutes} min` : "manual"}</p></div><Activity className={`size-4 ${progress.active || settings.autoRefresh ? "animate-pulse text-primary" : "text-fg-subtle"}`} /></div><div className="mt-3"><div className="flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-fg-subtle"><span>{progress.active ? progress.phase : progress.phase === "done" ? "ready" : progress.phase}</span><span className="font-mono">{Math.round(progress.percent)}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-subtle"><div className={`h-full rounded-full transition-all duration-500 ${progress.phase === "done" ? "bg-live" : "bg-primary"}`} style={{ width: `${progress.percent}%` }} /></div></div><Button className="mt-3 h-9 w-full text-xs" onClick={() => progress.active || scan.isPending ? void stopScan() : startScan()}><span className="flex items-center gap-2">{progress.active || scan.isPending ? <Square className="size-3.5 fill-current" /> : <RefreshCcw className="size-3.5" />}{progress.active || scan.isPending ? "Остановить" : "Сканировать"}</span></Button><button type="button" onClick={cycleStrategy} className="mt-2 flex w-full items-center justify-between rounded-lg bg-bg-subtle px-2.5 py-2 text-[10px] text-fg-muted"><span>Стратегия</span><span className="font-mono text-fg">{strategyLabel}</span></button></section>
      </aside>

      <section className="min-w-0">
        {view === "home" ? <HomeView result={result} sources={sources} total={total} alive={alive} dead={dead} unknown={unknown} parsedTotal={parsedTotal} healthySources={healthySources} livePercent={livePercent} statusLabel={statusLabel} progress={progress} setView={setView} logsUnread={logsUnread} strategyLabel={strategyLabel} /> : null}
        {view === "sources" ? <PanelFrame icon={<Globe2 className="size-4 text-primary" />} title="Источники" description="Fetch → parse → deduplicate → pool" actions={<Button variant="ghost" size="sm" onClick={() => setSources(DEFAULT_SOURCES)}><RotateCcw />Сброс</Button>}><SourcePanel sources={sources} scans={result?.sources ?? []} onChange={setSources} /></PanelFrame> : null}
        {view === "pool" ? <PanelFrame icon={<Database className="size-4 text-primary" />} title="Пул" description="Текущее состояние всех обнаруженных узлов" actions={<Badge variant="live">{alive} live</Badge>}><div className="mb-4 grid gap-2 sm:grid-cols-4"><MetricTile icon={<Server />} label="Nodes" value={total} /><MetricTile icon={<Wifi />} label="Live" value={alive} tone="live" /><MetricTile icon={<XCircle />} label="Dead" value={dead} tone="danger" /><MetricTile icon={<Clock3 />} label="Unknown" value={unknown} tone="warn" /></div><PoolPanel nodes={result?.nodes ?? []} activeId={active?.id ?? null} onPick={(node) => { setActive(node); toast.message(`Выбрано: ${node.host}:${node.port}`); }} /></PanelFrame> : null}
        {view === "filters" ? <FilterPanel result={result} testUrl={settings.testUrl} onTestUrl={(testUrl) => setSettings((current) => ({ ...current, testUrl }))} /> : null}
        {view === "stats" ? <StatisticsView result={result} sources={sources} alive={alive} total={total} parsedTotal={parsedTotal} /> : null}
        {view === "logs" ? <PanelFrame icon={<FileText className="size-4 text-primary" />} title="Логи" description="Runtime, scan, probe и export события" actions={logsUnread > 0 ? <Badge variant="dead">{logsUnread} errors / 10m</Badge> : <Badge variant="live">clean</Badge>}><LogPanel /></PanelFrame> : null}
        {view === "export" ? <PanelFrame icon={<Download className="size-4 text-primary" />} title="Экспорт" description="Live-подписка, QR, host и формат выдачи"><ExportPanel result={result} sources={sources} fmt={settings.exportFmt} n={settings.exportN} real={settings.realProbe && mihomoOk} testUrl={settings.testUrl} onFmt={(exportFmt) => setSettings((current) => ({ ...current, exportFmt }))} onN={(exportN) => setSettings((current) => ({ ...current, exportN }))} /></PanelFrame> : null}
        {view === "settings" ? <SettingsView settings={settings} setSettings={setSettings} mihomoOk={mihomoOk} updateNumber={updateNumber} /> : null}
      </section>
    </main>
  </div>;
}

function PanelFrame({ icon, title, description, actions, children }: { icon: ReactNode; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return <div className="space-y-4"><header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bg-subtle">{icon}</span><div><h1 className="text-base font-semibold tracking-tight">{title}</h1><p className="mt-1 text-xs text-fg-muted">{description}</p></div></div>{actions ? <div className="flex items-center gap-2">{actions}</div> : null}</header>{children}</div>;
}

function HomeView({ result, sources, total, alive, dead, unknown, parsedTotal, healthySources, livePercent, statusLabel, progress, setView, logsUnread, strategyLabel }: { result: ScanResult | null; sources: SourceDef[]; total: number; alive: number; dead: number; unknown: number; parsedTotal: number; healthySources: number; livePercent: number; statusLabel: string; progress: ScanProgress; setView: (view: ViewId) => void; logsUnread: number; strategyLabel: string }) {
  const poolTone = livePercent >= 75 ? "live" : livePercent >= 40 ? "warn" : livePercent > 0 ? "danger" : "";
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Control plane</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Главная</h1><p className="mt-1 text-xs text-fg-muted">Состояние источников, пула и live-подписки в одном месте.</p></div><Badge variant={statusLabel === "READY" ? "live" : statusLabel === "ERROR" ? "dead" : statusLabel === "SCANNING" ? "warn" : "default"}>{statusLabel}</Badge></div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><MetricTile icon={<Globe2 />} label="Источники" value={sources.length} meta={`${healthySources}/${sources.length || 0} healthy`} /><MetricTile icon={<Zap />} label="URI" value={parsedTotal} meta={`${result?.uniqueTotal ?? 0} unique`} /><MetricTile icon={<Wifi />} label="LIVE" value={alive} tone="live" meta={`${dead} dead · ${unknown} unknown`} /><div className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle"><Gauge className="size-3.5 text-live" />READY</span><span className="font-mono text-sm text-live">{livePercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-subtle"><div className="h-full rounded-full bg-live transition-all duration-500" style={{ width: `${livePercent}%` }} /></div><div className="mt-2 flex items-center justify-between text-[10px] text-fg-muted"><span>{alive} / {total} nodes</span><span>{poolTone === "live" ? "healthy pool" : poolTone === "warn" ? "partial health" : "needs attention"}</span></div></div></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]"><section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle"><Globe2 className="size-4 text-primary" /></span><div><h2 className="text-sm font-semibold">Источник → состояние пула</h2><p className="text-[10px] text-fg-subtle">live / parsed по последнему скану</p></div></div><button type="button" onClick={() => setView("sources")} className="text-[10px] text-fg-muted hover:text-fg">Открыть источники →</button></div><div className="space-y-2">{(result?.sources ?? []).slice(0, 6).map((source) => { const percent = source.parsed ? Math.round((source.alive / source.parsed) * 100) : 0; return <div key={source.id} className="rounded-xl border border-border/70 bg-bg-subtle/50 px-3 py-2.5"><div className="flex items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${source.ok && source.alive > 0 ? "bg-live" : source.ok ? "bg-warning" : "bg-danger"}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-medium">{source.name}</span><span className="shrink-0 font-mono text-[10px] text-fg-muted">{source.alive} live / {source.parsed} URI</span></div><div className="mt-2 flex items-center gap-2"><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-live" style={{ width: `${Math.min(100, percent)}%` }} /></div><span className="w-8 shrink-0 text-right font-mono text-[9px] text-live">{percent}%</span></div></div></div></div>; })}{!result?.sources?.length ? <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-fg-muted">Запусти сканирование, чтобы увидеть состояние источников.</div> : null}</div></section><div className="space-y-4"><section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle"><Activity className="size-4 text-primary" /></span><div><h2 className="text-sm font-semibold">Runtime</h2><p className="text-[10px] text-fg-subtle">операционный контекст</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><RuntimeField label="Probe" value={result?.probeMode ?? "—"} mono /><RuntimeField label="Test URL" value={result?.testUrl ?? "—"} mono /><RuntimeField label="Last scan" value={result ? new Date(result.scannedAt).toLocaleTimeString() : "—"} mono /><RuntimeField label="Duration" value={result ? formatMs(result.durationMs) : "—"} mono /></div><div className="mt-3 flex items-center justify-between rounded-xl bg-bg-subtle px-3 py-2 text-[10px] text-fg-muted"><span>Strategy</span><span className="font-mono text-fg">{strategyLabel}</span></div></section><section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle"><FileText className="size-4 text-primary" /></span><div><h2 className="text-sm font-semibold">Signals</h2><p className="text-[10px] text-fg-subtle">за последние 10 минут</p></div></div><button type="button" onClick={() => setView("logs")} className="text-[10px] text-fg-muted hover:text-fg">Логи →</button></div><div className="mt-3 flex items-center justify-between rounded-xl bg-bg-subtle px-3 py-2.5"><span className="text-xs text-fg-muted">Ошибки</span><span className={`font-mono text-sm ${logsUnread ? "text-danger" : "text-live"}`}>{logsUnread}</span></div></section></div></div>
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-live/10"><Wifi className="size-4 text-live" /></span><div><h2 className="text-sm font-semibold">Live subscription</h2><p className="text-[10px] text-fg-subtle">Постоянный endpoint обновляется на сервере.</p></div></div><Button size="sm" onClick={() => setView("export")}><Download />Открыть экспорт</Button></div><div className="mt-3 rounded-xl border border-border bg-bg-subtle px-3 py-2.5 font-mono text-[11px] text-fg-muted break-all">/api/sub?live=1</div></section>
  </div>;
}

function StatisticsView({ result, sources, alive, total, parsedTotal }: { result: ScanResult | null; sources: SourceDef[]; alive: number; total: number; parsedTotal: number }) {
  const metrics = result?.metrics;
  const best = result?.sources.filter((source) => source.bestLatency !== null).sort((a, b) => (a.bestLatency ?? Infinity) - (b.bestLatency ?? Infinity))[0];
  const liveRate = total ? Math.round((alive / total) * 100) : 0;
  return <PanelFrame icon={<BarChart3 className="size-4 text-primary" />} title="Статистика" description="Метрики последнего сканирования и качество пула" actions={result ? <Badge variant="live">{new Date(result.scannedAt).toLocaleTimeString()}</Badge> : <Badge>нет данных</Badge>}><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><MetricTile icon={<Zap />} label="Parsed" value={parsedTotal} meta={`${sources.length} configured sources`} /><MetricTile icon={<Database />} label="Unique" value={result?.uniqueTotal ?? 0} meta={`${result?.nodes.length ?? 0} probed`} /><MetricTile icon={<Wifi />} label="Live rate" value={`${liveRate}%`} tone="live" meta={`${alive}/${total} nodes`} /><MetricTile icon={<Clock3 />} label="Scan" value={result ? formatMs(result.durationMs) : "—"} meta={result?.probeMode ?? "—"} /></div><div className="grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border border-border bg-bg-subtle/45 p-4"><div className="flex items-center gap-2"><Gauge className="size-4 text-primary" /><h2 className="text-sm font-semibold">Pipeline timings</h2></div><div className="mt-3 space-y-2">{metrics ? <><TimingRow label="Fetch" value={metrics.fetchMs} total={metrics.totalMs} /><TimingRow label="Parse" value={metrics.parseMs} total={metrics.totalMs} /><TimingRow label="Sample" value={metrics.sampleMs} total={metrics.totalMs} /><TimingRow label="Probe" value={metrics.probeMs} total={metrics.totalMs} /><TimingRow label="GeoIP" value={metrics.geoIpMs} total={metrics.totalMs} /><TimingRow label="Deep verify" value={metrics.deepVerifyMs} total={metrics.totalMs} /><TimingRow label="Quality" value={metrics.qualityMs} total={metrics.totalMs} /></> : <p className="text-xs text-fg-muted">Метрики появятся после следующего скана.</p>}</div></section><section className="rounded-2xl border border-border bg-bg-subtle/45 p-4"><div className="flex items-center gap-2"><Server className="size-4 text-primary" /><h2 className="text-sm font-semibold">Probe counters</h2></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{metrics ? <><StatBox label="Sampled" value={metrics.sampled} /><StatBox label="Deep verified" value={metrics.deepVerified} /><StatBox label="Target checks" value={metrics.targetChecks} /><StatBox label="mihomo loaded" value={metrics.mihomoLoaded} /><StatBox label="delay received" value={metrics.mihomoDelayReceived} /><StatBox label="unknown" value={metrics.unknown} /></> : <StatBox label="status" value="—" />}</div></section></div><section className="rounded-2xl border border-border bg-bg-subtle/45 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Globe2 className="size-4 text-primary" /><h2 className="text-sm font-semibold">Best source latency</h2></div><span className="font-mono text-xs text-live">{best ? formatMs(best.bestLatency) : "—"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{(result?.sources ?? []).map((source) => <div key={source.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-[10px]"><span className="truncate text-fg-muted">{source.name}</span><span className="font-mono text-fg">{formatMs(source.bestLatency)}</span></div>)}</div></section></PanelFrame>;
}

function SettingsView({ settings, setSettings, mihomoOk, updateNumber }: { settings: Settings; setSettings: Dispatch<SetStateAction<Settings>>; mihomoOk: boolean; updateNumber: (key: keyof Pick<Settings, "refreshMinutes" | "perSource" | "globalCap" | "timeoutMs">, value: string) => void }) {
  return <PanelFrame icon={<Settings2 className="size-4 text-primary" />} title="Настройки" description="Параметры runtime, probe, scan и export"><div className="grid gap-4 xl:grid-cols-2"><SettingsCard icon={<RefreshCcw />} title="Scan" description="Периодичность и ограничители сканирования"><SettingToggle label="Автообновление" hint="автоматически запускать скан" checked={settings.autoRefresh} onChange={(autoRefresh) => setSettings((current) => ({ ...current, autoRefresh }))} /><NumberField label="Интервал, мин" value={settings.refreshMinutes} onChange={(value) => updateNumber("refreshMinutes", value)} min={1} max={60} /><div className="grid gap-3 sm:grid-cols-2"><NumberField label="URI / source" value={settings.perSource} onChange={(value) => updateNumber("perSource", value)} min={100} max={50000} /><NumberField label="Global cap" value={settings.globalCap} onChange={(value) => updateNumber("globalCap", value)} min={100} max={100000} /></div></SettingsCard><SettingsCard icon={<ShieldCheck />} title="Probe" description="Проверка реальной доступности узлов"><SettingToggle label="Real probe" hint={mihomoOk ? "трафик через mihomo" : "mihomo недоступен"} checked={settings.realProbe && mihomoOk} disabled={!mihomoOk} onChange={(realProbe) => setSettings((current) => ({ ...current, realProbe }))} /><NumberField label="Timeout, ms" value={settings.timeoutMs} onChange={(value) => updateNumber("timeoutMs", value)} min={500} max={30000} /><label className="grid gap-1.5"><Label htmlFor="settings-test-url">Test URL</Label><Input id="settings-test-url" value={settings.testUrl} onChange={(event) => setSettings((current) => ({ ...current, testUrl: event.target.value }))} className="font-mono text-xs" /></label></SettingsCard><SettingsCard icon={<Zap />} title="Selection" description="Как выбирается активная нода"><button type="button" onClick={() => { const order: SelectStrategy[] = ["fastest", "fallback", "balanced"]; const next = order[(order.indexOf(settings.strategy) + 1) % order.length]; setSettings((current) => ({ ...current, strategy: next })); }} className="flex w-full items-center justify-between rounded-xl bg-bg-subtle px-3 py-3 text-xs"><span>Стратегия</span><span className="font-mono text-fg">{settings.strategy}</span></button><div className="mt-2 text-[10px] text-fg-muted">{settings.strategy === "fastest" ? "Предпочитает минимальную задержку." : settings.strategy === "fallback" ? "Сначала удерживает работоспособный источник." : "Балансирует выбор между источниками."}</div></SettingsCard><SettingsCard icon={<Download />} title="Export" description="Формат и размер выдачи"><div className="flex flex-wrap gap-2">{(["clash", "b64", "uri"] as ExportFormat[]).map((fmt) => <button key={fmt} type="button" onClick={() => setSettings((current) => ({ ...current, exportFmt: fmt }))} className={`rounded-lg border px-3 py-2 font-mono text-xs ${settings.exportFmt === fmt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{fmt}</button>)}</div><div className="mt-3 flex flex-wrap gap-2">{[12, 24, 40, 60].map((count) => <button key={count} type="button" onClick={() => setSettings((current) => ({ ...current, exportN: count }))} className={`rounded-lg border px-3 py-2 font-mono text-xs ${settings.exportN === count ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg-subtle text-fg-muted hover:text-fg"}`}>{count} nodes</button>)}</div></SettingsCard></div><div className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-[10px] text-fg-muted"><Check className="size-3.5 text-live" />Настройки сохраняются в браузере и синхронизируются с live-профилем Relay.</div></PanelFrame>;
}

function MetricTile({ icon, label, value, meta, tone = "" }: { icon: ReactNode; label: string; value: number | string; meta?: string; tone?: "live" | "danger" | "warn" | "" }) {
  const valueClass = tone === "live" ? "text-live" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg";
  const iconClass = tone === "live" ? "text-live" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warning" : "text-primary";
  return <div className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start justify-between gap-3"><span className={`flex size-8 items-center justify-center rounded-lg bg-bg-subtle ${iconClass}`}>{icon}</span><span className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</span></div><p className={`mt-3 font-mono text-2xl leading-none ${valueClass}`}>{value}</p>{meta ? <p className="mt-1.5 truncate text-[10px] text-fg-muted">{meta}</p> : null}</div>;
}

function RuntimeField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="rounded-lg bg-bg-subtle px-2.5 py-2"><p className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</p><p className={`mt-1 truncate text-[10px] text-fg ${mono ? "font-mono" : ""}`}>{value}</p></div>; }
function TimingRow({ label, value, total }: { label: string; value: number; total: number }) { const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0; return <div className="grid grid-cols-[6rem_minmax(0,1fr)_4.5rem] items-center gap-2"><span className="text-[10px] text-fg-muted">{label}</span><div className="h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div><span className="text-right font-mono text-[10px] text-fg">{formatMs(value)}</span></div>; }
function StatBox({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-bg px-3 py-2.5"><p className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</p><p className="mt-1 font-mono text-sm text-fg">{value}</p></div>; }
function SettingsCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) { return <section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-primary">{icon}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-[10px] text-fg-subtle">{description}</p></div></div><div className="mt-4 space-y-3">{children}</div></section>; }
function SettingToggle({ label, hint, checked, onChange, disabled = false }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-bg-subtle px-3 py-2.5"><div><p className="text-xs font-medium">{label}</p><p className="mt-0.5 text-[10px] text-fg-muted">{hint}</p></div><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} /></div>; }
function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: string) => void; min: number; max: number }) { return <label className="grid gap-1.5"><span className="text-[10px] text-fg-subtle">{label}</span><Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-xs" /></label>; }
