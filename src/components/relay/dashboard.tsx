import { useMutation } from "@tanstack/react-query";
import { Info, RefreshCcw, RotateCcw, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConnectDial } from "@/components/relay/connect-dial";
import { ExportPanel } from "@/components/relay/export-panel";
import { PoolPanel } from "@/components/relay/pool-panel";
import { SourcePanel } from "@/components/relay/source-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
        perSource: 3000,
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
    const id = window.setInterval(() => {
      if (!scan.isPending) startScan();
    }, 180_000);
    return () => window.clearInterval(id);
  }, [settings.autoRefresh, scan.isPending]);

  const alive = result?.nodes.filter((n) => n.alive).length ?? 0;
  const total = result?.nodes.length ?? 0;
  const healthySources = result?.sources.filter((s) => s.ok && s.alive > 0).length ?? 0;
  const dialState = scan.isPending ? "scanning" : scanStopped ? "stopped" : result ? (alive > 0 ? "live" : "dead") : "idle";
  const strategyLabel = useMemo(() => {
    if (settings.strategy === "fallback") return "сначала живой источник";
    if (settings.strategy === "balanced") return "чередование источников";
    return "самый быстрый";
  }, [settings.strategy]);

  function cycleStrategy() {
    const order: SelectStrategy[] = ["fastest", "fallback", "balanced"];
    const i = order.indexOf(settings.strategy);
    const next = order[(i + 1) % order.length];
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
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface shadow-border"><span className="size-2 rounded-full bg-live" /></span>
          <div className="min-w-0"><p className="font-display text-sm font-medium tracking-tight">Relay</p><p className="text-xs text-fg-muted">живой пул подписок</p></div>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Как пользоваться"><Info /></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Как пользоваться</DialogTitle>
              <DialogDescription>Relay не скачивается как VPN и не включает туннель в браузере. Это пульт: он проверяет списки и собирает конфиг. Подключение делает программа на компьютере.</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm text-fg-muted">
              <li><span className="font-medium text-fg">1.</span> Поставьте на ПК Hiddify или Clash Verge Rev.</li>
              <li><span className="font-medium text-fg">2.</span> Здесь нажмите «Обновить пул».</li>
              <li><span className="font-medium text-fg">3.</span> Вкладка «Экспорт» → скачайте relay.yaml.</li>
              <li><span className="font-medium text-fg">4.</span> В клиенте импортируйте файл, выберите RELAY или AUTO, подключитесь.</li>
            </ol>
          </DialogContent>
        </Dialog>
      </header>

      <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        <section className="stagger-in flex min-w-0 flex-col items-center gap-6 lg:sticky lg:top-8">
          <ConnectDial state={dialState} node={active} alive={alive} total={total} onClick={() => { if (scan.isPending) void stopScan(); else startScan(); }} />
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <Stat label="источники" value={`${healthySources}/${sources.filter((s) => s.enabled).length}`} />
            <Stat label="разобрано" value={String(result?.parsedTotal ?? 0)} />
            <Stat label="скан" value={result ? `${Math.round(result.durationMs / 1000)} с` : "—"} />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2">
            <Button type="button" onClick={() => (scan.isPending ? void stopScan() : startScan())} disabled={scan.isPending && cancelRequestedRef.current} className="h-12 w-full">
              {scan.isPending ? <Square className="size-4 fill-current" /> : <RefreshCcw />}
              {scan.isPending ? "Остановить сканирование" : "Сканировать"}
            </Button>
            <Button type="button" variant="secondary" className="h-12 w-full" onClick={copyActive} disabled={!active}>Скопировать активный URI</Button>
          </div>
          <div className="w-full min-w-0 space-y-3 rounded-xl bg-surface p-4 shadow-border">
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">Автообновление</p><p className="text-xs text-fg-muted">каждые 3 минуты</p></div><Switch checked={settings.autoRefresh} onCheckedChange={(autoRefresh) => setSettings((s) => ({ ...s, autoRefresh }))} /></div>
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">Настоящая проверка</p><p className="text-xs text-fg-muted">{mihomoOk ? "трафик через ядро mihomo" : "ядро недоступно на этом хосте"}</p></div><Switch checked={settings.realProbe && mihomoOk} disabled={!mihomoOk} onCheckedChange={(realProbe) => setSettings((s) => ({ ...s, realProbe }))} /></div>
            <label className="block space-y-1"><span className="text-xs text-fg-muted">URL проверки</span><input value={settings.testUrl} onChange={(e) => setSettings((s) => ({ ...s, testUrl: e.target.value }))} placeholder={DEFAULT_TEST_URL} className="h-10 w-full min-w-0 rounded-md bg-bg-subtle px-3 font-mono text-xs text-fg" /></label>
            <button type="button" onClick={cycleStrategy} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-bg-subtle px-3 py-2 text-left"><span className="text-sm">Стратегия</span><span className="text-right text-xs text-fg-muted">{strategyLabel}</span></button>
            <p className="text-xs leading-relaxed text-fg-subtle">
              {scanStopped ? "Сканирование остановлено. Последний готовый пул сохранён." : result?.probeMode === "mihomo" ? "В пуле только сервера, через которые прошёл трафик." : result ? "Сейчас проверка порта: открытый порт ещё не значит, что VPN живой." : "Включите настоящую проверку и запустите сканирование."}
              {active ? ` Активная: ${active.country ?? "XX"} ${active.protocol} ${formatMs(active.latency)} · ${active.sourceName}` : ""}
            </p>
          </div>
        </section>

        <section className="min-w-0">
          <Tabs defaultValue="sources">
            <TabsList><TabsTrigger value="sources">Источники</TabsTrigger><TabsTrigger value="pool">Пул</TabsTrigger><TabsTrigger value="export">Экспорт</TabsTrigger></TabsList>
            <TabsContent value="sources">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-fg-muted">GitHub raw-списки URI. Можно добавить свои.</p><Button type="button" variant="ghost" size="sm" onClick={() => setSources(DEFAULT_SOURCES)}><RotateCcw />Сброс</Button></div>
              <SourcePanel sources={sources} scans={result?.sources ?? []} onChange={setSources} />
            </TabsContent>
            <TabsContent value="pool"><PoolPanel nodes={result?.nodes ?? []} activeId={active?.id ?? null} onPick={(node) => { setActive(node); toast.message(`Выбрано: ${node.host}:${node.port}`); }} /></TabsContent>
            <TabsContent value="export"><ExportPanel result={result} sources={sources} fmt={settings.exportFmt} n={settings.exportN} real={settings.realProbe && mihomoOk} testUrl={settings.testUrl} onFmt={(exportFmt) => setSettings((s) => ({ ...s, exportFmt }))} onN={(exportN) => setSettings((s) => ({ ...s, exportN }))} /></TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-surface px-2 py-3 text-center shadow-border"><p className="font-mono text-sm">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-fg-subtle">{label}</p></div>;
}
