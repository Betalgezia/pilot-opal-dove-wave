import type { NodeQualityHistory } from "./quality-history.server";
import type { ProbedNode } from "./types";

export const QUALITY_TARGETS = [
  { url: "https://www.youtube.com/generate_204", label: "YouTube" },
  { url: "https://www.gstatic.com/generate_204", label: "Google" },
  { url: "https://connectivitycheck.gstatic.com/generate_204", label: "Connectivity" },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function latencyScore(latency: number | null): number {
  if (latency === null) return 0;
  if (latency <= 80) return 35;
  if (latency <= 120) return 33;
  if (latency <= 180) return 30;
  if (latency <= 250) return 27;
  if (latency <= 350) return 23;
  if (latency <= 500) return 18;
  if (latency <= 750) return 11;
  if (latency <= 1100) return 5;
  return 1;
}

function historyReliability(history: NodeQualityHistory | undefined, now: number): number {
  if (!history || history.samples === 0) return 0.5;
  const reliability = history.successes / history.samples;
  const age = history.lastAliveAt ? now - history.lastAliveAt : Number.POSITIVE_INFINITY;
  const recency = age < 120_000 ? 1 : age < 900_000 ? 0.85 : age < 3_600_000 ? 0.65 : 0.4;
  return clamp(reliability * 0.75 + recency * 0.25, 0, 1);
}

function stabilityScore(history: NodeQualityHistory | undefined, now: number): number {
  if (!history || history.samples < 2) return 10;
  const reliability = history.successes / history.samples;
  const streakBonus = Math.min(1, history.currentStreak / 6) * 0.25;
  const agePenalty = history.lastAliveAt && now - history.lastAliveAt < 1_800_000 ? 0 : 0.15;
  return clamp((reliability + streakBonus - agePenalty) * 20, 0, 20);
}

function targetScore(targetResults: Record<string, boolean> | undefined): number {
  if (!targetResults) return 0;
  const checked = Object.values(targetResults);
  if (checked.length === 0) return 0;
  const successes = checked.filter(Boolean).length;
  return (successes / checked.length) * 20;
}

export function scoreNode(
  node: ProbedNode,
  history: NodeQualityHistory | undefined,
  now = Date.now(),
): { qualityScore: number; confidence: number; stability: number } {
  const stable = stabilityScore(history, now);
  const confidenceBase = historyReliability(history, now);
  const confidence = Math.round(clamp(
    (node.alive ? 0.65 : 0.1) + confidenceBase * 0.35,
    0,
    1,
  ) * 100);
  const score = node.alive
    ? Math.round(clamp(
        latencyScore(node.latency) + stable + targetScore(node.targetResults) + confidence * 0.15,
        0,
        100,
      ))
    : 0;
  return { qualityScore: score, confidence, stability: Math.round(stable * 5) / 5 };
}

export function rankNodes(nodes: ProbedNode[]): ProbedNode[] {
  return [...nodes].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    const score = (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
    if (score !== 0) return score;
    const confidence = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confidence !== 0) return confidence;
    return (a.latency ?? 99999) - (b.latency ?? 99999);
  });
}

export function pickDeepVerification(nodes: ProbedNode[], limit: number): ProbedNode[] {
  return rankNodes(nodes.filter((node) => node.alive)).slice(0, limit);
}
