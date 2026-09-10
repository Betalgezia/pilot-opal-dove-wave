import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/vpn/select";
import type { ProbedNode } from "@/lib/vpn/types";

export function PoolPanel({
  nodes,
  activeId,
  onPick,
}: {
  nodes: ProbedNode[];
  activeId: string | null;
  onPick: (node: ProbedNode) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((n) =>
      `${n.name} ${n.host} ${n.protocol} ${n.country ?? ""} ${n.sourceName}`
        .toLowerCase()
        .includes(needle),
    );
  }, [nodes, q]);

  if (nodes.length === 0) {
    return (
      <p className="rounded-xl bg-surface px-4 py-10 text-center text-sm text-fg-muted shadow-border">
        Пул пуст. Запустите сканирование, чтобы проверить списки.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по стране, хосту, протоколу"
      />
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-border">
        {filtered.map((node) => {
          const selected = node.id === activeId;
          const score = node.qualityScore ?? 0;
          const confidence = node.confidence ?? 0;
          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onPick(node)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-quick",
                  selected ? "bg-bg-subtle" : "hover:bg-bg-subtle/60",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    node.alive ? "bg-live" : "bg-danger",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-fg-muted">
                      {node.country ?? "XX"}
                    </span>
                    <span className="truncate text-sm">{node.name}</span>
                  </div>
                  <p className="truncate font-mono text-xs text-fg-subtle">
                    {node.host}:{node.port} · {node.sourceName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="proto">{node.protocol}</Badge>
                    {node.alive && <span className="font-mono text-[10px] text-fg-muted">Q{score}</span>}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      node.alive ? "text-fg" : "text-fg-subtle",
                    )}
                  >
                    {node.alive ? `${formatMs(node.latency)} · ${confidence}%` : "timeout"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-fg-muted shadow-border">
          Ничего не найдено.
        </p>
      )}
    </div>
  );
}
