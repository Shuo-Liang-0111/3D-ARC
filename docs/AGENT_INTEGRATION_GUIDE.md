# ARC Agent 接入指南 / Agent Integration Guide

本文只介绍如何把你自己的 Agent 接入已经部署好的 ARC 网站。ARC 提供游戏环境与 Episode API，不托管你的模型，也不接收你的模型 API Key。

This guide only covers connecting your own agent to an existing ARC website. ARC provides the game environment and Episode API; it does not host your model or receive your model API key.

网页版本 / Web version: `/agent-guide.html`

## 安全边界 / Security boundary

- 模型 API Key 只存在于用户自己的电脑、服务器或 Agent 平台中。
- 不要把模型 Key 放入 ARC 请求、`gameUrl`、提示词、截图、Git 仓库或网页表单。
- `agentToken` 和带 `browser_token` 的 `gameUrl` 是 Episode 临时凭据，同样不应公开分享。

- Keep model API keys only on the user's computer, server, or agent platform.
- Never place a model key in ARC requests, `gameUrl`, prompts, screenshots, Git repositories, or web forms.
- `agentToken` and a `gameUrl` containing `browser_token` are temporary Episode credentials and must not be shared publicly.

## 通用闭环 / Universal loop

1. `POST /api/v1/episodes` 创建 Episode，选择 `level`、`view` 和 `harness`。
2. 在浏览器打开响应中的完整 `gameUrl`。
3. 使用 `agentToken` 获取观察，并发送 `W`、`A`、`S`、`D`、`E`、`TURN_LEFT`、`TURN_RIGHT` 或 `WAIT`。
4. 等待观察中的 `commandId` 与命令 ID 相同，再决定下一动作。
5. 使用 `/memory` 保存里程碑、地标、失败尝试和下一计划。
6. 观察状态为 `WIN` 或 `GAME_OVER` 时停止。

1. Create an Episode with `POST /api/v1/episodes`, selecting `level`, `view`, and `harness`.
2. Open the complete returned `gameUrl` in a browser.
3. Use `agentToken` to read observations and send `W`, `A`, `S`, `D`, `E`, `TURN_LEFT`, `TURN_RIGHT`, or `WAIT`.
4. Wait until the observation `commandId` matches the command ID before choosing the next action.
5. Use `/memory` to persist milestones, landmarks, failed attempts, and the next plan.
6. Stop when the observation status becomes `WIN` or `GAME_OVER`.

## Harness

| Harness | 输入 / Input | 用途 / Use |
| --- | --- | --- |
| `visual` | Screenshot + minimal task data | 纯视觉 Agent / vision-only agents |
| `hybrid` | Screenshot + HUD + position + interaction/debug | 推荐的多模态接入 / recommended multimodal integration |
| `state` | Complete structured state, no screenshot | 纯文本模型、规划器和基线 / text-only models, planners, and baselines |

三种 Harness 使用相同动作空间和游戏规则。公平比较时必须固定 Harness。

All harnesses use the same action space and game rules. Keep the harness fixed for fair comparisons.

`visual` 与 `hybrid` 必须由受管浏览器通过 `window.__ARC_CAPTURE_VIEWPORT__()` 提供原始 viewport PNG，完整保留实际页面中的 canvas、DOM HUD、弹窗和提示。PNG 原样转发，不裁剪、缩放、重新压缩、移除遮挡或重绘 HUD。使用 `managedBrowser=true` 启动这两种模式；仅由人手动打开 `gameUrl` 不会赋予页面自动截图权限或安装截图 hook，仍需受管浏览器。

For `visual` and `hybrid`, use the managed browser's `window.__ARC_CAPTURE_VIEWPORT__()` hook to capture the original viewport as PNG, including the canvas, visible DOM HUD, dialogs, and prompts exactly as rendered. Forward the PNG unchanged: no cropping, resizing, recompression, overlay removal, or HUD redrawing. Start these harnesses with `managedBrowser=true`. Manually opening `gameUrl` alone does not grant a page permission to capture its viewport or install the hook; a managed browser is required.

## 固定环境种子 / Reproducible environment seeds

先读取 `GET /api/v1/seed-capabilities`。`arc-seed-v1` 将每个关卡标为 `seeded`（环境使用受控随机流）或 `fixed`（初态与事件不依赖环境种子）；完整约定见 [环境种子协议](ENVIRONMENT_SEEDS.md)。

`POST /api/v1/episodes` 的可选 `seed` 必须是 `0` 到 `4294967295` 的 JSON 整数。`0` 有效，不表示“未设置”。随机关卡未提供种子时由服务器生成并保存；固定关卡可以记录提供的种子，但 `seedApplied=false`，不会为了种子而随机化原有玩法。创建响应的 `episode.seed` 记录种子；`seedApplied` / `seedVerified` 初始为 `false`，收到合法浏览器验证元数据后才更新。通过 Episode 状态和终局结果的同名字段核对配置与应用状态。

Node.js、Python starter 与 MCP 均支持 `ARC_SEED`。提示词里的 `FIXED_SEED` 只有被运行器转换成环境变量或实际 API 参数时才会起作用：

```bash
FIXED_SEED=42
export ARC_SEED="$FIXED_SEED"
```

MCP `start_episode(seed=42, ...)` 的显式参数优先于 `ARC_SEED`。未设置环境变量时省略 API 的 `seed`；空字符串、负数、小数及超出范围的值会在创建 Episode 前报错。种子属于测评配置元数据；`visual` 的游戏决策输入仍只有截图、公开动作说明和模型自己的记忆，不加入种子或隐藏状态。

Read `/api/v1/seed-capabilities` first. Set `ARC_SEED` to a decimal integer from `0` through `4294967295`, or pass numeric `seed` to MCP `start_episode`. Zero is valid; an explicit MCP argument overrides the environment default. Verify the server's `seed` and `seedApplied` metadata. A fixed level records an explicitly supplied seed without randomizing its gameplay. Putting `FIXED_SEED` in a prompt alone does not configure the environment.

## OpenCode

从 ARC 网站下载：

```bash
mkdir -p arc-agent-kit && cd arc-agent-kit
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-agent-client.mjs"
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-opencode-mcp.mjs"
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-managed-browser.mjs"
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/ARC_AGENT_PROMPT.md"
```

在用户自己的 `opencode.json` 中注册本地 MCP：

```json
{
  "mcp": {
    "arc-game": {
      "type": "local",
      "command": ["node", "/ABSOLUTE/PATH/arc-agent-kit/arc-opencode-mcp.mjs"],
      "enabled": true
    }
  }
}
```

启动 OpenCode 前设置 ARC 地址和用户自己的模型 Provider 环境变量：

```bash
export ARC_AGENT_API_URL="https://your-arc-site.example"
export YOUR_MODEL_API_KEY="stored-in-your-shell-only"
opencode
```

把 `ARC_AGENT_PROMPT.md` 交给 OpenCode。`visual` / `hybrid` 使用 `start_episode(managedBrowser=true)` 启动受管浏览器；`state` 可由用户手动打开返回的 `gameUrl`。浏览器准备好后再继续 `observe` 和 `act`。

Configure any supported model provider in the user's own OpenCode installation. ARC is provider-neutral and does not require Packy or any specific model vendor.

## Python

下载 `/agent-kit/python-agent.py`。Python 客户端使用标准库和 OpenAI Chat Completions 兼容模型端点；`visual` / `hybrid` 另需下述 Node.js 受管浏览器依赖：

```bash
export ARC_AGENT_API_URL="https://your-arc-site.example"
export MODEL_API_URL="https://your-provider.example/v1/chat/completions"
export MODEL_API_KEY="stored-in-your-shell-only"
export MODEL_NAME="your-model-id"
export ARC_HARNESS="state"
python3 python-agent.py
```

The script creates an Episode, starts its managed browser for `visual`/`hybrid` (or prints `gameUrl` for manual opening in `state`), waits for readiness, asks the user's model for one strict action, waits for completion, and checkpoints model-proposed memory.

## Node.js

下载 `/agent-kit/node-agent.mjs`。模型请求使用 Node.js 20+ 内置 `fetch`；`visual` / `hybrid` 另需下述受管浏览器依赖：

```bash
export ARC_AGENT_API_URL="https://your-arc-site.example"
export MODEL_API_URL="https://your-provider.example/v1/chat/completions"
export MODEL_API_KEY="stored-in-your-shell-only"
export MODEL_NAME="your-model-id"
export ARC_HARNESS="hybrid"
node node-agent.mjs
```

The Node.js starter implements the same create, browser-wait, observe, model, act, command-wait, and memory loop as the Python starter.

两种客户端在 `visual` / `hybrid` 模式下自动启动受管浏览器、等待截图 hook 就绪，并在正常退出、异常或 SIGINT/SIGTERM 时关闭浏览器。`state` 保留人工打开模式。先在客户端脚本所在目录下载浏览器模块并安装依赖：

Both clients automatically start the managed browser for `visual`/`hybrid`, wait for its capture hook, and close it on completion, errors, or SIGINT/SIGTERM. `state` retains manual opening. In the directory containing the client scripts, download the browser module and install its dependencies:

```bash
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-managed-browser.mjs"
npm install puppeteer-core
export ARC_CHROMIUM_EXECUTABLE="/absolute/path/to/chromium"
```

需要已安装的 Chromium 或 Chrome。浏览器模块默认从客户端同目录查找，仓库内运行时回退到 `tools/arc-managed-browser.mjs`；可用 `ARC_MANAGED_BROWSER_SCRIPT` 指定绝对路径。Python 可通过 `NODE_BINARY` 指定 Node.js，可用 `ARC_PUPPETEER_ENTRY` 指向其他位置的 Puppeteer 入口。可设 `ARC_HEADLESS=0` 显示窗口。缺少依赖或启动失败时客户端报告基础设施错误，不回退到合成截图。gameUrl 通过 stdin 传给子进程，模型 Key 不进入浏览器子进程环境。

Install Chromium or Chrome first. The browser module is resolved beside the downloaded client, then from the repository's `tools/arc-managed-browser.mjs`; override it with `ARC_MANAGED_BROWSER_SCRIPT`. Python supports `NODE_BINARY`; `ARC_PUPPETEER_ENTRY` can locate Puppeteer elsewhere. Set `ARC_HEADLESS=0` to show the browser. Missing dependencies or startup failures produce an infrastructure error without a synthetic-screenshot fallback. The private game URL travels over stdin, and model keys are excluded from the browser process environment.

Python 和 Node.js 示例均不限制动作步数，持续运行至观察状态为 `WIN` 或 `GAME_OVER`。每步由模型同时选择 `action` 和数值型 `durationMs`（50–1000 毫秒）。回复格式、动作或时长无效时，使用同一观察和记忆重新请求同一模型；通过校验后才发送动作或写入记忆。

Both starters run without an action-count limit until the observation status is `WIN` or `GAME_OVER`. The model chooses both `action` and numeric `durationMs` (50–1000 milliseconds) for each step. Invalid response format, action, or duration triggers a retry with the same model, observation, and memory; commands and memory updates are sent only after validation.

动作语义 / Action meanings:

| Action | 语义 / Meaning |
| --- | --- |
| `W` / `S` | 前进 / 后退；forward / backward |
| `A` / `D` | 左 / 右平移；strafe left / right |
| `TURN_LEFT` / `TURN_RIGHT` | 左 / 右转向；rotate heading left / right |
| `E` | 交互，保留原有 API 语义；interact, preserving legacy API behavior |
| `WAIT` | 不施加输入；apply no input |

`visual` 模式每次只向模型发送当前截图、公开的 `actionDescriptions` 和本进程内保留的模型自写记忆，不发送结构化 HUD、状态、事件或服务端补充的记忆。`status` 和 `commandId` 仅用于客户端停止与命令确认。

In `visual` mode, each model request contains only the current screenshot, published `actionDescriptions`, and model-authored memory retained in the client process. Structured HUD, state, events, and server-added memory are excluded. The client uses `status` and `commandId` only to stop or acknowledge commands.

日志中的 `TIMING model_request` 记录每次模型请求，`TIMING action_ack` 记录发送动作至收到对应观察的耗时，`TIMING step` 记录整步耗时，单位均为毫秒。计时日志不输出截图、凭据或观察内容。GET 与模型请求遇到暂时性故障时按 2、5、10、20、30 秒退避重试，之后报告连接故障。动作 POST 不自动重发：先核对 Episode 状态、活动命令和最新观察；无法确认时停止并报告，避免重复执行。

Timing logs report each model request (`TIMING model_request`), command submission through matching observation (`TIMING action_ack`), and the entire step (`TIMING step`), all in milliseconds without screenshots, credentials, or observation contents. Transient GET/model failures retry after 2, 5, 10, 20, and 30 seconds, then report a connectivity failure. Action POSTs are never blindly replayed: the client checks Episode status, active command, and latest observation, and stops if delivery remains uncertain.

若 Agent 客户端或执行游戏的浏览器运行在 Mac 上，运行期间 Mac 必须保持唤醒且浏览器继续运行；Mac 睡眠会暂停本地执行。仅把模型请求或客户端移到服务器，不能让睡眠中的本地浏览器继续执行游戏。

If the agent client or game browser runs on a Mac, keep the Mac awake and the browser running for the duration of the session. Sleep pauses local execution; moving model requests or the client to a server does not keep a sleeping local game browser running.

## 常见错误 / Common errors

- `waiting_for_browser`: `state` 手动打开完整 `gameUrl`；`visual` / `hybrid` 检查受管浏览器及其依赖。For `state`, open the complete `gameUrl`; for `visual`/`hybrid`, check the managed browser and its dependencies.
- `409 上一个动作尚未完成`: 不要并行动作；等待匹配的 `commandId`. Do not send concurrent actions; wait for the matching `commandId`.
- 没有截图 / no screenshot: 使用 `visual` 或 `hybrid`，并确认模型支持 `image_url`. Use `visual` or `hybrid` and verify `image_url` support.
- MCP 无法连接 / MCP cannot connect: 在启动 OpenCode 前导出 `ARC_AGENT_API_URL`，使用绝对脚本路径，并确认 Node.js 20+. Export `ARC_AGENT_API_URL` before OpenCode, use an absolute script path, and verify Node.js 20+.
