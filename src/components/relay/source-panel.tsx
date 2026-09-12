import { CheckCircle2, Globe2, Plus, RefreshCw, Trash2, Wifi, Zap } from "lucide-react";
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

export function SourcePanel({ sources, scans, onChange }: { sources: SourceDef[]; scans: SourceScan[]; onChange: (next: SourceDef[]) => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const totalParsed = useMemo(() => scans.reduce((sum, scan) => sum + scan.parsed, 0), [scans]);
  const totalLive = useMemo(() => scans.reduce((sum, scan) => sum + scan.alive, 0), [scans]);

  function add() {
    setAdding(true);
    try {
      const normalized = normalizeSourceUrl(url);
      if (sources.some((source) => source.url === normalized)) { toast.error("Этот список уже добавлен"); return; }
      onChange([...sources, { id: `src-${Date.now().toString(36)}`, name: name.trim() || sourceNameFromUrl(normalized), url: normalized, enabled: true }]);
      setUrl("");
      setName("");
      toast.success("Источник добавлен");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить");
    } finally {
      setAdding(false);
    }
  }

  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-3"><Metric icon={<Globe2 />} label="Источники" value={sources.length} /><Metric icon={<Zap />} label="URI" value={totalParsed} /><Metric icon={<Wifi />} label="Live" value={totalLive} tone="live" /></div>
    <form className="rounded-2xl border border-border bg-surface p-4 shadow-border" onSubmit={(event) => { event.preventDefault(); add(); }}>
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-bg-subtle"><Plus className="size-4 text-primary" /></span><div><h2 className="text-sm font-semibold">Добавить источник</h2><p className="mt-0.5 text-[10px] text-fg-subtle">URI списка будет нормализован и сохранён локально.</p></div></div></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end"><label className="grid gap-1.5"><Label htmlFor="src-url">Адрес списка</Label><Input id="src-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://raw.githubusercontent.com/.../list.txt" className="font-mono text-xs" /></label><label className="grid gap-1.5"><Label htmlFor="src-name">Название</Label><Input id="src-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="необязательно" /></label><Button type="submit" disabled={adding || !url.trim()}>{adding ? <RefreshCw className="animate-spin" /> : <Plus />}{adding ? "Добавление…" : "Добавить"}</Button></div>
    </form>
    <div className="space-y-2">{sources.map((source) => { const scan = scans.find((item) => item.id === source.id); const live = scan?.alive ?? 0; const parsed = scan?.parsed ?? 0; const health = parsed ? Math.min(100, Math.round((live / parsed) * 100)) : 0; return <article key={source.id} className={`rounded-2xl border bg-surface p-4 shadow-border transition-all ${source.enabled ? "border-border" : "border-border/50 opacity-60"}`}><div className="flex gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${scan?.ok && live > 0 ? "bg-live" : scan?.ok ? "bg-warning" : scan ? "bg-danger" : "bg-fg-subtle"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-medium">{source.name}</h3>{scan ? <Badge variant={!scan.ok ? "dead" : live ? "live" : "warn"}>{!scan.ok ? "ошибка" : live ? `${live} live` : "нет live"}</Badge> : <Badge>не проверен</Badge>}</div><p className="mt-1 truncate font-mono text-[11px] text-fg-subtle">{source.url}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-fg-muted">{scan ? <><span>{parsed} URI</span><span>{scan.unique} unique</span><span>best {formatMs(scan.bestLatency)}</span></> : <span>ожидает сканирования</span>}</div>{scan?.error ? <p className="mt-2 text-xs text-danger">{scan.error}</p> : null}<div className="mt-3"><div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-fg-subtle"><span>Health · live / parsed</span><span className="font-mono text-live">{live} / {parsed}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-subtle"><div className="h-full rounded-full bg-live transition-all duration-500" style={{ width: `${health}%` }} /></div></div></div><div className="flex shrink-0 items-start gap-2"><Switch checked={source.enabled} onCheckedChange={(enabled) => onChange(sources.map((item) => item.id === source.id ? { ...item, enabled } : item))} aria-label="Включить источник" /><Button type="button" variant="ghost" size="icon" className="size-9 opacity-60 hover:opacity-100" onClick={() => onChange(sources.filter((item) => item.id !== source.id))} aria-label="Удалить"><Trash2 className="size-4" /></Button></div></div></article>; })}</div>
    {!sources.length ? <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-fg-muted"><CheckCircle2 className="mx-auto mb-2 size-6 text-fg-subtle" />Добавь первый источник, чтобы собрать пул.</div> : null}
  </div>;
}

function Metric({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: number; tone?: "live" | "" }) { return <div className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-center justify-between"><span className={`flex size-8 items-center justify-center rounded-lg bg-bg-subtle ${tone === "live" ? "text-live" : "text-primary"}`}>{icon}</span><span className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</span></div><p className={`mt-3 font-mono text-2xl leading-none ${tone === "live" ? "text-live" : "text-fg"}`}>{value}</p></div>; }
