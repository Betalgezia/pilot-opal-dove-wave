import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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

  function add() {
    try {
      const normalized = normalizeSourceUrl(url);
      if (sources.some((s) => s.url === normalized)) { toast.error("Этот список уже добавлен"); return; }
      const id = `src-${Date.now().toString(36)}`;
      onChange([...sources, { id, name: name.trim() || sourceNameFromUrl(normalized), url: normalized, enabled: true }]);
      setUrl(""); setName(""); toast.success("Источник добавлен");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Не удалось добавить"); }
  }

  const enabled = sources.filter((s) => s.enabled).length;
  const live = scans.reduce((sum, scan) => sum + scan.alive, 0);

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="источники" value={`${enabled}/${sources.length}`} />
        <Metric label="живые узлы" value={String(live)} />
        <Metric label="проверено источников" value={String(scans.length)} />
      </div>

      <form className="overflow-hidden rounded-xl bg-surface shadow-border" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div className="border-b border-border p-4"><p className="text-sm font-medium">Добавить источник</p><p className="mt-0.5 text-xs text-fg-subtle">GitHub raw URL или совместимый текстовый список URI.</p></div>
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end"><div className="grid gap-1.5"><Label htmlFor="src-url">Адрес списка</Label><Input id="src-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/list.txt" autoComplete="off" /></div><div className="grid gap-1.5"><Label htmlFor="src-name">Имя</Label><Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="необязательно" /></div><Button type="submit" className="h-10"><Plus />Добавить</Button></div>
      </form>

      <div className="overflow-hidden rounded-xl bg-surface shadow-border">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-4 border-b border-border px-4 py-2.5 text-[10px] uppercase tracking-wider text-fg-subtle"><span>Источник</span><span>Result</span><span /></div>
        <ul className="divide-y divide-border/70">
          {sources.map((source) => {
            const scan = scans.find((s) => s.id === source.id);
            return <li key={source.id} className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_7rem_auto] md:items-center md:gap-4">
              <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className={source.enabled ? "size-1.5 rounded-full bg-live" : "size-1.5 rounded-full bg-fg-subtle"} /><p className="truncate text-sm font-medium">{source.name}</p>{scan && <Badge variant={!scan.ok ? "dead" : scan.alive > 0 ? "live" : "warn"}>{!scan.ok ? "ошибка" : scan.alive > 0 ? `${scan.alive} live` : "тишина"}</Badge>}</div><p className="mt-1 truncate font-mono text-[10px] text-fg-subtle">{source.url}</p>{scan && scan.ok && <p className="mt-1 font-mono text-[10px] text-fg-muted">{scan.parsed} URI · {scan.unique} endpoints · best {formatMs(scan.bestLatency)}</p>}{scan?.error && <p className="mt-1 text-[11px] text-danger">{scan.error}</p>}</div>
              <div className="font-mono text-[11px] text-fg-muted md:text-right">{scan ? `${scan.parsed} / ${scan.alive}` : "—"}</div>
              <div className="flex items-center justify-end gap-1.5"><Switch checked={source.enabled} onCheckedChange={(enabledState) => onChange(sources.map((item) => item.id === source.id ? { ...item, enabled: enabledState } : item))} aria-label="Включить источник" /><Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => onChange(sources.filter((item) => item.id !== source.id))} aria-label="Удалить"><Trash2 className="size-4" /></Button></div>
            </li>;
          })}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface px-3 py-3 shadow-border"><p className="font-mono text-lg tabular-nums">{value}</p><p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-fg-subtle">{label}</p></div>;
}
