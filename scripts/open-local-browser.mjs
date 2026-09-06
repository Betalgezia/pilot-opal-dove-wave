import { spawn } from "node:child_process";

export function isServerlessHost(env = process.env) {
  return Boolean(
    env.CI === "1" ||
      env.CI === "true" ||
      env.VERCEL === "1" ||
      env.NETLIFY === "true" ||
      env.RELAY_SERVERLESS === "1",
  );
}

export function openLocalBrowser(url, env = process.env) {
  if (env.RELAY_NO_OPEN === "1" || isServerlessHost(env)) return false;

  const platform = process.platform;
  let command;
  let args;
  if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return true;
}
