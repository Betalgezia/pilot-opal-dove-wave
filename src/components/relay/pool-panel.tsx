import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/vpn/select";
import type { ProbedNode } from "@/lib/vpn/types";

export function PoolPanel({ nodes, activeId, onPick }: { nodes: ProbedNode[]; activeId: string | null; onPick: (node: ProbedNode) => void; }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "live" | "dead" | "unknown">("all");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return nodes.filter((n) => {
      const matchesText = !needle || `${n.name} ${n.host} ${n.protocol} ${n.country ?? ""} ${n.sourceName}`.toLowerCase().includes(needle);
      const matchesStatus = status === "all" || (status === "live" ? n.alive : status === "unknown" ? n.probeState === "unknown" : n.probeState === "checked" && !n.alive);
      return matchesText && matchesStatus;
    });
  }, [nodes, q, status]);

  const live = nodes.filter((n) => n.alive).length;
  const unknown = nodes.filter((n) => n.probeState === "unknown").length;
  const dead = Math.max(0, nodes.length - live - unknown);

  if (nodes.length === 0) return <div className="rounded-2xl bg-surface px-4 py-12 text-center shadow-border"><p className="text-sm font-medium">Пул пока пуст</p><p className="mt-1 text-xs text-fg-muted">Запусти сканирование — здесь появятся проверенные узлы.</p></div>;

  return <div className="overflow-hidden rounded-2xl bg-surface shadow-border">
    <div className="border-b border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><SlidersHorizontal className="size-4" /><h2 className="text-sm font-medium">Пул серверов</h2></div><p className="mt-1 text-xs text-fg-muted">{nodes.length} узлов · {live} живых · {dead} мёртвых · {unknown} неизвестных</p></div><Badge variant={live > 0 ? "live" : unknown > 0 ? "warn" : "dead"}>{live > 0 ? `${live} LIVE` : unknown > 0 ? `${unknown} UNKNOWN` : "NO LIVE"}</Badge></div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по стране, имени, хосту, протоколу" className="pl-9" /></div><div className="flex shrink-0 gap-1 rounded-lg bg-bg-subtle p-1">{(["all", "live", "dead", "unknown"] as const).map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={cn("rounded-md px-2.5 py-1.5 text-[11px]", status === item ? "bg-surface text-fg shadow-border" : "text-fg-muted hover:text-fg")}>{item === "all" ? "Все" : item}</button>)}</div></div>
    </div>
    <div className="max-h-[min(68vh,680px)] overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
      {filtered.length === 0 ? <div className="px-4 py-12 text-center text-sm text-fg-muted">По этим условиям узлов нет.</div> : <ul className="divide-y divide-border/60">
        {filtered.map((node) => { const selected = node.id === activeId; const unknownState = node.probeState === "unknown"; return <li key={node.id}><button type="button" onClick={() => onPick(node)} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150", selected ? "bg-bg-subtle" : "hover:bg-bg-subtle/60")}>
          <span className={cn("size-2 shrink-0 rounded-full", unknownState ? "bg-warning animate-pulse" : node.alive ? "bg-live" : "bg-danger")} />
          <span className="w-8 shrink-0 font-mono text-[11px] text-fg-subtle">{node.country ?? "XX"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm">{node.name}</span><span className="mt-0.5 block truncate font-mono text-[11px] text-fg-subtle">{node.host}:{node.port} · {node.sourceName}</span></span>
          <span className="flex shrink-0 items-center gap-3"><Badge variant="proto">{node.protocol}</Badge><span className="w-20 text-right font-mono text-xs tabular-nums text-fg">{unknownState ? "unknown" : node.alive ? formatMs(node.latency) : "dead"}</span>{node.alive && <span className="hidden w-12 text-right font-mono text-[10px] text-fg-subtle sm:inline">Q{node.qualityScore ?? 0}</span>}</span>
        </button></li>; })}
      </ul>}
    </div>
    <div className="border-t border-border px-4 py-2 text-[10px] text-fg-subtle">Список прокручивается независимо от страницы</div>
  </div>;
}
