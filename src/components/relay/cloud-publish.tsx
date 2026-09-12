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
  type CloudPublishSettings,
} from "@/lib/vpn/cloud-publish";

export const CLOUD_SETTINGS_CHANGED = "relay:cloud-settings";
const AUTO_KEY = "relay:cloud-auto";

export function CloudPublishPanel() {
  const [settings, setSettings] = useState<CloudPublishSettings>(loadCloudPublishSettings());
  const [status, setStatus] = useState(readCloudPublishStatus());
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAuto(localStorage.getItem(AUTO_KEY) === "true");
  }, []);

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

  const last = status.results.length ? status.results[status.results.length - 1] : null;

  return <SettingsCard icon={<Cloud />} title="Публикация в облако" description="Vercel Edge + Upstash: внешний стабильный endpoint подписки">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <label className="grid gap-1.5"><Label htmlFor="cloud-edge-url">Edge URL</Label><Input id="cloud-edge-url" value={settings.edgeUrl} onChange={(event) => update({ ...settings, edgeUrl: event.target.value })} placeholder="https://relay-edge.vercel.app/api/publish" className="font-mono text-xs" /></label>
      <label className="grid gap-1.5"><Label htmlFor="cloud-secret">Секрет</Label><Input id="cloud-secret" type="password" value={settings.secret} onChange={(event) => update({ ...settings, secret: event.target.value })} placeholder="SECRET" className="font-mono text-xs" /></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg-subtle px-3 py-2.5">
      <div><p className="text-xs font-medium">Автопубликация после скана</p><p className="mt-0.5 text-[10px] text-fg-muted">Публикуются b64 и Mihomo YAML из live-профиля.</p></div>
      <Switch checked={auto} disabled={!settings.edgeUrl || !settings.secret} onCheckedChange={(checked) => { setAuto(checked); localStorage.setItem(AUTO_KEY, String(checked)); }} />
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => void publish()} disabled={busy || !settings.edgeUrl || !settings.secret}>{busy ? <RefreshCw className="animate-spin" /> : <UploadCloud />}{busy ? "Публикация…" : "Опубликовать сейчас"}</Button>{last ? <span className={`text-[10px] ${last.ok ? "text-live" : "text-warning"}`}>{last.ok ? <Check className="mr-1 inline size-3" /> : null}Последняя: {new Date(last.at).toLocaleString()} · HTTP {last.status}</span> : <span className="text-[10px] text-fg-subtle">Последняя публикация: нет данных</span>}</div>
    <p className="text-[10px] text-fg-subtle">Секрет хранится только в браузере и не записывается в Relay logs.</p>
  </SettingsCard>;
}

export function CloudPublishController() {
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [lastScanStamp, setLastScanStamp] = useState(0);

  useEffect(() => {
    const onSettings = () => setSettingsVersion((value) => value + 1);
    window.addEventListener(CLOUD_SETTINGS_CHANGED, onSettings);
    return () => window.removeEventListener(CLOUD_SETTINGS_CHANGED, onSettings);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const response = await fetch("/api/scan/status", { cache: "no-store" });
        if (!response.ok) return;
        const progress = await response.json() as { phase?: string; active?: boolean; updatedAt?: number };
        if (!active || progress.phase !== "done" || progress.active) return;
        const settings = loadCloudPublishSettings();
        if (localStorage.getItem(AUTO_KEY) !== "true" || !settings.edgeUrl || !settings.secret) return;
        const stamp = Number(progress.updatedAt || 0);
        const marker = Number(localStorage.getItem("relay:cloud-last-auto") || "0");
        if (!stamp || stamp <= marker || stamp === lastScanStamp) return;
        localStorage.setItem("relay:cloud-last-auto", String(stamp));
        setLastScanStamp(stamp);
        await publishToEdge(settings);
      } catch {
        // Cloud publication is deliberately non-fatal.
      }
    };
    void tick();
    timer = window.setInterval(() => void tick(), 1500);
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [settingsVersion, lastScanStamp]);

  return null;
}

export function CloudStatusDot() {
  const [warning, setWarning] = useState(false);
  useEffect(() => {
    const update = () => setWarning(readCloudPublishStatus().warning);
    update();
    window.addEventListener("relay:cloud-status", update);
    return () => window.removeEventListener("relay:cloud-status", update);
  }, []);
  return warning ? <span title="Ошибка публикации в облако" className="size-2 rounded-full bg-warning" /> : null;
}

function SettingsCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-surface p-4 shadow-border"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-primary">{icon}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-[10px] text-fg-subtle">{description}</p></div></div><div className="mt-4 space-y-3">{children}</div></section>;
}
