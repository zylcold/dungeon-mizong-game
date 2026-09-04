import { readFileSync, readdirSync, lstatSync } from "node:fs";
import path from "node:path";
import { parse } from "acorn";
import { unzipSync } from "fflate";
import { DIST, RUNTIME_FILES, isMain } from "./paths.mjs";

const MiB = 1024 * 1024;
const expected = RUNTIME_FILES.slice().sort();

function exactFiles(names) {
  if (JSON.stringify(names.slice().sort()) !== JSON.stringify(expected)) {
    throw new Error(`运行包必须且只能包含：${expected.join(", ")}；实际：${names.join(", ")}`);
  }
}

function relativeResource(url, file) {
  if (!url || url.startsWith("#")) return;
  if (/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(url) || url.includes("..")) {
    throw new Error(`${file} 引用了非包内相对资源：${url}`);
  }
  if (!expected.includes(url.replace(/^\.\//, ""))) throw new Error(`${file} 缺少资源：${url}`);
}

// 此检查针对本项目的封闭资源清单，不代替 skill 中的手工端能力/真机检查。
export function checkContents(files) {
  exactFiles(Object.keys(files));
  const html = Buffer.from(files["index.html"]).toString("utf8");
  const css = Buffer.from(files["styles.css"]).toString("utf8");
  const js = Buffer.from(files["game.js"]).toString("utf8");
  if (!/^<!doctype html>/i.test(html.trim()) || !/lang="zh-CN"/.test(html)
    || !/charset="UTF-8"/i.test(html) || !html.includes("viewport-fit=cover")) {
    throw new Error("HTML 入口缺少文档声明、语言、字符集或安全区 viewport");
  }
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (scripts.length !== 1 || !/^\s*src="\.\/game\.js"\s*$/.test(scripts[0][1]) || scripts[0][2].trim()) {
    throw new Error("只允许一个包内外置经典脚本，禁止模块脚本和内联脚本");
  }
  if (/<(?:iframe|object|base)\b|\bon\w+\s*=|javascript:|\bdownload\s*(?:=|>)|target\s*=\s*["']_blank|http-equiv\s*=\s*["']Content-Security-Policy/i.test(html)) {
    throw new Error("HTML 使用了容器不支持的嵌入、脚本或跳转能力");
  }
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) relativeResource(match[1], "index.html");
  for (const match of css.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/gi)) relativeResource(match[1], "styles.css");
  if (/@import\b/i.test(css)) throw new Error("运行 CSS 不得保留外部导入");
  if (/\.svg\b/i.test(html + css + js)) throw new Error("本项目不使用 SVG 素材");
  parse(js, { ecmaVersion: 2017, sourceType: "script" });
  const prohibited = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|Worker|SharedWorker|WebAssembly|eval|Function|serviceWorker|geolocation|clipboard|PaymentRequest|DeviceMotionEvent|DeviceOrientationEvent|Accelerometer|Gyroscope|Magnetometer)\b|\b(?:window\.)?(?:open|prompt)\s*\(|\.(?:requestFullscreen|webkitRequestFullscreen|replaceAll|at|matchAll)\s*\(|\b(?:structuredClone|Object\.hasOwn|Promise\.allSettled)\s*\(|https?:\/\//;
  if (prohibited.test(js)) throw new Error(`运行 JS 包含需审查的能力：${js.match(prohibited)[0]}`);
  const png = Buffer.from(files["assets/sprites-atlas.png"]);
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("PNG 图集损坏");
  const textBytes = Buffer.byteLength(html + css + js);
  const warnings = [];
  if (textBytes > 5 * MiB) warnings.push("解压后文本总量超过 5 MiB，需人工检查");
  for (const name of ["index.html", "styles.css", "game.js"]) {
    if (files[name].byteLength > 2 * MiB) warnings.push(`${name} 超过 2 MiB，需人工检查`);
  }
  return { files: expected.length, scriptTarget: "ES2017 / Chrome 61", textBytes, warnings };
}

export function readDirectory(directory) {
  if (lstatSync(directory).isSymbolicLink()) throw new Error("运行目录不能是符号链接");
  const result = {};
  function visit(folder, prefix = "") {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`运行包不能包含符号链接：${name}`);
      if (entry.isDirectory()) visit(path.join(folder, entry.name), name + "/");
      else result[name] = readFileSync(path.join(folder, entry.name));
    }
  }
  visit(directory);
  return result;
}

export function checkDirectory(directory = DIST) {
  return checkContents(readDirectory(directory));
}

export function checkZipBuffer(bytes, referenceFiles) {
  if (bytes.byteLength > 10 * MiB) throw new Error("ZIP 超过小红书 10 MiB 上限");
  const names = new Set();
  let totalSize = 0;
  const files = unzipSync(bytes, { filter(file) {
    if (!expected.includes(file.name) || names.has(file.name)) throw new Error(`ZIP 包含未知/重复条目：${file.name}`);
    names.add(file.name);
    totalSize += file.originalSize;
    if (totalSize > 32 * MiB) throw new Error("ZIP 解压后过大，停止处理");
    return true;
  } });
  const report = checkContents(files);
  if (referenceFiles) {
    for (const name of expected) {
      if (!Buffer.from(files[name]).equals(Buffer.from(referenceFiles[name]))) throw new Error(`ZIP 与已测试构建不一致：${name}`);
    }
  }
  if (bytes.byteLength > 2 * MiB) report.warnings.push("ZIP 超过建议的 2 MiB");
  return { ...report, zipBytes: bytes.byteLength };
}

if (isMain(import.meta.url)) {
  const target = path.resolve(process.argv[2] || DIST);
  const report = target.endsWith(".zip")
    ? checkZipBuffer(readFileSync(target), readDirectory(DIST))
    : checkDirectory(target);
  console.log(JSON.stringify(report, null, 2));
}
