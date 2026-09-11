import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Download, Eraser, Search, Terminal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LogLevel } from "@/lib/relay/logger";
import type { RelayLogEntry } from "@/lib/relay/logger";

const LEVELS: Array<{ id: "all" | LogLevel; label: string }> = [
  { id: "all", label: "Все" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

const SINCE: Array<{ id: "all" | "5m" | "1h"; label: string }> = [
  { id: "5m", label: "5 мин" },
  { id: "1h", label: "1 час" },
  { id: "all", label: "Всё" },
];

const levelClass: Record<LogLevel, string> = {
  info: "text-live",
  warn: "text-warning",
  error: "text-danger",
};

const levelMarker: Record<LogLevel, string> = {
  info: "●",
  warn: "▲",
  error: "■",
};

function sinceValue(value: "all" | "5m" | "1h") {
  if (value === "5m") return Date.now() - 5 * 60_000;
  if (value === "1h") return Date.now() - 60 * 60_000;
  return undefined;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function stringifyLog(log: RelayLogEntry) {
  const meta = log.meta && Object.keys(log.meta).length ? `\n${JSON.stringify(log.meta, null, 2)}` : "";
  return `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()} ${log.category.toUpperCase()} ${log.message}${meta}`;
}

export function LogPanel() {
  const [logs, setLogs] = useState<RelayLogEntry[]>([]);
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [since, setSince] = useState<"all" | "5m" | "1h">("5m");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(new Set<number>());
  const initializedRef = useRef(false);
  const atBottomRef = useRef(true);

  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    const sinceAt = sinceValue(since);
    if (sinceAt) params.set("since", String(sinceAt));
    const response = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить логи");
    const data = (await response.json()) as { logs?: RelayLogEntry[] };
    const next = Array.isArray(data.logs) ? data.logs : [];
    const unseen = next.filter((entry) => !seenRef.current.has(entry.id));
    seenRef.current = new Set(next.map((entry) => entry.id));
    setLogs(next);
    if (initializedRef.current && unseen.length && !atBottomRef.current) setNewCount((value) => value + unseen.length);
    initializedRef.current = true;
    if (atBottomRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [level, since]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try { if (!cancelled) await loadLogs(); } catch (error) { if (!cancelled) toast.error(error instanceof Error ? error.message : "Не удалось загрузить логи"); }
    };
    void run();
    const timer = window.setInterval(() => { void run(); }, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [loadLogs]);

  const visibleLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => `${log.message} ${log.category} ${log.level} ${JSON.stringify(log.meta ?? {})}`.toLowerCase().includes(needle));
  }, [logs, search]);

  const allText = useMemo(() => visibleLogs.map(stringifyLog).join("\n"), [visibleLogs]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    if (atBottomRef.current) setNewCount(0);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setNewCount(0);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(allText);
    setCopied(true);
    toast.success("Логи скопированы");
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function clear() {
    const response = await fetch("/api/logs/clear", { method: "POST" });
    if (!response.ok) { toast.error("Не удалось очистить логи"); return; }
    seenRef.current.clear();
    setLogs([]);
    setExpanded(null);
    setNewCount(0);
    toast.success("Логи очищены");
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-surface shadow-border">
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="size-4 shrink-0 text-fg-muted" />
            <div className="min-w-0">
              <div className="flex items-center gap-2"><p className="text-sm font-medium">Логи</p><span className="rounded-full bg-bg-subtle px-2 py-0.5 font-mono text-[10px] text-fg-muted">{logs.length}</span></div>
              <p className="mt-0.5 text-xs text-fg-subtle">Автообновление · 2 сек · последние 1000 событий</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-md bg-bg-subtle p-0.5">
              {LEVELS.map((option) => <button key={option.id} type="button" onClick={() => setLevel(option.id)} className={cn("rounded px-2.5 py-1.5 text-[11px] transition-colors", level === option.id ? "bg-surface text-fg shadow-border" : "text-fg-muted hover:text-fg")}>{option.label}</button>)}
            </div>
            <select value={since} onChange={(event) => setSince(event.target.value as typeof since)} className="h-8 rounded-md bg-bg-subtle px-2 text-xs text-fg outline-none">
              {SINCE.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <div className="relative min-w-40 flex-1 sm:min-w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск логов..." className="h-8 w-full rounded-md bg-bg-subtle pl-8 pr-3 text-xs text-fg outline-none placeholder:text-fg-subtle" />
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="relative max-h-[min(62vh,42rem)] min-h-72 overflow-auto font-mono text-xs">
        {visibleLogs.length === 0 ? <div className="flex min-h-72 items-center justify-center px-6 text-center text-fg-subtle">Нет событий для выбранного фильтра.</div> : <div className="divide-y divide-border/60">
          {visibleLogs.map((log) => {
            const open = expanded === log.id;
            return <button key={log.id} type="button" onClick={() => setExpanded(open ? null : log.id)} className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-bg-subtle/50 sm:px-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-fg-subtle">{formatTime(log.timestamp)}</span>
                <span className={cn("flex w-12 shrink-0 items-center gap-1 font-medium uppercase tracking-wide", levelClass[log.level])}><span>{levelMarker[log.level]}</span>{log.level}</span>
                <span className="w-16 shrink-0 rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">{log.category}</span>
                <span className="min-w-0 flex-1 break-words font-sans text-xs text-fg">{log.message}</span>
                <span className="shrink-0 text-fg-subtle">{open ? "−" : "+"}</span>
              </div>
              {open && <div className="mt-2 ml-[calc(3rem+3.25rem+4rem)] rounded-lg bg-bg p-3 text-[11px] leading-relaxed text-fg-muted shadow-inner whitespace-pre-wrap break-words">
                <div>{new Date(log.timestamp).toISOString()}</div>
                {log.meta && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-fg-subtle">{JSON.stringify(log.meta, null, 2)}</pre>}
              </div>}
            </button>;
          })}
        </div>}
        {newCount > 0 && <button type="button" onClick={jumpToBottom} className="sticky bottom-3 left-1/2 mx-auto -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 font-sans text-xs text-primary-foreground shadow-lg">↓ {newCount} новых</button>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
        <div className="text-[11px] text-fg-subtle">Показано {visibleLogs.length} из {logs.length}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void clear()}><Eraser />Очистить</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void copyAll()} disabled={!allText}><Clipboard />{copied ? <Check /> : null}Копировать всё</Button>
          <Button type="button" variant="secondary" size="sm" asChild><a href="/api/logs/export" download="relay-logs.json"><Download />Экспорт JSON</a></Button>
          {search && <Button type="button" variant="ghost" size="sm" onClick={() => setSearch("")} aria-label="Очистить поиск"><X /></Button>}
        </div>
      </div>
    </div>
  );
}
