import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { inflateRawSync } from "node:zlib";
import { MIHOMO_VERSION } from "./constants";

const CACHE_DIR = path.join(tmpdir(), "relay-mihomo");
const BIN_NAME = process.platform === "win32" ? "mihomo.exe" : "mihomo";
const BIN_PATH = path.join(CACHE_DIR, BIN_NAME);
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
  return (
    process.platform === "linux" ||
    process.platform === "darwin" ||
    process.platform === "win32"
  );
}

function assetName(version: string): string {
  if (process.platform === "win32") {
    if (process.arch === "arm64") {
      return `mihomo-windows-arm64-${version}.zip`;
    }
    if (process.arch === "ia32") {
      return `mihomo-windows-386-${version}.zip`;
    }
    return `mihomo-windows-amd64-compatible-${version}.zip`;
  }

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
    const child = spawn(bin, ["-v"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: process.platform === "win32",
    });
    let settled = false;
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      done(false);
    }, 4000);
    timer.unref();

    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };

    child.on("error", () => done(false));
    child.on("exit", (code) => done(code === 0));
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

function extractMihomoExeFromZip(buffer: Buffer): Buffer {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, buffer.length - (22 + maxCommentLength));

  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Некорректный ZIP-архив mihomo");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralEnd = centralOffset + centralSize;
  if (centralEnd > buffer.length) throw new Error("Повреждённый ZIP-архив mihomo");

  let offset = centralOffset;
  for (let i = 0; i < totalEntries && offset < centralEnd; i += 1) {
    if (buffer.readUInt32LE(offset) !== centralSignature) break;

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (name.toLowerCase().endsWith(".exe") && name.toLowerCase().includes("mihomo")) {
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature) {
        throw new Error("Некорректная запись mihomo.exe в ZIP-архиве");
      }
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) throw new Error("Повреждённая запись mihomo.exe");

      const compressed = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return Buffer.from(compressed);
      if (compression === 8) {
        const data = inflateRawSync(compressed);
        if (data.length !== uncompressedSize) {
          throw new Error("Размер mihomo.exe после распаковки не совпадает");
        }
        return data;
      }
      throw new Error(`Неподдерживаемый метод сжатия ZIP: ${compression}`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error("mihomo.exe не найден в ZIP-архиве");
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
  if (process.platform === "win32") {
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(tmpPath, extractMihomoExeFromZip(buffer));
  } else {
    await pipeline(
      Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
      // Unix release assets are gzip-compressed single binaries.
      (await import("node:zlib")).createGunzip(),
      createWriteStream(tmpPath),
    );
  }

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
