export type LogLevel = "info" | "warn" | "error";
export type LogCategory = "scan" | "mihomo" | "fetch" | "parse" | "system";

export interface RelayLog {
  id: string;
  ts: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
}

const LIMIT = 1000;
const logs: RelayLog[] = [];
let seq = 0;

function push(level: LogLevel, category: LogCategory, message: string, data?: Record<string, unknown>) {
  logs.push({ id: `${Date.now().toString(36)}-${(++seq).toString(36)}`, ts: Date.now(), level, category, message, data });
  if (logs.length > LIMIT) logs.splice(0, logs.length - LIMIT);
}

export const relayLogger = {
  info(category: LogCategory, message: string, data?: Record<string, unknown>) { push("info", category, message, data); },
  warn(category: LogCategory, message: string, data?: Record<string, unknown>) { push("warn", category, message, data); },
  error(category: LogCategory, message: string, data?: Record<string, unknown>) { push("error", category, message, data); },
  getLogs(options: { level?: LogLevel; since?: number } = {}) {
    return logs.filter((entry) => (!options.level || entry.level === options.level) && (!options.since || entry.ts >= options.since));
  },
  clear() { logs.length = 0; },
};
