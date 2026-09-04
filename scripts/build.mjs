import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { ROOT, DIST, isMain } from "./paths.mjs";
import { checkDirectory } from "./check-artifact.mjs";

// 源码采用 ES Modules；容器只接收合并后的经典 IIFE 脚本。
export async function buildGame(outdir = DIST) {
  mkdirSync(path.join(outdir, "assets"), { recursive: true });
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: ["src/main.js"],
    outfile: path.join(outdir, "game.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2017", "chrome61"],
    splitting: false,
    sourcemap: false,
    charset: "utf8",
    legalComments: "none",
    minify: false,
    metafile: true,
    logLevel: "silent"
  });
  if (Object.values(result.metafile.outputs).some(output => output.imports.length)) {
    throw new Error("运行脚本不得依赖外部模块或额外代码分块");
  }
  copyFileSync(path.join(ROOT, "public/index.html"), path.join(outdir, "index.html"));
  // 不压缩或重排 CSS，保留 Chrome 61 基线声明和增强规则的原始层叠顺序。
  copyFileSync(path.join(ROOT, "src/styles.css"), path.join(outdir, "styles.css"));
  copyFileSync(path.join(ROOT, "assets/sprites-atlas.png"), path.join(outdir, "assets/sprites-atlas.png"));
  return checkDirectory(outdir);
}

if (isMain(import.meta.url)) {
  console.log(JSON.stringify(await buildGame(), null, 2));
}
