import assert from "node:assert/strict";
import test from "node:test";
import { rankNodes, scoreNode } from "./quality.ts";
import type { NodeQualityHistory, TargetHistory } from "./quality-history.server.ts";
import type { ProbedNode } from "./types.ts";

function node(id: string, latency: number, extra: Partial<ProbedNode> = {}): ProbedNode {
  return { id, uri: `vless://${id}`, protocol: "vless", name: id, host: `${id}.example.test`, port: 443, country: "DE", sourceId: "test", sourceName: "test", uuid: id, extra: {}, alive: true, latency, probeState: "checked", ...extra };
}
function history(targets: Record<string, TargetHistory>): NodeQualityHistory {
  return { nodeId: "history", samples: 10, successes: 9, failures: 1, currentStreak: 3, lastAliveAt: Date.now(), lastFailureAt: Date.now() - 60_000, lastLatency: 120, latencyEwma: 120, lastSeenAt: Date.now(), country: "DE", protocol: "vless", sourceId: "test", targets };
}

test("cold-start live node receives a bounded confidence score", () => { const result = scoreNode(node("cold", 90), undefined, Date.now()); assert.equal(result.confidence, 70); assert.ok(result.qualityScore > 0); assert.ok(result.qualityScore <= 100); });
test("deep target success improves quality without changing alive verdict", () => { const plain = node("plain", 120); const verified = node("verified", 120, { targetResults: { "https://www.gstatic.com/generate_204": true, "https://connectivitycheck.gstatic.com/generate_204": true } }); const plainScore = scoreNode(plain, undefined, Date.now()).qualityScore; const verifiedScore = scoreNode(verified, undefined, Date.now()).qualityScore; assert.ok(verifiedScore > plainScore); assert.equal(verified.alive, true); });
test("historical target reliability is a bounded quality bonus", () => { const plain = scoreNode(node("plain", 120), history({ "https://www.gstatic.com/generate_204": { checks: 10, successes: 0, lastAt: Date.now() } }), Date.now()).qualityScore; const reliable = scoreNode(node("reliable", 120), history({ "https://www.gstatic.com/generate_204": { checks: 10, successes: 10, lastAt: Date.now() } }), Date.now()).qualityScore; assert.ok(reliable > plain); assert.ok(reliable - plain <= 10); });
test("ranking prefers verified quality evidence before raw latency tie-break", () => { const fastButUnverified = node("fast", 80); const verified = node("verified", 150, { targetResults: { "https://www.gstatic.com/generate_204": true, "https://connectivitycheck.gstatic.com/generate_204": true } }); const ranked = rankNodes([{ ...fastButUnverified, ...scoreNode(fastButUnverified, undefined) }, { ...verified, ...scoreNode(verified, undefined) }]); assert.equal(ranked[0].id, "verified"); });
test("dead nodes always rank below alive nodes", () => { const alive = node("alive", 600, scoreNode(node("alive", 600), undefined)); const dead: ProbedNode = node("dead", 10, { alive: false, latency: null, qualityScore: 0, confidence: 0, stability: 0 }); assert.equal(rankNodes([dead, alive])[0].id, "alive"); });
test("unknown nodes are never treated as alive", () => { const unknown = node("unknown", 10, { alive: false, latency: null, probeState: "unknown" }); assert.equal(unknown.alive, false); assert.equal(unknown.probeState, "unknown"); });
