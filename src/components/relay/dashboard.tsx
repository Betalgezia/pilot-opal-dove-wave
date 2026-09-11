import { useMutation } from "@tanstack/react-query";
import { Activity, Info, RefreshCcw, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConnectDial } from "@/components/relay/connect-dial";
import { ExportPanel } from "@/components/relay/export-panel";
import { LogPanel } from "@/components/relay/log-panel";
import { PoolPanel } from "@/components/relay/pool-panel";
import { SourcePanel } from "@/components/relay/source-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SOURCES, SETTINGS_KEY, STORAGE_KEY } from "@/lib/vpn/defaults";
import { DEFAULT_EXPORT_FMT, DEFAULT_EXPORT_N, DEFAULT_TEST_URL } from "@/lib/vpn/constants";
import { getProbeCaps, scanSources } from "@/lib/vpn/scan.functions";
import { formatMs, pickActive } from "@/lib/vpn/select";
import type { ExportFormat, ProbedNode, ScanResult, SelectStrategy, SourceDef } from "@/lib/vpn/types";

interface Settings { autoRefresh: boolean; strategy: SelectStrategy; realProbe: boolean; testUrl: string; exportFmt: ExportFormat; exportN: number; }
interface ScanProgress { active: boolean; phase: "idle" | "fetch" | "parse" | "sample" | "probe" | "geoip" | "deep" | "quality" | "done" | "error"; percent: number; message: string; startedAt: number | null; updatedAt: number; }
const DEFAULT_SETTINGS: Settings = { autoRefresh: false, strategy: "fastest", realProbe: true, testUrl: DEFAULT_TEST_URL, exportFmt: DEFAULT_EXPORT_FMT, exportN: DEFAULT_EXPORT_N };
const DEFAULT_PROGRESS: ScanProgress = { active: false, phase: "idle", percent: 0, message: "Готово к сканированию", startedAt: null, updatedAt: Date.now() };
function loadSources(): SourceDef[] { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return DEFAULT_SOURCES; const parsed = JSON.parse(raw) as SourceDef[]; return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SOURCES; } catch { return DEFAULT_SOURCES; } }
function loadSettings(): Settings { try { const raw = localStorage.getItem(SETTINGS_KEY); if (!raw) return DEFAULT_SETTINGS; return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) }; } catch { return DEFAULT_SETTINGS; } }

export function Dashboard() {
  const [sources, setSources] = useState<SourceDef[]>(DEFAULT_SOURCES);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<ProbedNode | null>(null);
  const [persist, setPersist] = useState(false);
  const [mihomoOk, setMihomoOk] = useState(true);
  const [scanStopped, setScanStopped] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>(DEFAULT_PROGRESS);
  const [logsUnread, setLogsUnread] = useState(0);
  const cancelRequestedRef = useRef(false);
  const sourcesRef = useRef(sources); sourcesRef.current = sources;

  useEffect(() => { setSources(loadSources()); setSettings(loadSettings()); setPersist(true); getProbeCaps().then((caps) => setMihomoOk(Boolean(caps.mihomo))).catch(() => setMihomoOk(false)); }, []);
  useEffect(() => { if (!persist) return; localStorage.setItem(STORAGE_KEY, JSON.stringify(sources)); }, [sources, persist]);
  useEffect(() => { if (!persist) return; localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings, persist]);

  async function pollProgress() { try { const res = await fetch("/api/scan/status", { cache: "no-store" }); if (res.ok) setProgress(await res.json() as ScanProgress); } catch {} }
  useEffect(() => { void pollProgress(); const id = window.setInterval(() => void pollProgress(), 800); return () => window.clearInterval(id); }, []);
  useEffect(() => { const id = window.setInterval(async () => { try { const res = await fetch("/api/logs?since=" + (Date.now() - 10 * 60_000)); if (!res.ok) return; const data = await res.json() as { logs: Array<{ level: string }> }; setLogsUnread(data.logs.filter((log) => log.level === "error").length); } catch {} }, 5000); return () => window.clearInterval(id); }, []);

  const scan = useMutation({
    mutationFn: async () => {
      const enabled = sourcesRef.current.filter((s) => s.enabled);
      if (!enabled.length) throw new Error("Включите хотя бы один источник");
      return scanSources({ data: { sources: enabled, perSource: 5000, globalCap: 20000, timeoutMs: settings.realProbe ? 6000 : 2200, real: settings.realProbe, testUrl: settings.testUrl || DEFAULT_TEST_URL, force: true } });
    },
    onSuccess: (data) => { cancelRequestedRef.current = false; setScanStopped(false); setResult(data); const next = pickActive(data, settings.strategy, active?.id); setActive(next); const nAlive = data.nodes.filter((n) => n.alive).length; setProgress((current) => ({ ...current, active: false, phase: "done", percent: 100, message: `${nAlive} живых узлов` })); if (!nAlive) toast.error(data.probeMode === "mihomo" ? "Живых узлов не найдено" : "Открытых портов не найдено"); else toast.success(`Скан завершён · ${nAlive} живых`); if (data.probeNote) toast.message(data.probeNote); },
    onError: (err) => { if (cancelRequestedRef.current) return; const message = err instanceof Error ? err.message : "Скан не удался"; setProgress((current) => ({ ...current, active: false, phase: "error", message })); toast.error(message); },
  });
  function startScan() { if (scan.isPending) return; cancelRequestedRef.current = false; setScanStopped(false); setProgress({ active: true, phase: "fetch", percent: 2, message: "Запуск сканирования…", startedAt: Date.now(), updatedAt: Date.now() }); scan.mutate(); }
  async function stopScan() { if (!scan.isPending) return; cancelRequestedRef.current = true; setScanStopped(true); try { await fetch("/api/scan/cancel", { method: "POST" }); toast.message("Сканирование остановлено"); } catch { toast.error("Не удалось остановить сканирование"); } }
  useEffect(() => { if (!settings.autoRefresh) return; const id = window.setInterval(() => { if (!scan.isPending) startScan(); }, 180_000); return () => window.clearInterval(id); }, [settings.autoRefresh, scan.isPending]);

  const alive = result?.nodes.filter((n) => n.alive).length ?? 0;
  const total = result?.nodes.length ?? 0;
  const unknown = result?.nodes.filter((n) => n.probeState === "unknown").length ?? 0;
  const dead = Math.max(0, total - alive - unknown);
  const healthySources = result?.sources.filter((s) => s.ok && s.alive > 0).length ?? 0;
  const status = progress.active ? "scanning" : progress.phase === "error" ? "error" : result ? alive > 0 ? "live" : unknown > 0 ? "unknown" : "dead" : "idle";
  const strategyLabel = useMemo(() => settings.strategy === "fallback" ? "сначала живой источник" : settings.strategy === "balanced" ? "чередование источников" : "самый быстрый", [settings.strategy]);
  function cycleStrategy() { const order: SelectStrategy[] = ["fastest", "fallback", "balanced"]; const next = order[(order.indexOf(settings.strategy) + 1) % order.length]; setSettings((s) => ({ ...s, strategy: next })); if (result) setActive(pickActive(result, next, active?.id)); }
  async function copyActive() { if (!active) { toast.error("Нет выбранной ноды"); return; } await navigator.clipboard.writeText(active.uri); toast.success("URI скопирован"); }

  const statusTone = status === "live" ? "bg-live" : status === "scanning" ? "bg-warning animate-pulse" : status === "error" || status === "dead" ? "bg-danger" : "bg-fg-subtle";
  return <div className="min-h-dvh min-w-0 overflow-x-hidden bg-bg">
    <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 backdrop-blur-md"><div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-surface shadow-border"><span className={`size-2.5 rounded-full ${statusTone}`} /></span><div className="min-w-0"><p className="font-display text-sm font-semibold tracking-tight">Relay</p><div className="flex items-center gap-2 text-[11px] text-fg-muted"><span>живой пул подписок</span><span>·</span><span className="font-mono">{total || "—"} nodes</span></div></div></div>
      <div className="flex items-center gap-2"><Badge variant={mihomoOk ? "live" : "warn"}>mihomo {mihomoOk ? "ready" : "off"}</Badge>{result && <span className="hidden text-xs text-fg-muted sm:inline">{alive} live · {dead} dead · {unknown} unknown</span>}<Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Как пользоваться"><Info /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Как пользоваться</DialogTitle><DialogDescription>Relay проверяет источники, выбирает живые узлы и собирает подписку. Подключение выполняется в клиенте Hiddify или Clash.</DialogDescription></DialogHeader></DialogContent></Dialog></div>
    </div></header>

    <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <aside className="lg:sticky lg:top-20"><div className={`rounded-2xl border p-4 shadow-border transition-all duration-500 ${settings.autoRefresh ? "border-primary/40 bg-primary/5" : "border-border bg-surface"}`}>
        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Control</p><p className="text-[11px] text-fg-muted">{progress.active ? progress.message : settings.autoRefresh ? "Автообновление активно" : "Ручное управление"}</p></div><Activity className={`size-4 ${progress.active || settings.autoRefresh ? "animate-pulse text-primary" : "text-fg-subtle"}`} /></div>
        <div className="mt-4 rounded-xl bg-bg-subtle p-3"><div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-fg-subtle"><span>{progress.active ? progress.phase : progress.phase === "done" ? "ready" : progress.phase}</span><span className="font-mono">{Math.round(progress.percent)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress.percent}%` }} /></div><p className="mt-2 text-xs text-fg-muted">{progress.message}</p></div>
        <div className="mt-4 flex flex-col gap-2"><Button className="h-11 w-full" onClick={() => progress.active || scan.isPending ? void stopScan() : startScan()} disabled={scan.isPending && cancelRequestedRef.current}>{progress.active || scan.isPending ? <Square className="size-4 fill-current" /> : <RefreshCcw />}{progress.active || scan.isPending ? "Остановить" : "Сканировать"}</Button><Button variant="secondary" className="h-11 w-full" onClick={copyActive} disabled={!active}>Скопировать активный URI</Button></div>
        <div className="mt-4 space-y-3 border-t border-border pt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium">Автообновление</p><p className="text-[10px] text-fg-muted">каждые 3 минуты</p></div><Switch checked={settings.autoRefresh} onCheckedChange={(autoRefresh) => { setSettings((s) => ({ ...s, autoRefresh })); if (autoRefresh) setProgress((p) => ({ ...p, message: "Автообновление включено" })); }} /></div><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium">Настоящая проверка</p><p className="text-[10px] text-fg-muted">трафик через mihomo</p></div><Switch checked={settings.realProbe && mihomoOk} disabled={!mihomoOk} onCheckedChange={(realProbe) => setSettings((s) => ({ ...s, realProbe }))} /></div><label className="block"><span className="text-[10px] text-fg-subtle">URL проверки</span><input value={settings.testUrl} onChange={(e) => setSettings((s) => ({ ...s, testUrl: e.target.value }))} className="mt-1 h-9 w-full rounded-lg bg-bg-subtle px-2.5 font-mono text-[10px] text-fg outline-none" /></label><button type="button" onClick={cycleStrategy} className="flex w-full items-center justify-between rounded-lg bg-bg-subtle px-3 py-2.5 text-xs"><span>Стратегия</span><span className="text-[10px] text-fg-muted">{strategyLabel}</span></button></div>
      </div></aside>

      <section className="min-w-0"><Tabs defaultValue="pool">
        <div className="mb-4 flex items-center justify-between gap-3"><TabsList><TabsTrigger value="sources">Источники</TabsTrigger><TabsTrigger value="pool">Пул</TabsTrigger><TabsTrigger value="logs" className="gap-1.5">Логи{logsUnread > 0 ? <span className="size-1.5 rounded-full bg-danger" /> : null}</TabsTrigger><TabsTrigger value="export">Экспорт</TabsTrigger></TabsList><div className="hidden items-center gap-2 text-[11px] text-fg-subtle sm:flex"><span className="size-1.5 rounded-full bg-live" />{settings.autoRefresh ? "auto live" : "ready"}</div></div>
        <TabsContent value="pool" className="space-y-4"><div className="grid gap-2 sm:grid-cols-4"><Metric label="Nodes" value={total} /><Metric label="Live" value={alive} tone="live" /><Metric label="Dead" value={dead} tone="dead" /><Metric label="Unknown" value={unknown} tone="warn" /></div><PoolPanel nodes={result?.nodes ?? []} activeId={active?.id ?? null} onPick={(node) => { setActive(node); toast.message(`Выбрано: ${node.host}:${node.port}`); }} /></TabsContent>
        <TabsContent value="sources"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-medium">Источники</p><p className="text-xs text-fg-muted">Fetch → parse → pool</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setSources(DEFAULT_SOURCES)}><RotateCcw />Сброс</Button></div><SourcePanel sources={sources} scans={result?.sources ?? []} onChange={setSources} /></TabsContent>
        <TabsContent value="logs"><LogPanel /></TabsContent>
        <TabsContent value="export"><ExportPanel result={result} sources={sources} fmt={settings.exportFmt} n={settings.exportN} real={settings.realProbe && mihomoOk} testUrl={settings.testUrl} onFmt={(exportFmt) => setSettings((s) => ({ ...s, exportFmt }))} onN={(exportN) => setSettings((s) => ({ ...s, exportN }))} /></TabsContent>
      </Tabs></section>
    </main>
  </div>;
}
function Metric({ label, value, tone = "" }: { label: string; value: number; tone?: "live" | "dead" | "warn" | "" }) { const cls = tone === "live" ? "text-live" : tone === "dead" ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg"; return <div className="rounded-xl bg-surface px-3 py-3 shadow-border"><p className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</p><p className={`mt-1 font-mono text-xl ${cls}`}>{value}</p></div>; }
