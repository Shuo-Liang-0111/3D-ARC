# ARC Agent Evaluation Platform V1

ARC exposes a vendor-neutral environment protocol so OpenCode, custom Python or Node agents, LangChain, AutoGen, and hosted runners can play the same levels under comparable rules.

OpenCode is an optional client adapter, not the platform runtime. User model API keys stay in the user's agent process and are never sent to or stored by ARC.

## Architecture

```text
Agent or Harness
  -> ARC Episode HTTP API
  -> isolated browser game URL
  -> window.__ARC_AGENT__
  -> deterministic game simulation

Episode storage
  -> SQLite session, command, memory, and observation index
  -> JPEG/PNG/WebP frames
  -> JSONL trajectory
```

Runtime data is stored under `data/agent-platform/`, which is ignored by Git.

## Episode lifecycle

Create an Episode:

```bash
curl -X POST http://127.0.0.1:4176/api/v1/episodes \
  -H 'content-type: application/json' \
  -d '{"level":"rf01","view":"dual","harness":"hybrid"}'
```

The response contains:

- `episode`: public status and persistent memory;
- `agentToken`: bearer token used by the agent;
- `gameUrl`: browser execution URL containing a separate browser token.

Open `gameUrl`. The browser registers its initial observation and begins polling commands.

Read the latest observation:

```bash
curl http://127.0.0.1:4176/api/v1/episodes/EPISODE_ID/observations/latest \
  -H 'authorization: Bearer AGENT_TOKEN'
```

Execute one action:

```bash
curl -X POST http://127.0.0.1:4176/api/v1/episodes/EPISODE_ID/commands \
  -H 'authorization: Bearer AGENT_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"kind":"act","action":"W","durationMs":300}'
```

The agent waits until `observations/latest.commandId` equals the returned command ID. Only one pending command is accepted per Episode. The model chooses numeric `durationMs` from 50–1000 milliseconds for each action; `300` above is an example, not a fixed duration. There is no action-count limit; terminate gameplay only when the observation status is `WIN` or `GAME_OVER`.

Other command kinds are `observe` and `reset`.

## Harnesses

For `visual` and `hybrid`, use the managed browser's `window.__ARC_CAPTURE_VIEWPORT__()` hook to capture the original viewport as PNG, including the canvas, visible DOM HUD, dialogs, and prompts exactly as rendered. Forward the PNG unchanged: no cropping, resizing, recompression, overlay removal, or HUD redrawing. Start these harnesses with `managedBrowser=true`. Manually opening `gameUrl` alone does not grant a page permission to capture its viewport or install the hook; a managed browser is required.

| Harness | Screenshot | Structured state | Intended use |
| --- | --- | --- | --- |
| `visual` | yes | none supplied to the model | vision-agent evaluation |
| `hybrid` | yes | player, HUD, interaction, debug | practical multimodal agents |
| `state` | no | complete serializable state | text planners and deterministic baselines |

All Harnesses use the same action set: `W`, `A`, `S`, `D`, `E`, `TURN_LEFT`, `TURN_RIGHT`, `WAIT`. W/S move forward/backward; A/D strafe left/right; TURN_LEFT/TURN_RIGHT rotate heading; E interacts (preserving the legacy API meaning); WAIT applies no input. Follow the published `actionDescriptions`.

In `visual` mode, use only the current screenshot, published action descriptions, and your own model-authored memory. Do not use position, structured state, HUD fields, events, or server-added memory. Use `status` and `commandId` only for termination and command acknowledgment.

## Long-term memory

ARC automatically checkpoints the step, latest action, latest event, result, and twenty recent events. Agents can merge semantic memory through:

```bash
curl -X PATCH http://127.0.0.1:4176/api/v1/episodes/EPISODE_ID/memory \
  -H 'authorization: Bearer AGENT_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"completed":["picked up battery"],"nextPlan":"find the power slot"}'
```

This memory survives model changes, context compaction, and agent restarts as long as the Episode credentials are retained. For `visual` runs, `update_memory` and `recall_memory` may preserve only model-authored notes for model input; do not forward server-generated checkpoints, structured state, or event history to the model.

## OpenCode adapter

1. Copy `integrations/opencode/opencode.json.example` to `opencode.json`.
2. Export `PACKY_API_KEY` in the OpenCode environment. Never write it into the repository.
3. Start OpenCode in the ARC directory.
4. Select a Packy model with `/models`.
5. Use the instructions in `integrations/opencode/ARC_AGENT_PROMPT.md`.

Vision and tool-call support vary by model. Use `state` Harness for models without image input. Use `hybrid` or `visual` only with a vision-capable model.

## Public website boundaries

V1 provides Episode isolation and separate agent/browser tokens. A public deployment still needs an authenticated control plane, per-user quotas, rate limits, browser-container isolation, token expiry, abuse controls, and a worker queue. Those belong in the future website runner rather than the game simulation.
