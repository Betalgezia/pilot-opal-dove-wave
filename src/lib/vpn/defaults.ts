import type { SourceDef } from "./types";

export const DEFAULT_SOURCES: SourceDef[] = [
  {
    id: "bypass-1",
    name: "bypass-1",
    url: "https://raw.githubusercontent.com/whoahaow/rjsxrd/refs/heads/main/githubmirror/bypass/bypass-1.txt",
    enabled: true,
  },
  {
    id: "black-mobile",
    name: "black-mobile",
    url: "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/BLACK_VLESS_RUS_mobile.txt",
    enabled: true,
  },
  {
    id: "goida-26",
    name: "goida-26",
    url: "https://raw.githubusercontent.com/AvenCores/goida-vpn-configs/main/githubmirror/26.txt",
    enabled: true,
  },
];

export const STORAGE_KEY = "relay.sources.v1";
export const SETTINGS_KEY = "relay.settings.v1";
