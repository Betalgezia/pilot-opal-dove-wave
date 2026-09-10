import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

function say(message) {
  process.stdout.write(`[relay] ${message}\n`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code ?? "?"}`));
    });
  });
}

function portBusy(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(true));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(false));
    });
  });
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  say(`Need Node.js 20+, got ${process.version}`);
  process.exit(1);
}

if (!existsSync(path.join(root, "package.json"))) {
  say(`package.json not found in ${root}`);
  process.exit(1);
}

say(`project: ${root}`);

if (!existsSync(path.join(root, "node_modules"))) {
  say("installing dependencies (first run)...");
  try {
    await run("npm", ["install"]);
  } catch (err) {
    say(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (await portBusy(8080)) {
  say("port 8080 is already in use");
  say("open http://localhost:8080 if Relay is already running");
  process.exit(1);
}

if (process.platform === "win32") {
  say(`mihomo dir: ${process.env.LOCALAPPDATA || ""}\\Relay`);
  say("if Defender quarantines mihomo.exe, add that folder to exclusions");
}

say("starting http://localhost:8080");
try {
  await run("npx", ["vite", "dev", "--host", "0.0.0.0", "--port", "8080"]);
} catch (err) {
  say(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
