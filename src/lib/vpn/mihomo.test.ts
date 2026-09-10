import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildMihomoYaml } from "./mihomo.ts";
import { canRunMihomo, ensureMihomoBinary } from "./mihomo-bin.server.ts";
import type { ParsedNode, SourceScan } from "./types.ts";

const sources: SourceScan[] = [{ id: "src", name: "source", url: "https://example.invalid/list", ok: true, error: null, parsed: 1, unique: 1, probed: 1, alive: 1, bestLatency: 100 }];
const node: ParsedNode = {
  id: "test-node",
  uri: "vless://11111111-1111-1111-1111-111111111111@example.com:443?type=tcp&security=tls&sni=example.com",
  protocol: "vless",
  name: "DE test",
  host: "example.com",
  port: 443,
  country: "DE",
  sourceId: "src",
  sourceName: "source",
  uuid: "11111111-1111-1111-1111-111111111111",
  security: "tls",
  network: "tcp",
  extra: {},
};

test("buildMihomoYaml keeps proxy list and groups structurally valid", () => {
  const yaml = buildMihomoYaml([node], sources);
  assert.match(yaml, /^proxies:\n  - name: /m);
  assert.match(yaml, /\nproxy-groups:\n  - name: "RELAY"\n    type: select\n    proxies:\n/m);
  assert.match(yaml, /\n      - "DE vless example"/);
  assert.match(yaml, /\nrules:\n  - MATCH,RELAY\n$/);
  assert.doesNotMatch(yaml, /client-fingerprint: .* +"/);
  assert.doesNotMatch(yaml, /network: "[^\"]+ +"/);
});

test("generated YAML is accepted by mihomo when the local binary is available", async (t) => {
  if (!canRunMihomo()) {
    t.skip("mihomo binary is not available in this environment");
    return;
  }
  const bin = await ensureMihomoBinary();
  const dir = await mkdtemp(path.join(tmpdir(), "relay-yaml-test-"));
  const config = path.join(dir, "config.yaml");
  await writeFile(config, buildMihomoYaml([node], sources), "utf8");
  try {
    const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
      const child = spawn(bin, ["-t", "-d", dir, "-f", config], { stdio: ["ignore", "pipe", "pipe"], windowsHide: process.platform === "win32" });
      let stderr = "";
      child.stderr.on("data", (buf) => { stderr += buf.toString(); });
      child.once("error", reject);
      child.once("exit", (code) => resolve({ code, stderr }));
    });
    assert.equal(result.code, 0, result.stderr || "mihomo rejected generated YAML");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
