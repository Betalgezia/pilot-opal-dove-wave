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

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if ((req.query.secret || "") !== SECRET || !SECRET) return res.status(403).send("forbidden");
  if (req.method !== "POST") return res.status(405).send("method not allowed");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body || body.length < 16) return res.status(400).send("empty payload");
  const fmt = (req.query.fmt || "b64").toString();
  if (fmt !== "b64" && fmt !== "clash") return res.status(400).send("unsupported format");
  await kv(["set", "sub:" + fmt, body]);
  await kv(["set", "sub:at", new Date().toISOString()]);
  res.status(200).send("ok");
}
