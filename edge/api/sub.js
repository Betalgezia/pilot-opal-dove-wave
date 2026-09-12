const SECRET = process.env.SECRET || "";
const URL_KV = process.env.UPSTASH_URL || "";
const TOKEN = process.env.UPSTASH_TOKEN || "";

async function kv(command) {
  const res = await fetch(URL_KV, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error("kv http " + res.status);
  return (await res.json()).result;
}

export default async function handler(req, res) {
  if ((req.query.secret || "") !== SECRET || !SECRET) return res.status(403).send("forbidden");
  const fmt = (req.query.fmt || "b64").toString();
  const sub = await kv(["get", "sub:" + fmt]);
  const at = await kv(["get", "sub:at"]);
  if (!sub) return res.status(404).send("not published yet");
  res.setHeader("Content-Type", fmt === "clash" ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=relay." + fmt);
  res.setHeader("X-Relay-Published-At", at || "unknown");
  res.setHeader("Profile-Update-Interval", "1");
  res.status(200).send(sub);
}
