import assert from "node:assert/strict";
import test from "node:test";
import { rankNodes, scoreNode } from "./quality";
import type { ProbedNode } from "./types";

function node(id: string, latency: number, extra: Partial<ProbedNode> = {}): ProbedNode {
  return {
    id,
    uri: `vless://${id}`,
    protocol: "vless",
    name: id,
    host: `${id}.example.test`,
    port: 443,
    country: "DE",
    sourceId: "test",
    sourceName: "test",
    uuid: id,
    extra: {},
    alive: true,
    latency,
    ...extra,
  };
}

test("cold-start live node receives a bounded confidence score", () => {
  const result = scoreNode(node("cold", 90), undefined, Date.now());
  assert.equal(result.confidence, 70);
  assert.ok(result.qualityScore > 0);
  assert.ok(result.qualityScore <= 100);
});

test("deep target success improves quality without changing alive verdict", () => {
  const plain = node("plain", 120);
  const verified = node("verified", 120, {
    targetResults: {
      "https://www.gstatic.com/generate_204": true,
      "https://connectivitycheck.gstatic.com/generate_204": true,
    },
  });
  const plainScore = scoreNode(plain, undefined, Date.now()).qualityScore;
  const verifiedScore = scoreNode(verified, undefined, Date.now()).qualityScore;
  assert.ok(verifiedScore > plainScore);
  assert.equal(verified.alive, true);
});

test("ranking prefers healthy quality evidence before raw latency tie-break", () => {
  const fastButUnverified = node("fast", 80);
  const verified = node("verified", 150, {
    targetResults: {
      "https://www.gstatic.com/generate_204": true,
      "https://connectivitycheck.gstatic.com/generate_204": true,
    },
  });
  const ranked = rankNodes([
    { ...fastButUnverified, ...scoreNode(fastButUnverified, undefined) },
    { ...verified, ...scoreNode(verified, undefined) },
  ]);
  assert.equal(ranked[0].id, "verified");
});

test("dead nodes always rank below alive nodes", () => {
  const alive = node("alive", 600, scoreNode(node("alive", 600), undefined));
  const dead: ProbedNode = node("dead", 10, { alive: false, latency: null, qualityScore: 0, confidence: 0, stability: 0 });
  assert.equal(rankNodes([dead, alive])[0].id, "alive");
});
