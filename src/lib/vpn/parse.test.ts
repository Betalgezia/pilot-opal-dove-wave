import assert from "node:assert/strict";
import test from "node:test";
import { parseSubscription } from "./parse";

test("parser trims transport values and sanitizes ALPN", () => {
  const uri = "vless://11111111-1111-1111-1111-111111111111@example.com:443?type=tcp%20&security=tls%20&sni=example.com%20&fp=chrome%20&alpn=h2%20,http%2F1.1%20,bad-token%20#DE";
  const [node] = parseSubscription(uri, "test", "test");
  assert.ok(node);
  assert.equal(node.network, "tcp");
  assert.equal(node.security, "tls");
  assert.equal(node.sni, "example.com");
  assert.equal(node.fp, "chrome");
  assert.equal(node.alpn, "h2,http/1.1");
  assert.equal(node.uri, uri);
});

test("parser preserves xhttp transport and options", () => {
  const uri = "vless://11111111-1111-1111-1111-111111111111@example.com:443?type=xhttp&security=reality&path=%2F&mode=packet-up&sni=example.com&pbk=public-key";
  const [node] = parseSubscription(uri, "test", "test");
  assert.ok(node);
  assert.equal(node.network, "xhttp");
  assert.equal(node.path, "/");
  assert.equal(node.extra.mode, "packet-up");
});

test("parser rejects empty required grpc and websocket options", () => {
  const base = "vless://11111111-1111-1111-1111-111111111111@example.com:443";
  assert.equal(parseSubscription(`${base}?type=grpc&serviceName=%20`, "test", "test").length, 0);
  assert.equal(parseSubscription(`${base}?type=ws&path=%20`, "test", "test").length, 0);
});

test("parser trims VMess JSON string fields", () => {
  const json = JSON.stringify({ add: "example.com ", port: 443, id: "11111111-1111-1111-1111-111111111111", ps: "DE test ", net: "ws ", path: "/ws ", host: "cdn.example.com ", tls: "tls " });
  const raw = Buffer.from(json, "utf8").toString("base64");
  const [node] = parseSubscription(`vmess://${raw}`, "test", "test");
  assert.ok(node);
  assert.equal(node.host, "example.com");
  assert.equal(node.network, "ws");
  assert.equal(node.path, "/ws");
  assert.equal(node.hostHeader, "cdn.example.com");
  assert.equal(node.security, "tls");
});
