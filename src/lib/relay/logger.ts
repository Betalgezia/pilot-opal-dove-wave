export type LogLevel = "info" | "warn" | "error";
export type LogCategory = "scan" | "mihomo" | "fetch" | "parse" | "system";

export interface RelayLogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_LOGS = 1000;
const entries: RelayLogEntry[] = [];
let sequence = 0;

function push(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>) {
  entries.push({
    id: ++sequence,
    timestamp: Date.now(),
    level,
    category,
    message,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  });
  if (entries.length > MAX_LOGS) entries.splice(0, entries.length - MAX_LOGS);
}

export const relayLogger = {
  info(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    push("info", category, message, meta);
  },
  warn(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    push("warn", category, message, meta);
  },
  error(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    push("error", category, message, meta);
  },
  getLogs(filters: { level?: LogLevel; since?: number } = {}): RelayLogEntry[] {
    return entries.filter((entry) => {
      if (filters.level && entry.level !== filters.level) return false;
      if (filters.since !== undefined && entry.timestamp < filters.since) return false;
      return true;
    }).map((entry) => ({ ...entry, ...(entry.meta ? { meta: { ...entry.meta } } : {}) }));
  },
  clear() {
    entries.length = 0;
  },
};

export { MAX_LOGS };
