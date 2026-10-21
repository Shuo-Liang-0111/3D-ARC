import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const runtimeAssetDirectories = [
  "cardinal/rf01/audio",
  "cardinal/rf01/collision",
  "cardinal/rf01/models/runtime",
  "cardinal/rf01/textures/generated",
  "embodiedgen/rf01/models/runtime",
  "polyhaven/rf01",
  "cardinal/rf02/models/runtime",
  "cardinal/rf03/models/runtime",
  "cardinal/rf04/models/runtime",
  "cardinal/rf04/textures",
  "levels/rf04/series-v1",
  "levels/rf04/architecture-v3",
  "cardinal/rf05/models/runtime",
  "cardinal/rf05/textures/source",
  "levels/rf12",
  "levels/rf13/realism-v0.4.3",
  "levels/rf14/realism-v0.4.8",
  "levels/rf15/realism-v0.4.3",
  "levels/rf15/tool-room-v1",
  "levels/rf15/cardinal-field-v2",
  "levels/rf15/browser-physics-v1",
  "cardinal/rf12-v2/models/runtime",
  "cardinal/rf12-v2/textures",
  "embodiedgen/rf02/models/runtime",
  "embodiedgen/rf03/models/runtime",
  "embodiedgen/rf04/models/runtime",
  "embodiedgen/rf05/models/runtime",
  "embodiedgen/rf06/models/runtime",
  "cardinal/rf06/runtime",
  "levels/rf06/series-v1",
  "levels/rf06/pest-v2",
  "levels/rf06/home-v5",
  "levels/rf06/tools-v1",
  "embodiedgen/rf07/models/runtime",
  "cardinal/rf07/models/runtime",
  "cardinal/rf07/textures/runtime",
  "levels/rf07/series-v1",
  "gaussian/rf10",
  "unitree/g1",
  "unitree/g1-29dof-dex1-official.glb",
  "unitree/unitree-r1-official-mujoco.glb",
];

const agentKitFiles = [
  "public/agent-kit/index.html",
  "public/agent-kit/python-agent.py",
  "public/agent-kit/node-agent.mjs",
  "public/agent-kit/ARC_AGENT_PROMPT.md",
  "tools/arc-agent-client.mjs",
  "tools/arc-opencode-mcp.mjs",
];
const agentKitToolFiles = new Map([
  ["/agent-kit/arc-agent-client.mjs", "tools/arc-agent-client.mjs"],
  ["/agent-kit/arc-opencode-mcp.mjs", "tools/arc-opencode-mcp.mjs"],
]);

export default defineConfig(({ command }) => ({
  base: "./",
  publicDir: command === "build" ? false : "public",
  plugins: [
    {
      name: "copy-runtime-assets",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requestUrl = new URL(req.url, "http://localhost");
          const stableRF07 = ['rf07', 'rf07-2', 'rf07-3'].includes(requestUrl.searchParams.get('level')) && requestUrl.searchParams.get('mode') === 'play' && ['/', '/index.html'].includes(requestUrl.pathname);
          if (stableRF07) {
            const release = 'rf07-series-v1-r2', entry = resolve('public', release, 'index.html');
            if (!existsSync(entry)) { res.statusCode = 503; res.end('RF-07 release unavailable'); return; }
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.setHeader('x-arc-release', release);
            res.end(readFileSync(entry, 'utf8').replaceAll('./assets/', '/' + release + '/assets/')); return;
          }
          const stableRF06 = ["rf06", "rf06-2", "rf06-3"].includes(requestUrl.searchParams.get("level")) && requestUrl.searchParams.get("mode") === "play" && ["/", "/index.html"].includes(requestUrl.pathname);
          const rf06Candidate = requestUrl.pathname.match(/^\/(rf06-series-v1-r\d+)\/(?:index.html)?$/);
          if (rf06Candidate || stableRF06) {
            const release = rf06Candidate?.[1] ?? "rf06-series-v1-r11", entry = resolve("public", release, "index.html");
            if (!existsSync(entry)) { res.statusCode = 404; res.end("RF-06 release unavailable"); return; }
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.setHeader("x-arc-release", release);
            res.end(readFileSync(entry, "utf8").replaceAll("./assets/", "/" + release + "/assets/")); return;
          }
          const stableRF01 = ["rf01", "rf01-2", "rf01-3"].includes(requestUrl.searchParams.get("level"))
            && requestUrl.searchParams.get("mode") === "play"
            && ["/", "/index.html"].includes(requestUrl.pathname);
          if (stableRF01) {
            const release = "rf01-sorting-build-v4-navigation-v1";
            const releaseIndex = resolve("public", release, "index.html");
            if (!existsSync(releaseIndex)) {
              res.statusCode = 503;
              res.end("RF-01 release unavailable");
              return;
            }
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.setHeader("x-arc-release", "rf01-sorting-v4-navigation-v1");
            res.end(readFileSync(releaseIndex, "utf8").replaceAll("./assets/", "/" + release + "/assets/"));
            return;
          }
          const sourcePath = agentKitToolFiles.get(req.url?.split("?")[0]);
          if (!sourcePath) return next();
          res.setHeader("content-type", "text/javascript; charset=utf-8");
          res.end(readFileSync(resolve(sourcePath)));
        });
      },
      closeBundle() {
        cpSync(resolve('public/office-scan'), resolve('dist/office-scan'), { recursive: true });
        for (const relativePath of runtimeAssetDirectories) {
          const source = resolve("public/local-assets", relativePath);
          const target = resolve("dist/local-assets", relativePath);
          if (!existsSync(source)) continue;
          mkdirSync(dirname(target), { recursive: true });
          cpSync(source, target, { recursive: true });
        }
        cpSync(resolve("public/vendor/draco"), resolve("dist/vendor/draco"), { recursive: true });
        const kitTarget = resolve("dist/agent-kit");
        mkdirSync(kitTarget, { recursive: true });
        for (const sourcePath of agentKitFiles) {
          const source = resolve(sourcePath);
          cpSync(source, resolve(kitTarget, basename(source)));
        }
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@sparkjsdev/spark", "three", "three-mesh-bvh"],
  },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:4176", ws: true },
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        game: resolve("index.html"),
        r1View: resolve("r1-view.html"),
        g1Edu2: resolve("g1-edu2.html"),
        agentGuide: resolve("agent-guide.html"),
        rf12Preview: resolve("rf12-preview.html"),
        rf13Preview: resolve("rf13-preview.html"),
        rf13Assets: resolve("rf13-assets.html"),
        rf14Preview: resolve("rf14-preview.html"),
        rf15Preview: resolve("rf15-preview.html"),
      },
    },
  },
}));
