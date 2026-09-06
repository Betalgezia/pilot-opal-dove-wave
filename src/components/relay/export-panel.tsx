import { Check, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { pickExportNodes } from "@/lib/vpn/select";
import type { ExportFormat, ScanResult, SourceDef } from "@/lib/vpn/types";

const FMT_OPTIONS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "b64", label: "b64", hint: "Hiddify" },
  { id: "clash", label: "clash", hint: "YAML" },
  { id: "uri", label: "uri", hint: "список" },
];

const N_OPTIONS = [12, 24, 40, 60];

export function ExportPanel({
  result,
  sources,
  fmt,
  n,
  real,
  testUrl,
  onFmt,
  onN,
}: {
  result: ScanResult | null;
  sources: SourceDef[];
  fmt: ExportFormat;
  n: number;
  real: boolean;
  testUrl: string;
  onFmt: (fmt: ExportFormat) => void;
  onN: (n: number) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [hostMode, setHostMode] = useState<"auto" | "localhost" | "lan">("auto");
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("network lookup failed"))))
      .then((data: { ipv4?: unknown }) => {
        if (!cancelled && Array.isArray(data.ipv4)) {
          setLanIps(data.ipv4.filter((x): x is string => typeof x === "string"));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedHost = useMemo(() => {
    if (hostMode === "localhost") return "127.0.0.1";
    if (hostMode === "lan") return lanIps[0] ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
    if (typeof window === "undefined") return "localhost";
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "127.0.0.1";
    return hostname;
  }, [hostMode, lanIps]);

  const subPath = useMemo(() => {
    if (enabled.length === 0) return "";
    const params = new URLSearchParams();
    params.set("u", encodeSourceParam(enabled));
    params.set("fmt", fmt);
    params.set("n", String(n));
    params.set("real", real ? "1" : "0");
    if (testUrl) params.set("test", testUrl);
    return `/api/sub?${params.toString()}`;
  }, [enabled, fmt, n, real, testUrl]);

  const exportNodes = result ? pickExportNodes(result, n) : [];
  const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";
  const uris = exportNodes.length ? buildUriList(exportNodes) : "";

  async function copy(label: string, text: string) {
    if (!text) {
      toast.error("Сначала нажмите «Обновить пул»");
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Скопировано");
    window.setTimeout(() => setCopied(null), 1500);
  }

  function downloadYaml() {
    if (!yaml) {
      toast.error("Сначала нажмите «Обновить пул»");
      return;
    }
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "relay.yaml";
    a.click();
    URL.revokeObjectURL(href);
    toast.message("Ищите relay.yaml в папке «Загрузки». Если файла нет — скопируйте YAML.");
  }

  const subUrl = subPath ? `${selectedHost === "localhost" ? "http://localhost:8080" : `http://${selectedHost}:8080`}${subPath}` : "";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Живая подписка</p>
        <p className="mt-1 text-sm text-fg-muted">
          Готовая ссылка для Hiddify: New Profile → Add from clipboard. Формат и
          количество сразу вшиты в URL.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setHostMode("auto")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "auto" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>Авто</button>
          <button type="button" onClick={() => setHostMode("localhost")} className={`h-9 rounded-md px-3 text-xs ${hostMode === "localhost" ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>localhost</button>
          {lanIps.map((ip) => (
            <button key={ip} type="button" onClick={() => setHostMode("lan")} className={`h-9 rounded-md px-3 font-mono text-xs ${hostMode === "lan" && selectedHost === ip ? "bg-primary text-primary-foreground" : "bg-bg-subtle text-fg-muted"}`}>{ip}</button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {FMT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFmt(opt.id)}
              className={`h-9 rounded-md px-3 text-xs ${
                fmt === opt.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-bg-subtle text-fg-muted"
              }`}
            >
              {opt.label}
              <span className="ml-1 opacity-70">{opt.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {N_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onN(count)}
              className={`h-9 min-w-11 rounded-md px-3 font-mono text-xs ${
                n === count
                  ? "bg-primary text-primary-foreground"
                  : "bg-bg-subtle text-fg-muted"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted">
          {subUrl || "Добавьте хотя бы один источник"}
        </pre>
        <div className="mt-1 text-xs text-fg-subtle">
          Адрес подписки: <span className="font-mono">{selectedHost}</span>
          {hostMode === "lan" && lanIps.length === 0 ? " · LAN IPv4 не найден" : ""}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              if (!subUrl) {
                toast.error("Добавьте источник");
                return;
              }
              void copy("sub", subUrl);
            }}
          >
            {copied === "sub" ? <Check /> : <Copy />}
            Скопировать URL
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Файл для компьютера</p>
        <p className="mt-1 text-sm text-fg-muted">
          Если ссылка из превью не открывается на ПК — скачайте YAML и
          импортируйте в Hiddify или Clash Verge.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={downloadYaml}>
            <Download />
            Скачать relay.yaml
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => copy("yaml", yaml)}
          >
            {copied === "yaml" ? <Check /> : <Copy />}
            Скопировать YAML
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => copy("uri", uris)}
          >
            {copied === "uri" ? <Check /> : <Copy />}
            Скопировать URI
          </Button>
        </div>
      </div>
    </div>
  );
}
