import { useMemo, useState } from "react";
import { Activity, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/vpn/select";
import type { ProbedNode } from "@/lib/vpn/types";

export function PoolPanel({ nodes, activeId, onPick }: { nodes: ProbedNode[]; activeId: string | null; onPick: (node: ProbedNode) => void; }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "dead" | "unknown">("all");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return nodes.filter((node) => {
      if (status === "live" && !node.alive) return false;
      if (status === "dead" && (node.alive || node.probeState === "unknown")) return false;
      if (status === "unknown" && node.probeState !== "unknown") return false;
      return !needle || `${node.name} ${node.host} ${node.protocol} ${node.country ?? ""} ${node.sourceName}`.toLowerCase().includes(needle);
    });
  }, [nodes, q, status]);
  const live = nodes.filter((node) => node.alive).length;
  const unknown = nodes.filter((node) => node.probeState === "unknown").length;
  const dead = Math.max(0, nodes.length - live - unknown);

  if (nodes.length === 0) return <div className="rounded-xl bg-surface px-6 py-14 text-center shadow-border"><Activity className="mx-auto size-6 text-fg-subtle" /><p className="mt-3 text-sm text-fg-muted">Пул пока пуст</p><p className="mt-1 text-xs text-fg-subtle">Запустите сканирование — здесь появятся результаты.</p></div>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-surface p-4 shadow-border">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-base font-medium">Pool</p><p className="mt-0.5 text-xs text-fg-subtle">{nodes.length} узлов · живые узлы ранжированы по качеству</p></div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg-subtle p-1 text-center text-[10px] uppercase tracking-wider text-fg-subtle"><button type="button" onClick={() => setStatus("live")} className={cn("rounded-md px-3 py-1.5", status === "live" ? "bg-surface text-live shadow-border" : "hover:text-fg")}><span className="font-mono text-sm text-fg">{live}</span><span className="ml-1">live</span></button><button type="button" onClick={() => setStatus("dead")} className={cn("rounded-md px-3 py-1.5", status === "dead" ? "bg-surface text-danger shadow-border" : "hover:text-fg")}><span className="font-mono text-sm text-fg">{dead}</span><span className="ml-1">dead</span></button><button type="button" onClick={() => setStatus("unknown")} className={cn("rounded-md px-3 py-1.5", status === "unknown" ? "bg-surface text-warning shadow-border" : "hover:text-fg")}><span className="font-mono text-sm text-fg">{unknown}</span><span className="ml-1">unknown</span></button></div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по стране, хосту, протоколу или источнику" className="h-10 w-full rounded-lg bg-bg-subtle pl-9 pr-3 text-xs text-fg outline-none placeholder:text-fg-subtle" /></div><button type="button" onClick={() => setStatus("all")} className={cn("h-10 rounded-lg px-3 text-xs", status === "all" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted")}>Все {nodes.length}</button></div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-border">
        <div className="hidden grid-cols-[auto_minmax(0,1fr)_5rem_6.5rem_6rem] gap-4 border-b border-border px-4 py-2 text-[10px] uppercase tracking-wider text-fg-subtle md:grid"><span /><span>Node</span><span>Protocol</span><span>Latency</span><span className="text-right">Source</span></div>
        <ul className="divide-y divide-border/70">
          {filtered.map((node) => {
            const selected = node.id === activeId;
            const unknownNode = node.probeState === "unknown";
            return <li key={node.id}><button type="button" onClick={() => onPick(node)} className={cn("grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors md:grid-cols-[auto_minmax(0,1fr)_5rem_6.5rem_6rem] md:gap-4", selected ? "bg-bg-subtle" : "hover:bg-bg-subtle/60")}>
              <span className={cn("size-1.5 shrink-0 rounded-full", unknownNode ? "bg-warning" : node.alive ? "bg-live" : "bg-danger")} />
              <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-[10px] text-fg-subtle">{node.country ?? "XX"}</span><span className="truncate text-sm">{node.name}</span></div><p className="mt-0.5 truncate font-mono text-[10px] text-fg-subtle">{node.host}:{node.port} · {node.sourceName}</p></div>
              <Badge variant="proto" className="shrink-0">{node.protocol}</Badge>
              <div className="hidden md:block font-mono text-xs tabular-nums text-fg">{unknownNode ? "unknown" : node.alive ? formatMs(node.latency) : "dead"}</div>
              <div className="hidden text-right md:block"><span className="font-mono text-[10px] text-fg-subtle">{node.qualityScore !== undefined ? `Q${node.qualityScore}` : "—"}</span></div>
              <div className="col-span-3 flex items-center justify-between pt-1 md:hidden"><span className={cn("font-mono text-[11px]", unknownNode ? "text-warning" : node.alive ? "text-live" : "text-danger")}>{unknownNode ? "? unknown" : node.alive ? `● ${formatMs(node.latency)}` : "× dead"}</span><span className="font-mono text-[10px] text-fg-subtle">{node.qualityScore !== undefined ? `Q${node.qualityScore}` : ""}</span></div>
            </button></li>;
          })}
        </ul>
        {filtered.length === 0 && <div className="px-6 py-12 text-center text-xs text-fg-subtle">Ничего не найдено.</div>}
      </div>
    </div>
  );
}
