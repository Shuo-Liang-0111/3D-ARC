#!/usr/bin/env node
import { createInterface } from "node:readline";
import { ArcAgentClient } from "./arc-agent-client.mjs";
import { ManagedEpisodeBrowser } from "./arc-managed-browser.mjs";

const client = new ArcAgentClient();
const managedBrowser = new ManagedEpisodeBrowser();
let currentEpisode = null;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const tools = [
  {
    name: "start_episode",
    description: "创建一个隔离的 ARC 游戏 Episode。打开返回的 gameUrl 后再调用 observe 或 act。",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["rf01", "rf02", "rf03", "rf04", "rf05", "rf06", "rf07", "rf08", "rf09", "rf10", "rf10", "test_zpf2"], default: "rf01" },
        view: { type: "string", enum: ["first", "third", "dual"], default: "dual" },
        harness: { type: "string", enum: ["visual", "hybrid", "state"], default: "visual" },
        managedBrowser: { type: "boolean", description: "自动启动专属无头浏览器并打开游戏页面。" },
      },
    },
  },
  { name: "get_status", description: "读取当前 Episode 状态、步数和记忆摘要。", inputSchema: { type: "object", properties: {} } },
  { name: "observe", description: "读取游戏观察。fresh=true 会要求浏览器生成一个新观察。", inputSchema: { type: "object", properties: { fresh: { type: "boolean", default: false } } } },
  {
    name: "act",
    description: "执行一个确定性游戏动作并返回动作后的观察。",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["W", "A", "S", "D", "E", "WAIT"] },
        durationMs: { type: "number", minimum: 50, maximum: 1000, default: 300 },
      },
    },
  },
  { name: "reset", description: "重置当前 Episode 并返回初始观察。", inputSchema: { type: "object", properties: {} } },
  { name: "recall_memory", description: "读取当前 Episode 的持久化结构化记忆。", inputSchema: { type: "object", properties: {} } },
  {
    name: "update_memory",
    description: "合并更新目标、已完成事项、地标、失败尝试和下一计划等长期记忆。",
    inputSchema: { type: "object", required: ["memory"], properties: { memory: { type: "object", additionalProperties: true } } },
  },
];

function shouldManageBrowser(args) {
  if (typeof args.managedBrowser === "boolean") return args.managedBrowser;
  return process.env.ARC_MANAGED_BROWSER === "1";
}

function requireEpisode() {
  if (!currentEpisode) throw new Error("请先调用 start_episode");
  return currentEpisode;
}

function observationContent(observation) {
  const copy = structuredClone(observation);
  const screenshot = copy.screenshot;
  delete copy.screenshot;
  const content = [{ type: "text", text: JSON.stringify(copy, null, 2) }];
  if (screenshot) {
    const match = screenshot.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (match) content.push({ type: "image", mimeType: match[1], data: match[2] });
  }
  return content;
}

async function callTool(name, args = {}) {
  if (name === "start_episode") {
    await managedBrowser.close();
    const created = await client.createEpisode(args);
    currentEpisode = { id: created.episode.id, agentToken: created.agentToken };
    const browserManaged = shouldManageBrowser(args);
    if (browserManaged) {
      try {
        await managedBrowser.open(created.gameUrl);
      } catch (error) {
        currentEpisode = null;
        await managedBrowser.close();
        throw new Error(`自动浏览器启动失败：${error.message}`);
      }
    }
    return [{
      type: "text",
      text: JSON.stringify({ episode: created.episode, gameUrl: created.gameUrl, managedBrowser: browserManaged }, null, 2),
    }];
  }
  const episode = requireEpisode();
  if (name === "get_status") return [{ type: "text", text: JSON.stringify(await client.status(episode.id, episode.agentToken), null, 2) }];
  if (name === "observe") return observationContent(await client.observe(episode.id, episode.agentToken, {
    fresh: Boolean(args.fresh),
    timeoutMs: Number(process.env.ARC_BROWSER_OBSERVATION_TIMEOUT_MS || 120_000),
  }));
  if (name === "act") return observationContent(await client.act(episode.id, episode.agentToken, args.action, { durationMs: args.durationMs || 300 }));
  if (name === "reset") return observationContent(await client.reset(episode.id, episode.agentToken));
  if (name === "recall_memory") return [{ type: "text", text: JSON.stringify(await client.memory(episode.id, episode.agentToken), null, 2) }];
  if (name === "update_memory") return [{ type: "text", text: JSON.stringify(await client.updateMemory(episode.id, episode.agentToken, args.memory), null, 2) }];
  throw new Error(`未知工具：${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line);
    if (request.method === "notifications/initialized") return;
    if (request.method === "initialize") {
      send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: request.params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "arc-agent-harness", version: "1.0.0" } } });
      return;
    }
    if (request.method === "tools/list") {
      send({ jsonrpc: "2.0", id: request.id, result: { tools } });
      return;
    }
    if (request.method === "tools/call") {
      const content = await callTool(request.params?.name, request.params?.arguments || {});
      send({ jsonrpc: "2.0", id: request.id, result: { content, isError: false } });
      return;
    }
    if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } });
  } catch (error) {
    if (request?.id !== undefined) send({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: error.message }], isError: true } });
  }
});

async function shutdown(exitCode) {
  await managedBrowser.close();
  process.exit(exitCode);
}

process.once("SIGINT", () => {
  void shutdown(130);
});
process.once("SIGTERM", () => {
  void shutdown(143);
});
lines.once("close", () => {
  void managedBrowser.close();
});

export { callTool, observationContent, tools };
