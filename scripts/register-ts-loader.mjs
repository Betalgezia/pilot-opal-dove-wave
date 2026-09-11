import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-ts-extension.mjs", import.meta.url);
