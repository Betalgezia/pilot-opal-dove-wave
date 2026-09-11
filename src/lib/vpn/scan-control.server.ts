import type { ChildProcess } from "node:child_process";

const activeControllers = new Set<AbortController>();
const activeChildren = new Set<ChildProcess>();

export interface ScanProgress {
  active: boolean;
  phase: "idle" | "fetch" | "parse" | "sample" | "probe" | "geoip" | "deep" | "quality" | "done" | "error";
  percent: number;
  message: string;
  startedAt: number | null;
  updatedAt: number;
}

let progress: ScanProgress = { active: false, phase: "idle", percent: 0, message: "Готово к сканированию", startedAt: null, updatedAt: Date.now() };

export function beginScan(): AbortController {
  const controller = new AbortController();
  activeControllers.add(controller);
  progress = { active: true, phase: "fetch", percent: 2, message: "Получение источников", startedAt: Date.now(), updatedAt: Date.now() };
  return controller;
}

export function updateScanProgress(phase: ScanProgress["phase"], percent: number, message: string): void {
  progress = { ...progress, active: phase !== "done" && phase !== "error", phase, percent: Math.max(0, Math.min(100, Math.round(percent))), message, updatedAt: Date.now() };
}

export function finishScanProgress(message = "Сканирование завершено"): void {
  progress = { ...progress, active: false, phase: "done", percent: 100, message, updatedAt: Date.now() };
}

export function failScanProgress(message = "Сканирование завершилось с ошибкой"): void {
  progress = { ...progress, active: false, phase: "error", percent: Math.min(progress.percent, 99), message, updatedAt: Date.now() };
}

export function getScanProgress(): ScanProgress { return progress; }

export function endScan(controller: AbortController): void {
  activeControllers.delete(controller);
}

export function getActiveScanSignal(): AbortSignal | undefined {
  const controllers = [...activeControllers];
  return controllers.at(-1)?.signal;
}

export function registerMihomoChild(child: ChildProcess): void { activeChildren.add(child); }
export function unregisterMihomoChild(child: ChildProcess): void { activeChildren.delete(child); }

export async function cancelActiveScan(): Promise<boolean> {
  if (activeControllers.size === 0 && activeChildren.size === 0) return false;
  for (const controller of activeControllers) controller.abort();
  const children = [...activeChildren].filter((child) => child.exitCode === null);
  for (const child of children) { try { child.kill("SIGTERM"); } catch {} }
  updateScanProgress("error", progress.percent, "Сканирование остановлено");
  if (children.length === 0) return true;
  await new Promise<void>((resolve) => {
    let remaining = children.length;
    const timer = setTimeout(() => { for (const child of children) { if (child.exitCode !== null) continue; try { child.kill("SIGKILL"); } catch {} } resolve(); }, 2000);
    timer.unref();
    const done = () => { remaining -= 1; if (remaining <= 0) { clearTimeout(timer); resolve(); } };
    for (const child of children) { if (child.exitCode !== null) done(); else { child.once("exit", done); child.once("error", done); } }
  });
  return true;
}
