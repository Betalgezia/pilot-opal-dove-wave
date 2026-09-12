import { relayLogger } from "../relay/logger";
import { getActiveScanSignal } from "./scan-control.server";

const fetchCache = new Map<string, { at: number; text: string }>();
const FETCH_TTL = 60_000;

export async function fetchSourceText(url: string): Promise<string> {
  const hit = fetchCache.get(url);
  if (hit && Date.now() - hit.at < FETCH_TTL) {
    relayLogger.info("fetch", "Source cache hit", { url });
    return hit.text;
  }
  const started = Date.now();
  const ctrl = new AbortController();
  const activeSignal = getActiveScanSignal();
  const onAbort = () => ctrl.abort();
  activeSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "text/plain,text/*,*/*", "user-agent": "Relay/1.0 (subscription aggregator)" }, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 3_500_000) throw new Error("Список слишком большой");
    const text = buf.toString("utf8");
    if (text.includes("\u0000")) throw new Error("Бинарный файл, нужен текстовый список URI");
    fetchCache.set(url, { at: Date.now(), text });
    relayLogger.info("fetch", "Source fetched", { url, bytes: buf.byteLength, durationMs: Date.now() - started });
    return text;
  } catch (err) {
    relayLogger.error("fetch", "Source fetch failed", { url, durationMs: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    clearTimeout(timer);
    activeSignal?.removeEventListener("abort", onAbort);
  }
}
