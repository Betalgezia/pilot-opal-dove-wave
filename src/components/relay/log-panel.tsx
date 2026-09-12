import { Clipboard, Download, Search, Trash2, ChevronDown, Activity } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LogLevel, LogCategory, RelayLog } from "@/lib/relay/logger";

const levelOptions: Array<LogLevel | "all"> = ["all", "info", "warn", "error"];
const categoryOptions: Array<LogCategory | "all"> = ["all", "publish", "scan", "mihomo", "fetch", "parse", "system"];
const timeOptions = [{ value: 5 * 60_000, label: "5 мин" }, { value: 60 * 60_000, label: "1 час" }, { value: 0, label: "Всё" }];
const categoryLabels: Record<LogCategory, string> = { scan: "SCAN", mihomo: "MIHOMO", fetch: "FETCH", parse: "PARSE", system: "SYSTEM", publish: "PUBLISH" };

function fmtTime(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function fmtData(data?: Record<string, unknown>) { if (!data) return ""; return Object.entries(data).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · "); }

export function LogPanel() {
  const [logs, setLogs] = useState<RelayLog[]>([]);
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [category, setCategory] = useState<LogCategory | "all">("all");
  const [windowMs, setWindowMs] = useState(60 * 60_000);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const initialRef = useRef(true);

  async function load() {
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    if (category !== "all") params.set("category", category);
    if (windowMs > 0) params.set("since", String(Date.now() - windowMs));
    const res = await fetch(`/api/logs?${params}`);
    if (!res.ok) return;
    const data = await res.json() as { logs: RelayLog[] };
    setLogs(data.logs);
  }

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 2000); return () => window.clearInterval(id); }, [level, category, windowMs]);
  useEffect(() => { const el = scrollRef.current; if (!el) return; if (initialRef.current || stickToBottom.current) { el.scrollTop = el.scrollHeight; initialRef.current = false; } }, [logs.length]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => `${log.message} ${log.category} ${log.level} ${fmtData(log.data)}`.toLowerCase().includes(needle));
  }, [logs, query]);
  const allText = filtered.map((log) => `[${new Date(log.ts).toISOString()}] ${log.level.toUpperCase()} ${log.category}: ${log.message}${fmtData(log.data) ? ` | ${fmtData(log.data)}` : ""}`).join("\n");

  async function clear() { const res = await fetch("/api/logs/clear", { method: "POST" }); if (res.ok) { setLogs([]); toast.success("Логи очищены"); } }
  async function copyAll() { if (!allText) return; await navigator.clipboard.writeText(allText); toast.success("Логи скопированы"); }

  return <section className="overflow-hidden rounded-2xl bg-surface shadow-border">
    <div className="border-b border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Activity className="size-4" /><div><h2 className="text-sm font-medium">Журнал событий</h2><p className="text-xs text-fg-muted">{logs.length} записей · автообновление 2 сек</p></div><span className="ml-1 size-2 rounded-full bg-live shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-live)_15%,transparent)]" /></div>
        <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => void clear()}><Trash2 />Очистить</Button><Button variant="ghost" size="sm" onClick={() => void copyAll()}><Clipboard />Копировать всё</Button><Button variant="secondary" size="sm" asChild><a href="/api/logs/export"><Download />Экспорт JSON</a></Button></div>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-bg-subtle p-1">{categoryOptions.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-md px-2.5 py-1.5 text-xs ${category === item ? "bg-surface text-fg shadow-border" : "text-fg-muted hover:text-fg"}`}>{item === "all" ? "Все" : categoryLabels[item]}</button>)}</div>
        <div className="flex gap-1 rounded-lg bg-bg-subtle p-1">{levelOptions.map((item) => <button key={item} type="button" onClick={() => setLevel(item)} className={`rounded-md px-2.5 py-1.5 text-xs ${level === item ? "bg-surface text-fg shadow-border" : "text-fg-muted hover:text-fg"}`}>{item === "all" ? "Все" : item}</button>)}</div>
        <select value={windowMs} onChange={(e) => setWindowMs(Number(e.target.value))} className="h-9 rounded-lg bg-bg-subtle px-3 text-xs text-fg outline-none">{timeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
        <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по сообщениям, категории, данным…" className="h-9 w-full rounded-lg bg-bg-subtle pl-9 pr-3 text-xs text-fg outline-none placeholder:text-fg-subtle" /></div>
      </div>
    </div>
    <div ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 36; }} className="max-h-[min(68vh,720px)] overflow-y-auto font-mono text-xs">
      {filtered.length === 0 ? <div className="p-10 text-center text-fg-muted">Нет событий по текущему фильтру.</div> : <div className="divide-y divide-border/60">{filtered.map((log) => {
        const isOpen = expanded === log.id;
        const tone = log.level === "error" ? "text-danger" : log.level === "warn" ? "text-warning" : "text-live";
        return <button key={log.id} type="button" onClick={() => setExpanded(isOpen ? null : log.id)} className="block w-full px-4 py-3 text-left hover:bg-bg-subtle/60">
          <div className="flex items-start gap-3"><span className="w-[66px] shrink-0 text-fg-subtle">{fmtTime(log.ts)}</span><span className={`w-12 shrink-0 font-semibold ${tone}`}>{log.level.toUpperCase()}</span><span className="w-16 shrink-0 rounded bg-bg-subtle px-1.5 py-0.5 text-center text-[10px] text-fg-muted">{categoryLabels[log.category]}</span><span className="min-w-0 flex-1 break-words font-sans text-sm text-fg">{log.message}</span><ChevronDown className={`mt-0.5 size-3.5 shrink-0 text-fg-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} /></div>
          {log.data && !isOpen ? <p className="mt-1 truncate pl-[81px] text-[10px] text-fg-subtle">{fmtData(log.data)}</p> : null}
          {isOpen ? <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-bg-subtle p-3 text-[10px] leading-relaxed text-fg-muted">{fmtData(log.data) || "Без дополнительных данных"}</pre> : null}
        </button>;
      })}</div>}
    </div>
  </section>;
}
