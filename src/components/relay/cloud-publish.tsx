import { Check, Cloud, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  loadCloudPublishSettings,
  publishToEdge,
  readCloudPublishStatus,
  saveCloudPublishSettings,
  type CloudPublishResult,
  type CloudPublishSettings,
} from "@/lib/vpn/cloud-publish";

export const CLOUD_SETTINGS_CHANGED = "relay:cloud-settings";
export const CLOUD_PUBLISH_NOW = "relay:cloud-publish-now";

export function CloudPublishPanel() {
  const [settings, setSettings] = useState<CloudPublishSettings>(loadCloudPublishSettings());
  const [status, setStatus] = useState(readCloudPublishStatus());
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

  async function publish() {
    setBusy(true);
    try {
      const results = await publishToEdge(settings);
      const ok = results.every((item) => item.ok);
      if (ok) toast.success("Подписка опубликована в облако");
      else toast.warning("Публикация завершилась с ошибкой — см. Логи");
      setStatus(readCloudPublishStatus());
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onPublish = () => { void publish(); };
    window.addEventListener(CLOUD_PUBLISH_NOW, onPublish);
    return () => window.removeEventListener(CLOUD_PUBLISH_NOW, onPublish);
  }, [settings]);

  const last = status.results.length ? status.results[status.results.length - 1] : null;

  return <SettingsCard icon={<Cloud />} title="Публикация в облако" description="Vercel Edge + Upstash: внешний стабильный endpoint подписки">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <label className="grid gap-1.5"><Label htmlFor="cloud-edge-url">Edge URL</Label><Input id="cloud-edge-url" value={settings.edgeUrl} onChange={(event) => update({ ...settings, edgeUrl: event.target.value })} placeholder="https://relay-edge.vercel.app/api/publish" className="font-mono text-xs" /></label>
      <label className="grid gap-1.5"><Label htmlFor="cloud-secret">Секрет</Label><Input id="cloud-secret" type="password" value={settings.secret} onChange={(event) => update({ ...settings, secret: event.target.value })} placeholder="SECRET" className="font-mono text-xs" /></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg-subtle px-3 py-2.5">
      <div><p className="text-xs font-medium">Автопубликация после скана</p><p className="mt-0.5 text-[10px] text-fg-muted">Публикуются b64 и Mihomo YAML из live-профиля.</p></div>
      <Switch checked={Boolean(settings.edgeUrl && settings.secret) && Boolean(localStorage.getItem("relay:cloud-auto"))} onCheckedChange={(checked) => localStorage.setItem("relay:cloud-auto", String(checked))} />
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => void publish()} disabled={busy || !settings.edgeUrl || !settings.secret}>{busy ? <RefreshCw className="animate-spin" /> : <UploadCloud />}{busy ? "Публикация…" : "Опубликовать сейчас"}</Button>{last ? <span className={`text-[10px] ${last.ok ? "text-live" : "text-warning"}`}>{last.ok ? <Check className="mr-1 inline size-3" /> : null}Последняя: {new Date(last.at).toLocaleString()} · HTTP {last.status}</span> : <span className="text-[10px] text-fg-subtle">Последняя публикация: нет данных</span>}</div>
  </SettingsCard>;
}

export function CloudPublishController() {
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);

  useEffect(() => {
    const onSettings = () => setSettingsVersion((value) => value + 1);
    window.addEventListener(CLOUD_SETTINGS_CHANGED, onSettings);
    return () => window.removeEventListener(CLOUD_SETTINGS_CHANGED, onSettings);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const tick = async () => {
      try {
        const response = await fetch("/api/scan/status", { cache: "no-store" });
        if (!response.ok) return;
        const progress = await response.json() as { phase?: string; active?: boolean; updatedAt?: number };
        if (progress.phase !== "done" || progress.active) return;
        const settings = loadCloudPublishSettings();
        if (localStorage.getItem("relay:cloud-auto") !== "true" || !settings.edgeUrl || !settings.secret) return;
        const marker = Number(localStorage.getItem("relay:cloud-last-auto") || "0");
        const stamp = Number(progress.updatedAt || 0);
        if (!stamp || stamp === marker || stamp === lastScanAt) return;
        localStorage.setItem("relay:cloud-last-auto", String(stamp));
        setLastScanAt(stamp);
        await publishToEdge(settings);
      } catch {
        // Cloud publication is deliberately non-fatal.
      }
    };
    void tick();
    timer = window.setInterval(() => void tick(), 1500);
    return () => { if (timer) window.clearInterval(timer); };
  }, [settingsVersion, lastScanAt]);

  return null;
}

function SettingsCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-primary">{icon}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-[10px] text-fg-subtle">{description}</p></div></div><div className="mt-4 space-y-3">{children}</div></section>;
}

void (0 satisfies 0 | CloudPublishResult);
