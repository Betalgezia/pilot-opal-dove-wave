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

export function SourcePanel({
  sources,
  scans,
  onChange,
}: {
  sources: SourceDef[];
  scans: SourceScan[];
  onChange: (next: SourceDef[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  function add() {
    try {
      const normalized = normalizeSourceUrl(url);
      if (sources.some((s) => s.url === normalized)) {
        toast.error("Этот список уже добавлен");
        return;
      }
      const id = `src-${Date.now().toString(36)}`;
      onChange([
        ...sources,
        {
          id,
          name: name.trim() || sourceNameFromUrl(normalized),
          url: normalized,
          enabled: true,
        },
      ]);
      setUrl("");
      setName("");
      toast.success("Источник добавлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить");
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <form
        className="min-w-0 rounded-xl bg-surface p-4 shadow-border"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="src-url">Адрес списка</Label>
            <Input
              id="src-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://raw.githubusercontent.com/…/list.txt"
              autoComplete="off"
              className="min-w-0"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="src-name">Имя</Label>
              <Input
                id="src-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="необязательно"
                className="min-w-0"
              />
            </div>
            <Button type="submit" className="sm:mt-5">
              <Plus />
              Добавить
            </Button>
          </div>
        </div>
      </form>

      <ul className="min-w-0 space-y-2">
        {sources.map((source) => {
          const scan = scans.find((s) => s.id === source.id);
          return (
            <li
              key={source.id}
              className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl bg-surface p-4 shadow-border sm:flex-row sm:items-center"
            >
              <div className="min-w-0 w-full flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{source.name}</p>
                  {scan ? (
                    <Badge
                      variant={
                        !scan.ok
                          ? "dead"
                          : scan.alive > 0
                            ? "live"
                            : "warn"
                      }
                    >
                      {!scan.ok
                        ? "недоступен"
                        : scan.alive > 0
                          ? `${scan.alive} живых`
                          : "тишина"}
                    </Badge>
                  ) : (
                    <Badge>не сканирован</Badge>
                  )}
                </div>
                <p className="mt-1 truncate font-mono text-xs text-fg-subtle">
                  {source.url}
                </p>
                {scan && scan.ok ? (
                  <p className="mt-1 font-mono text-xs tabular-nums text-fg-muted">
                    {scan.parsed} URI · {scan.unique} адресов · лучший{" "}
                    {formatMs(scan.bestLatency)}
                  </p>
                ) : scan?.error ? (
                  <p className="mt-1 text-xs text-danger">{scan.error}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={(enabled) =>
                      onChange(
                        sources.map((s) =>
                          s.id === source.id ? { ...s, enabled } : s,
                        ),
                      )
                    }
                    aria-label="Включить источник"
                  />
                  <span className="text-xs text-fg-muted">в пуле</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() =>
                    onChange(sources.filter((s) => s.id !== source.id))
                  }
                  aria-label="Удалить"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
