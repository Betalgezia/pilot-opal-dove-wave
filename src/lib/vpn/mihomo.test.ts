import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildMihomoYaml } from "./mihomo.ts";
import { canRunMihomo, ensureMihomoBinary } from "./mihomo-bin.server.ts";
import type { ParsedNode, SourceScan } from "./types.ts";

const sources: SourceScan[] = [{ id: "src", name: "source", url: "https://example.invalid/list", ok: true, error: null, parsed: 2, unique: 2, probed: 2, alive: 2, bestLatency: 100 }];
function makeNode(id: string, extra: Partial<ParsedNode> = {}): ParsedNode {
  return {
    id,
    uri: `vless://${id}@example.com:443?type=tcp&security=tls&sni=example.com`,
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
    ...extra,
  };
}
const node = makeNode("test-node");

test("buildMihomoYaml keeps proxy list and groups structurally valid", () => {
  const yaml = buildMihomoYaml([node], sources);
  assert.match(yaml, /^proxies:\n  - name: /m);
  assert.match(yaml, /\nproxy-groups:\n  - name: "RELAY"\n    type: select\n    proxies:\n/m);
  assert.match(yaml, /\n      - "DE vless example"/);
  assert.match(yaml, /\nrules:\n  - MATCH,RELAY\n$/);
  assert.doesNotMatch(yaml, /client-fingerprint: .* +"/);
  assert.doesNotMatch(yaml, /network: "[^\"]+ +"/);
});

test("generated YAML uses unique proxy names on collisions", () => {
  const yaml = buildMihomoYaml([makeNode("a"), makeNode("b")], sources);
  const names = [...yaml.matchAll(/^  - name: "([^"]+)"$/gm)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.some((name) => name.endsWith("-2")));
});

test("xhttp preserves auto/packet-up mode, packet encoding and embedded Xray options", () => {
  const xhttp = makeNode("xhttp", {
    uri: "vless://xhttp@example.com:443?type=xhttp&security=reality&path=%2Fauth&mode=auto&packetEncoding=xudp",
    network: "xhttp",
    security: "reality",
    path: "/auth",
    hostHeader: "max.ru",
    extra: {
      mode: "auto",
      packetEncoding: "xudp",
      extra: JSON.stringify({
        xPaddingBytes: "200-1000",
        xPaddingObfsMode: false,
        xPaddingKey: "x_padding",
        uplinkHTTPMethod: "POST",
        sessionPlacement: "header",
        sessionKey: "sid",
        seqPlacement: "query",
        seqKey: "seq",
        uplinkDataPlacement: "cookie",
        uplinkDataKey: "X-Payload",
        uplinkChunkSize: "3072",
        xmux: { maxConcurrency: "8-16", cMaxReuseTimes: "10-20" },
      }),
    },
  });
  const yaml = buildMihomoYaml([xhttp], sources);
  assert.match(yaml, /packet-encoding:\s*"xudp"/);
  assert.match(yaml, /network:\s*"xhttp"/);
  assert.match(yaml, /xhttp-opts:\n/);
  assert.match(yaml, /mode:\s*"auto"/);
  assert.match(yaml, /x-padding-bytes:\s*"200-1000"/);
  assert.match(yaml, /uplink-http-method:\s*"POST"/);
  assert.match(yaml, /reuse-settings:\n/);
  assert.match(yaml, /max-concurrency:\s*"8-16"/);
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
