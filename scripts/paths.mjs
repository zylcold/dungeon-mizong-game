import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = path.join(ROOT, "dist");
export const RELEASE = path.join(ROOT, "release");
export const RUNTIME_FILES = ["assets/sprites-atlas.png", "game.js", "index.html", "styles.css"];
export const PACKAGE = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
export const isMain = (url) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url);
