import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/vpn/select";
import type { ProbedNode } from "@/lib/vpn/types";

type DialState = "idle" | "scanning" | "live" | "dead";

export function ConnectDial({
  state,
  node,
  alive,
  total,
  onClick,
}: {
  state: DialState;
  node: ProbedNode | null;
  alive: number;
  total: number;
  onClick: () => void;
}) {
  const latency = node?.latency ?? null;
  const progress =
    latency === null ? 0 : Math.max(0.12, Math.min(1, 1 - latency / 420));

  const label =
    state === "scanning"
      ? "Сканирование"
      : state === "live"
        ? "Пул активен"
        : state === "dead"
          ? "Нет живых"
          : "Сканировать";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative mx-auto flex size-52 items-center justify-center rounded-full",
        "bg-surface shadow-border transition-[transform,box-shadow] duration-fast ease-smooth",
        "hover:shadow-border-hover active:scale-[0.96] sm:size-56",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-3 text-border"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          className={cn(
            state === "live" ? "text-live" : "text-fg-subtle",
            state === "scanning" && "dial-spin origin-center text-fg-muted",
          )}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${progress * 327} 327`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1 px-6 text-center">
        {state === "scanning" ? (
          <LoaderCircle className="mb-1 size-6 animate-spin text-fg-muted" />
        ) : (
          <span
            className={cn(
              "mb-1 size-2 rounded-full",
              state === "live" && "bg-live",
              state === "dead" && "bg-danger",
              state === "idle" && "bg-fg-subtle",
            )}
          />
        )}
        <span className="font-display text-sm font-medium tracking-tight">
          {label}
        </span>
        {state === "live" && node ? (
          <>
            <span className="max-w-36 truncate font-mono text-xs text-fg-muted">
              {node.country ?? "XX"} · {node.protocol} · {node.host}
            </span>
            <span className="font-mono text-lg tabular-nums text-fg">
              {formatMs(latency)}
            </span>
          </>
        ) : (
          <span className="font-mono text-xs tabular-nums text-fg-muted">
            {alive}/{total} живых
          </span>
        )}
      </div>
    </button>
  );
}
