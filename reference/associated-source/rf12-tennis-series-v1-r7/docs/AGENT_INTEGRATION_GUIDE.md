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
3. 使用 `agentToken` 获取观察，并发送 `W`、`A`、`S`、`D`、`E` 或 `WAIT`。
4. 等待观察中的 `commandId` 与命令 ID 相同，再决定下一动作。
5. 使用 `/memory` 保存里程碑、地标、失败尝试和下一计划。
6. 观察状态为 `WIN` 或 `GAME_OVER` 时停止。

1. Create an Episode with `POST /api/v1/episodes`, selecting `level`, `view`, and `harness`.
2. Open the complete returned `gameUrl` in a browser.
3. Use `agentToken` to read observations and send `W`, `A`, `S`, `D`, `E`, or `WAIT`.
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

## OpenCode

从 ARC 网站下载：

```bash
mkdir -p arc-agent-kit && cd arc-agent-kit
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-agent-client.mjs"
curl -fsSLO "$ARC_AGENT_API_URL/agent-kit/arc-opencode-mcp.mjs"
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

把 `ARC_AGENT_PROMPT.md` 交给 OpenCode。OpenCode 调用 `start_episode` 后，用户需要打开返回的 `gameUrl`，然后 Agent 才能继续 `observe` 和 `act`。

Configure any supported model provider in the user's own OpenCode installation. ARC is provider-neutral and does not require Packy or any specific model vendor.

## Python

下载 `/agent-kit/python-agent.py`。示例只使用 Python 3 标准库，并使用 OpenAI Chat Completions 兼容模型端点：

```bash
export ARC_AGENT_API_URL="https://your-arc-site.example"
export MODEL_API_URL="https://your-provider.example/v1/chat/completions"
export MODEL_API_KEY="stored-in-your-shell-only"
export MODEL_NAME="your-model-id"
export ARC_HARNESS="state"
python3 python-agent.py
```

The script creates an Episode, prints `gameUrl`, waits for the browser, asks the user's model for one strict action, waits for completion, and checkpoints model-proposed memory.

## Node.js

下载 `/agent-kit/node-agent.mjs`。示例使用 Node.js 20+ 内置 `fetch`，不需要第三方包：

```bash
export ARC_AGENT_API_URL="https://your-arc-site.example"
export MODEL_API_URL="https://your-provider.example/v1/chat/completions"
export MODEL_API_KEY="stored-in-your-shell-only"
export MODEL_NAME="your-model-id"
export ARC_HARNESS="hybrid"
node node-agent.mjs
```

The Node.js starter implements the same create, browser-wait, observe, model, act, command-wait, and memory loop as the Python starter.

## 常见错误 / Common errors

- `waiting_for_browser`: 打开完整 `gameUrl` 并等待资源加载。Open the complete `gameUrl` and wait for assets.
- `409 上一个动作尚未完成`: 不要并行动作；等待匹配的 `commandId`. Do not send concurrent actions; wait for the matching `commandId`.
- 没有截图 / no screenshot: 使用 `visual` 或 `hybrid`，并确认模型支持 `image_url`. Use `visual` or `hybrid` and verify `image_url` support.
- MCP 无法连接 / MCP cannot connect: 在启动 OpenCode 前导出 `ARC_AGENT_API_URL`，使用绝对脚本路径，并确认 Node.js 20+. Export `ARC_AGENT_API_URL` before OpenCode, use an absolute script path, and verify Node.js 20+.
