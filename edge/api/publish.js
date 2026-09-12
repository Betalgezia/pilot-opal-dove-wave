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
  if (req.method !== "POST") return res.status(405).send("method not allowed");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body || body.length < 16) return res.status(400).send("empty payload");
  const fmt = (req.query.fmt || "b64").toString();
  await kv(["set", "sub:" + fmt, body]);
  await kv(["set", "sub:at", new Date().toISOString()]);
  res.status(200).send("ok");
}
