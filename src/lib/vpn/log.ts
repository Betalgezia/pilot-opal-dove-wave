export function relayLog(...args: unknown[]): void {
  console.log("[relay]", ...args);
}

export function relayWarn(...args: unknown[]): void {
  console.warn("[relay]", ...args);
}

export function relayError(...args: unknown[]): void {
  console.error("[relay]", ...args);
}
