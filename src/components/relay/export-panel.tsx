import { Check, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { encodeSourceParam } from "@/lib/vpn/github";
import { buildMihomoYaml, buildUriList } from "@/lib/vpn/mihomo";
import { pickExportNodes } from "@/lib/vpn/select";
import type { ScanResult, SourceDef } from "@/lib/vpn/types";

export function ExportPanel({
  result,
  sources,
}: {
  result: ScanResult | null;
  sources: SourceDef[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const enabled = sources.filter((s) => s.enabled).map((s) => s.url);
  const subPath = useMemo(() => {
    if (enabled.length === 0) return "";
    return `/api/sub?u=${encodeSourceParam(enabled)}&fmt=clash&n=24`;
  }, [enabled]);

  const exportNodes = result ? pickExportNodes(result, 24) : [];
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
    toast.success("Файл relay.yaml сохранён — откройте его в Hiddify или Clash Verge");
  }

  const subUrl =
    typeof window !== "undefined" && subPath
      ? `${window.location.origin}${subPath}`
      : subPath;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">На компьютер</p>
        <p className="mt-1 text-sm text-fg-muted">
          Relay сам не ставится на ПК и не включает VPN. Скачайте файл конфига
          и откройте его в клиенте: Hiddify, Clash Verge или v2rayN.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={downloadYaml}>
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

      <ol className="space-y-3 rounded-xl bg-surface p-4 text-sm text-fg-muted shadow-border">
        <li>
          <span className="font-medium text-fg">1. Клиент.</span> Установите{" "}
          Hiddify или Clash Verge Rev на Windows / macOS / Linux.
        </li>
        <li>
          <span className="font-medium text-fg">2. Пул.</span> В Relay нажмите
          «Обновить пул» и дождитесь живых нод.
        </li>
        <li>
          <span className="font-medium text-fg">3. Файл.</span> Скачайте
          relay.yaml. В Hiddify: New Profile → Import from file. В Clash Verge:
          Profiles → Import.
        </li>
        <li>
          <span className="font-medium text-fg">4. Подключение.</span> Выберите
          группу RELAY или AUTO и нажмите Connect в клиенте, не в браузере.
        </li>
      </ol>

      <div className="rounded-xl bg-surface p-4 shadow-border">
        <p className="text-sm font-medium">Живая подписка</p>
        <p className="mt-1 text-sm text-fg-muted">
          URL имеет смысл, если приложение опубликовано и клиент может его
          открыть. Для работы с ПК надёжнее файл YAML.
        </p>
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted">
          {subUrl || "Добавьте хотя бы один источник"}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => copy("sub", subUrl)}
          >
            {copied === "sub" ? <Check /> : <Copy />}
            Скопировать URL
          </Button>
        </div>
      </div>
    </div>
  );
}
