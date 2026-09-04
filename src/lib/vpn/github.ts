export function normalizeSourceUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Пустой адрес");
  let raw = trimmed;
  try {
    const u = new URL(trimmed);
    u.hash = "";
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
        const [user, repo, , ref, ...rest] = parts;
        return `https://raw.githubusercontent.com/${user}/${repo}/${ref}/${rest.join("/")}`;
      }
    }
    raw = u.toString();
  } catch {
    throw new Error("Некорректный URL");
  }
  if (!/^https?:\/\//i.test(raw)) throw new Error("Нужен http(s) URL");
  return raw;
}

export function sourceNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const file = u.pathname.split("/").filter(Boolean).pop() ?? "source";
    return decodeURIComponent(file).replace(/\.(txt|yaml|yml|json)$/i, "");
  } catch {
    return "source";
  }
}

function utf8ToB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(s, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlToUtf8(param: string): string {
  const pad = param.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  if (typeof atob === "function") {
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeSourceParam(urls: string[]): string {
  return utf8ToB64Url(JSON.stringify(urls));
}

export function decodeSourceParam(param: string): string[] {
  try {
    const parsed = JSON.parse(b64UrlToUtf8(param)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is string => typeof x === "string" && /^https?:\/\//i.test(x),
    );
  } catch {
    return [];
  }
}
