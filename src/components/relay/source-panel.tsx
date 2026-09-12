import { CheckCircle2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { normalizeSourceUrl, sourceNameFromUrl } from "@/lib/vpn/github";
import { formatMs } from "@/lib/vpn/select";
import type { SourceDef, SourceScan } from "@/lib/vpn/types";

export function SourcePanel({ sources, scans, onChange }: { sources: SourceDef[]; scans: SourceScan[]; onChange: (next: SourceDef[]) => void; }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const totalParsed = useMemo(() => scans.reduce((sum, scan) => sum + scan.parsed, 0), [scans]);
  const totalLive = useMemo(() => scans.reduce((sum, scan) => sum + scan.alive, 0), [scans]);

  function add() {
    setAdding(true);
    try {
      const normalized = normalizeSourceUrl(url);
      if (sources.some((s) => s.url === normalized)) { toast.error("Этот список уже добавлен"); return; }
      onChange([...sources, { id: `src-${Date.now().toString(36)}`, name: name.trim() || sourceNameFromUrl(normalized), url: normalized, enabled: true }]);
      setUrl(""); setName(""); toast.success("Источник добавлен");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Не удалось добавить"); }
    finally { setAdding(false); }
  }

  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-surface p-4 shadow-border"><p className="text-[10px] uppercase tracking-wider text-fg-subtle">Источники</p><p className="mt-1 font-mono text-xl">{sources.length}</p></div><div className="rounded-xl bg-surface p-4 shadow-border"><p className="text-[10px] uppercase tracking-wider text-fg-subtle">URI</p><p className="mt-1 font-mono text-xl">{totalParsed}</p></div><div className="rounded-xl bg-surface p-4 shadow-border"><p className="text-[10px] uppercase tracking-wider text-fg-subtle">Live</p><p className="mt-1 font-mono text-xl text-live">{totalLive}</p></div></div>
    <form className="rounded-2xl border border-border bg-surface p-5 shadow-border" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-medium">Добавить источник</h2><p className="mt-1 text-xs text-fg-muted">URL будет нормализован и сохранён в браузере.</p></div><Plus className="size-4 text-fg-subtle" /></div>
      <div className="mt-4 grid gap-3"><div className="grid gap-1.5"><Label htmlFor="src-url">Адрес списка</Label><Input id="src-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/list.txt" /></div><div className="flex flex-col gap-3 sm:flex-row"><div className="grid flex-1 gap-1.5"><Label htmlFor="src-name">Название</Label><Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="необязательно" /></div><Button type="submit" disabled={adding || !url.trim()} className="sm:mt-5">{adding ? <RefreshCw className="animate-spin" /> : <Plus />}{adding ? "Добавление…" : "Добавить"}</Button></div></div>
    </form>
    <div className="space-y-2">{sources.map((source) => { const scan = scans.find((s) => s.id === source.id); const live = scan?.alive ?? 0; const parsed = scan?.parsed ?? 0; return <article key={source.id} className={`group rounded-2xl border bg-surface p-4 shadow-border transition-all ${source.enabled ? "border-border" : "border-border/50 opacity-60"}`}><div className="flex gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${scan?.ok ? "bg-live" : scan ? "bg-danger" : "bg-fg-subtle"} ${scan?.ok && live === 0 ? "animate-pulse bg-warning" : ""}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-medium">{source.name}</h3>{scan ? <Badge variant={!scan.ok ? "dead" : live ? "live" : "warn"}>{!scan.ok ? "ошибка" : live ? `${live} live` : "нет live"}</Badge> : <Badge>не проверен</Badge>}</div><p className="mt-1 truncate font-mono text-[11px] text-fg-subtle">{source.url}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-fg-muted">{scan ? <><span>{parsed} URI</span><span>{scan.unique} unique</span><span>best {formatMs(scan.bestLatency)}</span></> : <span>ожидает сканирования</span>}</div>{scan?.error ? <p className="mt-2 text-xs text-danger">{scan.error}</p> : null}</div><div className="flex shrink-0 items-start gap-2"><Switch checked={source.enabled} onCheckedChange={(enabled) => onChange(sources.map((s) => s.id === source.id ? { ...s, enabled } : s))} aria-label="Включить источник" /><Button type="button" variant="ghost" size="icon" className="size-9 opacity-60 transition-opacity hover:opacity-100" onClick={() => onChange(sources.filter((s) => s.id !== source.id))} aria-label="Удалить"><Trash2 className="size-4" /></Button></div></div>{scan?.ok ? <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-subtle"><div className="h-full rounded-full bg-live transition-all duration-500" style={{ width: `${parsed ? Math.min(100, (live / parsed) * 100) : 0}%` }} /></div> : null}</article>; })}</div>
    {!sources.length ? <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-fg-muted"><CheckCircle2 className="mx-auto mb-2 size-6 text-fg-subtle" />Добавь первый источник, чтобы собрать пул.</div> : null}
  </div>;
}
