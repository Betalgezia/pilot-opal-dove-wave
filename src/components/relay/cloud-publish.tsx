import { Check, Cloud, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  loadCloudPublishSettings,
  publishCurrentToGist,
  readCloudAuto,
  readCloudPublishStatus,
  saveCloudAuto,
  saveCloudPublishSettings,
  type CloudPublishSettings,
} from "@/lib/vpn/cloud-publish";

export const CLOUD_SETTINGS_CHANGED = "relay:cloud-settings";

export function CloudPublishPanel() {
  const [settings, setSettings] = useState<CloudPublishSettings>(loadCloudPublishSettings());
  const [status, setStatus] = useState(readCloudPublishStatus());
  const [auto, setAuto] = useState(readCloudAuto());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onStatus = () => setStatus(readCloudPublishStatus());
    window.addEventListener("relay:cloud-status", onStatus);
    return () => window.removeEventListener("relay:cloud-status", onStatus);
  }, []);

  function update(next: CloudPublishSettings) {
    setSettings(next);
    saveCloudPublishSettings(next);
    window.dispatchEvent(new Event(CLOUD_SETTINGS_CHANGED));
  }

  const configured = Boolean(settings.gistId && settings.token && settings.username);

  async function publish() {
    setBusy(true);
    try {
      const results = await publishCurrentToGist(settings);
      const successful = results.filter((item) => item.ok);
      const failed = results.find((item) => !item.ok);
      if (successful.length === results.length) {
        toast.success(`✅ Опубликовано, ссылка: ${successful[0]?.url ?? "gist"}`);
      } else {
        toast.error(`❌ Ошибка: ${failed?.error ?? "публикация не удалась"}`);
      }
      setStatus(readCloudPublishStatus());
    } catch (error) {
      toast.error(`❌ Ошибка: ${error instanceof Error ? error.message : "публикация не удалась"}`);
    } finally {
      setBusy(false);
    }
  }

  const last = status.results.length ? status.results[status.results.length - 1] : null;
  const previewUrl = configured ? `https://gist.githubusercontent.com/${encodeURIComponent(settings.username.trim())}/${settings.gistId.trim()}/raw/relay.b64` : "";

  return <SettingsCard icon={<Cloud />} title="Публикация в облако" description="GitHub Gist: внешний стабильный endpoint подписки без edge-сервера">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5"><Label htmlFor="cloud-gist-id">Gist ID</Label><Input id="cloud-gist-id" value={settings.gistId} onChange={(event) => update({ ...settings, gistId: event.target.value })} placeholder="abc123def456..." className="font-mono text-xs" /></label>
      <label className="grid gap-1.5"><Label htmlFor="cloud-github-username">GitHub Username</Label><Input id="cloud-github-username" value={settings.username} onChange={(event) => update({ ...settings, username: event.target.value })} placeholder="ваш-логин" className="font-mono text-xs" /></label>
    </div>
    <label className="grid gap-1.5"><Label htmlFor="cloud-github-token">GitHub Token</Label><Input id="cloud-github-token" type="password" value={settings.token} onChange={(event) => update({ ...settings, token: event.target.value })} placeholder="ghp_..." className="font-mono text-xs" /></label>
    <div className="flex items-center justify-between gap-4 rounded-xl bg-bg-subtle px-3 py-2.5">
      <div><p className="text-xs font-medium">Автопубликация после скана</p><p className="mt-0.5 text-[10px] text-fg-muted">После каждого завершённого скана публикуются b64 и Mihomo YAML.</p></div>
      <Switch checked={auto} disabled={!configured} onCheckedChange={(checked) => { setAuto(checked); saveCloudAuto(checked); }} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={configured ? "default" : "secondary"} onClick={() => void publish()} disabled={busy || !configured}>{busy ? <RefreshCw className="animate-spin" /> : <UploadCloud />}{busy ? "Публикация…" : "Опубликовать сейчас"}</Button>
      {last ? <span className={`text-[10px] ${last.ok ? "text-live" : "text-warning"}`}>{last.ok ? <Check className="mr-1 inline size-3" /> : null}Последняя публикация: {new Date(last.at).toLocaleString()} · {last.live} live · HTTP {last.status || "ERR"}</span> : <span className="text-[10px] text-fg-subtle">Последняя публикация: нет данных</span>}
    </div>
    {previewUrl ? <div className="text-[10px] text-fg-muted">Preview: <a href={previewUrl} target="_blank" rel="noreferrer" className="font-mono text-primary underline-offset-2 hover:underline">{previewUrl}</a></div> : null}
    <p className="text-[10px] text-fg-subtle">Token хранится только в localStorage и никогда не записывается в Relay Logs.</p>
  </SettingsCard>;
}

function SettingsCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-primary">{icon}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-[10px] text-fg-subtle">{description}</p></div></div><div className="mt-4 space-y-3">{children}</div></section>;
}