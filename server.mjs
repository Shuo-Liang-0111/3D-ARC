import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { bridgeMujoco } from "./server/mujoco-bridge.mjs";
import { hasModelObservation, modelConfig, requestModelAction } from "./server/model-client.mjs";
import { AgentPlatformStore, createAgentPlatformRouter } from "./server/agent-platform.mjs";

async function loadEnv() {
  try {
    const source = await readFile(new URL("./.env", import.meta.url), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadEnv();

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const recordings = fileURLToPath(new URL("./data/recordings/", import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".mp3": "audio/mpeg" };
const agentPlatform = new AgentPlatformStore({ root: fileURLToPath(new URL("./data/agent-platform/", import.meta.url)) });

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12_000_000) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let file = normalize(join(root, relative));
  if (!file.startsWith(root)) return json(res, 403, { error: "forbidden" });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const routeAgentPlatform = createAgentPlatformRouter({
  store: agentPlatform,
  readBody: body,
  gameBaseUrl: process.env.ARC_GAME_PUBLIC_URL || "http://127.0.0.1:4173/",
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (await routeAgentPlatform(req, res, url)) return;
    if (req.method === "GET" && req.url === "/api/model/config") {
      const config = modelConfig();
      return json(res, 200, { configured: Boolean(config.apiKey && config.model), model: config.model || null });
    }
    if (req.method === "POST" && req.url === "/api/agent/action") {
      const payload = await body(req);
      if (!hasModelObservation(payload)) return json(res, 400, { error: "缺少游戏截图" });
      return json(res, 200, await requestModelAction(payload));
    }
    if (req.method === "POST" && req.url === "/api/recordings") {
      const payload = await body(req);
      const id = `${Date.now()}-${String(payload.level || "unknown").replace(/[^a-z0-9-]/gi, "")}`;
      await mkdir(recordings, { recursive: true });
      await writeFile(join(recordings, `${id}.json`), JSON.stringify({ id, createdAt: new Date().toISOString(), ...payload }, null, 2));
      return json(res, 201, { id });
    }
    await serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message || "server error" });
  }
});

const mujocoClients = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname !== "/api/mujoco/ws") {
    socket.destroy();
    return;
  }
  mujocoClients.handleUpgrade(request, socket, head, (client) => {
    const upstreamUrl = process.env.ARC_MUJOCO_WS_URL || "ws://127.0.0.1:4186/ws";
    bridgeMujoco(client, { upstreamUrl });
  });
});
server.listen(port, host, () => console.log(`ARC 3D server listening on http://${host}:${port}`));
