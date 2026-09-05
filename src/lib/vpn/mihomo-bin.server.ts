import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { MIHOMO_VERSION } from "./constants";

const CACHE_DIR = path.join(tmpdir(), "relay-mihomo");
const BIN_PATH = path.join(CACHE_DIR, "mihomo");
const STAMP_PATH = path.join(CACHE_DIR, "version");

export function isServerlessHost(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.CF_PAGES ||
      process.env.CF_WORKER ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

export function canRunMihomo(): boolean {
  if (isServerlessHost()) return false;
  return process.platform === "linux" || process.platform === "darwin";
}

function assetName(version: string): string {
  const plat = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  if (arch === "amd64") return `mihomo-${plat}-amd64-compatible-${version}.gz`;
  return `mihomo-${plat}-${arch}-${version}.gz`;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function runVersion(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["-v"], { stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    child.on("error", () => done(false));
    child.on("exit", (code) => done(code === 0));
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      done(false);
    }, 4000);
  });
}

let installing: Promise<string> | null = null;

export async function ensureMihomoBinary(): Promise<string> {
  if (!canRunMihomo()) {
    throw new Error("mihomo недоступен на этом хосте");
  }
  if (await exists(BIN_PATH)) {
    const stamp = await readFile(STAMP_PATH, "utf8").catch(() => "");
    if (stamp.trim() === MIHOMO_VERSION && (await runVersion(BIN_PATH))) {
      return BIN_PATH;
    }
  }
  if (installing) return installing;
  installing = installBinary().finally(() => {
    installing = null;
  });
  return installing;
}

async function installBinary(): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const name = assetName(MIHOMO_VERSION);
  const url = `https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${name}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "relay-mihomo" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Не удалось скачать mihomo (${res.status})`);
  }
  const tmpPath = `${BIN_PATH}.tmp`;
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    createGunzip(),
    createWriteStream(tmpPath),
  );
  await chmod(tmpPath, 0o755);
  await rename(tmpPath, BIN_PATH).catch(async () => {
    await unlink(BIN_PATH).catch(() => undefined);
    await rename(tmpPath, BIN_PATH);
  });
  await writeFile(STAMP_PATH, MIHOMO_VERSION, "utf8");
  if (!(await runVersion(BIN_PATH))) {
    throw new Error("Скачанный mihomo не запускается");
  }
  return BIN_PATH;
}
