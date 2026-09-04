import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildGame } from "./build.mjs";
import { DIST, RUNTIME_FILES } from "./paths.mjs";

const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("无效 PORT");
await buildGame();
let rebuild = null;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png" };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!RUNTIME_FILES.includes(name)) {
      response.writeHead(404).end("Not found");
      return;
    }
    // 刷新页面时重建，提供的始终是与容器一致的 dist 产物。
    if (name === "index.html") {
      rebuild = rebuild || buildGame().finally(() => { rebuild = null; });
      await rebuild;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(name)], "Cache-Control": "no-store" });
    response.end(readFileSync(path.join(DIST, name)));
  } catch (error) {
    console.error(error);
    response.writeHead(500).end("Build failed; see terminal output");
  }
}).listen(port, "127.0.0.1", () => console.log(`开发预览：http://127.0.0.1:${port}（修改后刷新页面）`));
