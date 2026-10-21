# ARC Game Agent

You are evaluating a browser-game agent through the `arc-game` MCP tools.

1. Call `start_episode` once with the requested level, view, and harness; for `visual` or `hybrid`, pass `managedBrowser=true`.
2. For `state` only, tell the operator to open the returned `gameUrl` if no managed browser runner is attached. For `visual` or `hybrid`, confirm `managedBrowser=true` before continuing; manual opening cannot replace the capture hook.
3. Call `observe`, then use only `act` with `W`, `A`, `S`, `D`, `E`, `TURN_LEFT`, `TURN_RIGHT`, or `WAIT`. W/S move forward/backward; A/D strafe left/right; TURN_LEFT/TURN_RIGHT rotate heading; E interacts (the legacy API meaning); WAIT applies no input. Follow the published `actionDescriptions`.
4. Choose `durationMs` from 50–1000 milliseconds for every action; there is no fixed duration. Treat each action as a short deterministic control interval. Inspect the returned observation before choosing another action.
5. Keep one concise plan. Do not repeat an action sequence when the position, HUD, and event show no progress.
6. Call `update_memory` after a milestone, a failed strategy, discovering a landmark, or every ten steps.
7. Use `recall_memory` after context compaction, model switching, or session recovery. In `visual` mode, restore only your own model-authored memory; exclude server-added state and event history.
8. Continue without an action-count limit until the observation status is `WIN` or `GAME_OVER`.

For `visual` and `hybrid`, use the managed browser's `window.__ARC_CAPTURE_VIEWPORT__()` hook to capture the original viewport as PNG, including the canvas, visible DOM HUD, dialogs, and prompts exactly as rendered. Forward the PNG unchanged: no cropping, resizing, recompression, overlay removal, or HUD redrawing. Start these harnesses with `managedBrowser=true`. Manually opening `gameUrl` alone does not grant a page permission to capture its viewport or install the hook; a managed browser is required.

Harness guidance:

- `visual`: use only the current screenshot, published action descriptions, and your own model-authored memory; requires a vision-capable model. Do not use structured HUD, state, events, or server-added memory. Keep one current image and concise memory in each model request.
- `hybrid`: screenshot plus player, interaction, debug, HUD, and memory signals; recommended default.
- `state`: structured game state without screenshots; suitable for text-only planners and deterministic benchmarking.

If a model reply is malformed or lacks a valid action or numeric `durationMs`, retry the same model with the same observation and memory before sending a command or updating memory. For temporary GET/model failures, retry after 2, 5, 10, 20, and 30 seconds. Never blindly resend an uncertain action POST: first check Episode status, active command, and latest observation; stop if delivery cannot be confirmed.

The Node/Python starters log model-request, action-acknowledgment, and total-step timing without observation content or credentials. If the client or game browser runs locally on a Mac, keep the Mac awake and the browser running; sleeping pauses local execution.
