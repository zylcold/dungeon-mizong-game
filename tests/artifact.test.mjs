import test from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { DIST } from "../scripts/paths.mjs";
import { readDirectory, checkContents, checkZipBuffer } from "../scripts/check-artifact.mjs";
import { archiveRuntime } from "../scripts/package.mjs";

const files = readDirectory(DIST);

test("构建产物可重复打包，ZIP 文件与已测试目录逐字节一致", () => {
  const first = archiveRuntime(files);
  assert.deepEqual(first, archiveRuntime(files));
  const report = checkZipBuffer(first, files);
  assert.equal(report.files, 4);
  assert.deepEqual(report.warnings, []);
  assert.ok(report.zipBytes < 2 * 1024 * 1024);
});

test("拒绝源码包、多包一层目录及遗漏素材", () => {
  assert.throws(() => checkContents({ ...files, "AGENTS.md": Buffer.from("source") }), /必须且只能/);
  const wrapped = Object.fromEntries(Object.entries(files).map(([name, data]) => ["dist/" + name, data]));
  assert.throws(() => checkZipBuffer(zipSync(wrapped)), /未知/);
  const { "assets/sprites-atlas.png": omitted, ...missing } = files;
  assert.throws(() => checkContents(missing), /必须且只能/);
});

test("拒绝模块脚本、内联脚本、外链与超出 ES2017 的语法", () => {
  const html = files["index.html"].toString("utf8");
  for (const replacement of [
    '<script type="module" src="./game.js"></script>',
    '<script>window.bad = true;</script>',
    '<script src="https://example.com/game.js"></script>'
  ]) {
    assert.throws(() => checkContents({ ...files, "index.html": Buffer.from(html.replace(/<script\b[\s\S]*?<\/script>/, replacement)) }));
  }
  for (const js of ['fetch("/data")', 'new Worker("./game.js")', 'const x = value?.nested;']) {
    assert.throws(() => checkContents({ ...files, "game.js": Buffer.from(js) }));
  }
});

test("拒绝 ZIP 与已测试产物不一致及超过 10 MiB", () => {
  const changed = { ...files, "styles.css": Buffer.from(files["styles.css"].toString() + "\n/* changed */") };
  assert.throws(() => checkZipBuffer(zipSync(changed), files), /不一致/);
  assert.throws(() => checkZipBuffer(new Uint8Array(10 * 1024 * 1024 + 1)), /上限/);
});
