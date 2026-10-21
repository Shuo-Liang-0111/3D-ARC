#!/usr/bin/env node
import { createInterface } from "node:readline";
import { ArcAgentClient } from "./arc-agent-client.mjs";
import { ManagedEpisodeBrowser } from "./arc-managed-browser.mjs";

const client = new ArcAgentClient();
const managedBrowser = new ManagedEpisodeBrowser();
let currentEpisode = null;
const environmentSeed = seedFromEnvironment(process.env.ARC_SEED);
const VISUAL_MEMORY_KEY = "arcVisualAgentMemoryV1";
const VISUAL_EPISODE_FIELDS = ["id", "level", "view", "harness", "engine", "seed", "seedSource", "seedPolicy", "seedApplied", "seedVerified", "initialStateFingerprint", "status", "stepCount", "createdAt", "updatedAt", "lastSeenAt"];
const VISUAL_COMMAND_FIELDS = ["id", "kind", "status", "dispatchedAt", "dispatchCount", "createdAt"];

function seedFromEnvironment(value) {
  if (value === undefined) return undefined;
  const seed = Number(value);
  if (!/^[0-9]+$/.test(value) || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error("ARC_SEED must be an integer from 0 through 4294967295.");
  }
  return seed;
}

function pickFields(value, fields) {
  return Object.fromEntries(fields.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]));
}

function visualEpisodeStatus(value) {
  const result = pickFields(value, VISUAL_EPISODE_FIELDS);
  if (value?.activeCommand !== undefined) result.activeCommand = value.activeCommand ? pickFields(value.activeCommand, VISUAL_COMMAND_FIELDS) : null;
  return result;
}

function visualOwnMemory(memory) {
  const own = memory?.[VISUAL_MEMORY_KEY];
  return own && typeof own === "object" && !Array.isArray(own) ? structuredClone(own) : {};
}

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
        seed: { type: "integer", minimum: 0, maximum: 4294967295, description: "环境随机种子；省略时使用 ARC_SEED，未设置则由服务端按关卡能力决定。0 是有效种子。" },
      },
    },
  },
  { name: "get_status", description: "读取当前 Episode 和命令状态。visual 模式不返回裁判数据或自动记忆。", inputSchema: { type: "object", properties: {} } },
  { name: "observe", description: "读取游戏观察。fresh=true 会要求浏览器生成一个新观察。", inputSchema: { type: "object", properties: { fresh: { type: "boolean", default: false } } } },
  {
    name: "act",
    description: "执行动作并返回观察：W/S 前后，A/D 左右平移，TURN_LEFT/TURN_RIGHT 左右转向，E 互动，WAIT 等待。",
    inputSchema: {
      type: "object",
      required: ["action", "durationMs"],
      properties: {
        action: { type: "string", enum: ["W", "A", "S", "D", "E", "WAIT", "TURN_LEFT", "TURN_RIGHT"] },
        durationMs: { type: "number", minimum: 50, maximum: 1000, description: "由模型依据当前画面选择动作持续时间（毫秒）。" },
      },
    },
  },
  { name: "reset", description: "重置当前 Episode 并返回初始观察。", inputSchema: { type: "object", properties: {} } },
  { name: "recall_memory", description: "读取当前 Episode 的持久化记忆；visual 模式只返回模型自己写入的记忆。", inputSchema: { type: "object", properties: {} } },
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

function observationContent(observation, harness = currentEpisode?.harness || observation.harness) {
  const copy = structuredClone(observation);
  const screenshot = copy.screenshot;
  delete copy.screenshot;
  const visual = harness === "visual";
  const visible = visual
    ? Object.fromEntries(["protocolVersion", "level", "view", "harness", "ready", "status", "availableActions", "actionDescriptions", "commandId", "step"].filter((key) => copy[key] !== undefined).map((key) => [key, copy[key]]))
    : copy;
  if (visual) visible.harness = harness;
  const content = [{ type: "text", text: JSON.stringify(visible, null, 2) }];
  if (screenshot) {
    const match = screenshot.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (match) content.push({ type: "image", mimeType: match[1], data: match[2] });
  }
  return content;
}

async function callTool(name, args = {}) {
  if (name === "start_episode") {
    const seed = args.seed === undefined ? environmentSeed : args.seed;
    if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)) {
      throw new Error("seed must be an integer from 0 through 4294967295.");
    }
    await managedBrowser.close();
    const created = await client.createEpisode({ ...args, ...(seed === undefined ? {} : { seed }) });
    const episode = { id: created.episode.id, agentToken: created.agentToken, harness: args.harness || created.episode.harness || "visual" };
    currentEpisode = episode;
    const browserManaged = shouldManageBrowser(args);
    if (browserManaged) {
      try {
        await managedBrowser.open(created.gameUrl);
      } catch (error) {
        if (currentEpisode === episode) currentEpisode = null;
        await managedBrowser.close();
        throw new Error(`自动浏览器启动失败：${error.message}`);
      }
    }
    return [{
      type: "text",
      text: JSON.stringify({ episode: episode.harness === "visual" ? visualEpisodeStatus(created.episode) : created.episode, gameUrl: created.gameUrl, managedBrowser: browserManaged }, null, 2),
    }];
  }
  const episode = requireEpisode();
  if (name === "get_status") {
    const status = await client.status(episode.id, episode.agentToken);
    return [{ type: "text", text: JSON.stringify(episode.harness === "visual" ? visualEpisodeStatus(status) : status, null, 2) }];
  }
  if (name === "observe") return observationContent(await client.observe(episode.id, episode.agentToken, {
    fresh: Boolean(args.fresh),
    timeoutMs: Number(process.env.ARC_BROWSER_OBSERVATION_TIMEOUT_MS || 120_000),
  }), episode.harness);
  if (name === "act") {
    const actions = tools.find((tool) => tool.name === "act").inputSchema.properties.action.enum;
    if (!actions.includes(args.action) || typeof args.durationMs !== "number" || !Number.isFinite(args.durationMs) || args.durationMs < 50 || args.durationMs > 1000) {
      throw new Error("需要有效动作及模型选择的 durationMs（50–1000 毫秒）。");
    }
    return observationContent(await client.act(episode.id, episode.agentToken, args.action, { durationMs: args.durationMs }), episode.harness);
  }
  if (name === "reset") return observationContent(await client.reset(episode.id, episode.agentToken), episode.harness);
  if (name === "recall_memory") {
    const memory = await client.memory(episode.id, episode.agentToken);
    return [{ type: "text", text: JSON.stringify(episode.harness === "visual" ? visualOwnMemory(memory) : memory, null, 2) }];
  }
  if (name === "update_memory") {
    if (!args.memory || typeof args.memory !== "object" || Array.isArray(args.memory)) throw new Error("记忆更新必须是对象");
    if (episode.harness === "visual") {
      const memory = { ...visualOwnMemory(await client.memory(episode.id, episode.agentToken)), ...structuredClone(args.memory) };
      await client.updateMemory(episode.id, episode.agentToken, { [VISUAL_MEMORY_KEY]: memory });
      return [{ type: "text", text: JSON.stringify(memory, null, 2) }];
    }
    return [{ type: "text", text: JSON.stringify(await client.updateMemory(episode.id, episode.agentToken, args.memory), null, 2) }];
  }
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
