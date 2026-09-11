import assert from "node:assert/strict";
import test from "node:test";
import { mergeNodesByIdentity, nodeIdentityKey } from "./node-identity.ts";
import type { ParsedNode } from "./types.ts";

function node(sourceId: string, name: string, extra: Partial<ParsedNode> = {}): ParsedNode {
  return { id: `${sourceId}-${name}`, uri: `vless://uuid@example.com:443?type=ws#${name}`, protocol: "vless", name, host: "example.com", port: 443, country: null, sourceId, sourceName: sourceId, uuid: "uuid", network: "ws", security: "tls", path: "/", extra: {}, ...extra };
}

test("identity key ignores remark and differs by transport/tls", () => {
  const a = node("a", "one"); const b = node("b", "two");
  assert.equal(nodeIdentityKey(a), nodeIdentityKey(b));
  assert.notEqual(nodeIdentityKey(a), nodeIdentityKey({ ...a, network: "grpc", serviceName: "svc" }));
  assert.notEqual(nodeIdentityKey(a), nodeIdentityKey({ ...a, security: "none" }));
});

test("duplicate nodes are merged and source provenance is preserved", () => {
  const merged = mergeNodesByIdentity([node("a", "first"), node("b", "second")]);
  assert.equal(merged.length, 1);
  assert.deepEqual(new Set(merged[0].sourceIds), new Set(["a", "b"]));
  assert.deepEqual(new Set(merged[0].sourceNames), new Set(["a", "b"]));
});
