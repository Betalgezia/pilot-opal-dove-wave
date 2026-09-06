import type { ChildProcess } from "node:child_process";

const activeControllers = new Set<AbortController>();
const activeChildren = new Set<ChildProcess>();

export function beginScan(): AbortController {
  const controller = new AbortController();
  activeControllers.add(controller);
  return controller;
}

export function endScan(controller: AbortController): void {
  activeControllers.delete(controller);
}

export function registerMihomoChild(child: ChildProcess): void {
  activeChildren.add(child);
}

export function unregisterMihomoChild(child: ChildProcess): void {
  activeChildren.delete(child);
}

export async function cancelActiveScan(): Promise<boolean> {
  if (activeControllers.size === 0 && activeChildren.size === 0) return false;

  for (const controller of activeControllers) controller.abort();
  const children = [...activeChildren].filter((child) => child.exitCode === null);

  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already exited */
    }
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      for (const child of children) {
        if (child.exitCode !== null) continue;
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
      resolve();
    }, 2000);
    timer.unref();

    if (children.length === 0) {
      clearTimeout(timer);
      resolve();
      return;
    }

    let remaining = children.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) {
        clearTimeout(timer);
        resolve();
      }
    };
    for (const child of children) {
      if (child.exitCode !== null) {
        done();
        continue;
      }
      child.once("exit", done);
      child.once("error", done);
    }
  });

  return true;
}
