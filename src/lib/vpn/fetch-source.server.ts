const fetchCache = new Map<string, { at: number; text: string }>();
const FETCH_TTL = 60_000;

export async function fetchSourceText(url: string): Promise<string> {
  const hit = fetchCache.get(url);
  if (hit && Date.now() - hit.at < FETCH_TTL) return hit.text;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        accept: "text/plain,text/*,*/*",
        "user-agent": "Relay/1.0 (subscription aggregator)",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 3_500_000) {
      throw new Error("Список слишком большой");
    }
    let text = buf.toString("utf8");
    if (text.includes("\u0000")) {
      throw new Error("Бинарный файл, нужен текстовый список URI");
    }
    fetchCache.set(url, { at: Date.now(), text });
    return text;
  } finally {
    clearTimeout(timer);
  }
}
