import type { ParsedNode } from "./types";

function hasTls(node: ParsedNode): boolean {
  const security = (node.security ?? "").trim().toLowerCase();
  const tls = (node.extra?.tls ?? "").trim().toLowerCase();
  return security === "tls" || security === "reality" || tls === "tls";
}

export function nodeIdentityKey(node: ParsedNode): string {
  return [
    node.protocol.trim().toLowerCase(),
    node.host.trim().toLowerCase(),
    String(node.port),
    (node.uuid ?? "").trim().toLowerCase(),
    (node.network ?? "tcp").trim().toLowerCase(),
    hasTls(node) ? "tls" : "plain",
  ].join("|");
}

function completeness(node: ParsedNode): number {
  return [node.uuid, node.password, node.method, node.sni, node.path, node.serviceName, node.pbk, node.sid, node.alpn]
    .filter((value) => typeof value === "string" && value.trim()).length;
}

export function mergeNodesByIdentity(nodes: ParsedNode[]): ParsedNode[] {
  const merged = new Map<string, ParsedNode>();
  const sourceIds = new Map<string, Set<string>>();
  const sourceNames = new Map<string, Set<string>>();

  for (const node of nodes) {
    const key = nodeIdentityKey(node);
    const current = merged.get(key);
    if (!current || completeness(node) > completeness(current)) {
      merged.set(key, current ? { ...node, sourceId: current.sourceId, sourceName: current.sourceName } : node);
    }
    const ids = sourceIds.get(key) ?? new Set<string>();
    ids.add(node.sourceId);
    sourceIds.set(key, ids);
    const names = sourceNames.get(key) ?? new Set<string>();
    names.add(node.sourceName);
    sourceNames.set(key, names);
  }

  return [...merged.entries()].map(([key, node]) => ({
    ...node,
    sourceIds: [...(sourceIds.get(key) ?? new Set([node.sourceId]))],
    sourceNames: [...(sourceNames.get(key) ?? new Set([node.sourceName]))],
  }));
}
