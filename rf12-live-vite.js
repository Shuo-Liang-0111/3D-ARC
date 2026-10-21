import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const runtimeAssetDirectories = [
  "cardinal/rf01/audio",
  "cardinal/rf01/models/runtime",
  "cardinal/rf01/textures/generated",
  "embodiedgen/rf01/models/runtime",
  "polyhaven/rf01",
  "cardinal/rf02/models/runtime",
  "cardinal/rf03/models/runtime",
  "cardinal/rf05/models/runtime",
  "cardinal/rf05/textures/source",
  "levels/rf12",
  "cardinal/rf12-v2/models/runtime",
  "cardinal/rf12-v2/textures",
  "embodiedgen/rf02/models/runtime",
  "embodiedgen/rf03/models/runtime",
  "embodiedgen/rf04/models/runtime",
  "embodiedgen/rf05/models/runtime",
  "embodiedgen/rf06/models/runtime",
  "embodiedgen/rf07/models/runtime",
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
      "/api": "http://127.0.0.1:4176",
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
      },
    },
  },
}));
