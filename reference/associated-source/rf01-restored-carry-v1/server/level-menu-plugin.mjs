import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { getLevelMenu, synchronizeLevelMenu } from "./level-menu.mjs";

export function createLevelMenuPlugin() {
  let root;
  const synchronize = (html) => synchronizeLevelMenu(html, readFileSync(resolve(root, "index.html"), "utf8"));
  return {
    name: "unified-level-menu",
    configResolved(config) { root = config.root; },
    api: { synchronize },
    transformIndexHtml: { order: "post", handler: synchronize },
    configureServer(server) {
      // Public release HTML bypasses Vite's transformIndexHtml hook.
      server.middlewares.use((req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method)) return next();
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
        catch { return next(); }
        if (pathname === "/" || pathname === "/index.html") return next();
        const publicRoot = resolve(root, "public");
        let file = resolve(publicRoot, "." + pathname);
        if (!file.startsWith(publicRoot + sep)) return next();
        if (pathname.endsWith("/")) {
          file = resolve(file, existsSync(resolve(file, "index.html")) ? "index.html" : "index.htm");
        }
        if (!/\.html?$/.test(file) || !statSync(file, { throwIfNoEntry: false })?.isFile()) return next();
        const html = readFileSync(file, "utf8");
        if (!getLevelMenu(html)) return next();
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(req.method === "HEAD" ? undefined : synchronize(html));
      });
    },
  };
}
