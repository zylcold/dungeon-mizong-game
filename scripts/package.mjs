import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { zipSync } from "fflate";
import { ROOT, DIST, RELEASE, PACKAGE, RUNTIME_FILES, isMain } from "./paths.mjs";
import { checkContents, checkZipBuffer, readDirectory } from "./check-artifact.mjs";

export function archiveRuntime(files) {
  checkContents(files);
  const entries = {};
  for (const name of RUNTIME_FILES) {
    // 固定归档时间与顺序：同一源码/锁文件可以重复构建出同一 ZIP。
    entries[name] = [files[name], { mtime: new Date(2000, 0, 1), level: 9 }];
  }
  const zip = zipSync(entries, { level: 9 });
  checkZipBuffer(zip, files);
  return zip;
}

export function packageGame() {
  const version = PACKAGE.version;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("无效版本号");
  if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== `v${version}`) {
    throw new Error(`Release 标签必须与 package.json 一致：v${version}`);
  }
  const files = readDirectory(DIST);
  const bytes = archiveRuntime(files);
  mkdirSync(RELEASE, { recursive: true });
  const filename = `dungeon-mizong-minitool-${version}.zip`;
  const target = path.join(RELEASE, filename);
  writeFileSync(target, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(`${target}.sha256`, `${sha256}  ${filename}\n`);
  const audit = path.join(ROOT, ".codex/skills/minitool-zip-builder/scripts/audit_artifact.mjs");
  for (const file of [DIST, target]) {
    const result = spawnSync(process.execPath, [audit, file], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`小红书技能审计失败：${file}`);
  }
  return { file: filename, sha256, ...checkZipBuffer(bytes, files) };
}

if (isMain(import.meta.url)) console.log(JSON.stringify(packageGame(), null, 2));
