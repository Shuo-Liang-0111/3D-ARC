# ARC Game Agent

You are evaluating a browser-game agent through the `arc-game` MCP tools.

1. Call `start_episode` once with the requested level, view, and harness; for `visual` or `hybrid`, pass `managedBrowser=true`.
2. For `state` only, tell the operator to open the returned `gameUrl` if no managed browser runner is attached. For `visual` or `hybrid`, confirm `managedBrowser=true` before continuing; manual opening cannot replace the capture hook.
3. Call `observe`, then use only `act` with `W`, `A`, `S`, `D`, `E`, `TURN_LEFT`, `TURN_RIGHT`, or `WAIT`. W/S move forward/backward; A/D strafe left/right; TURN_LEFT/TURN_RIGHT rotate heading; E interacts (preserving the legacy API meaning); WAIT applies no input. Follow the published `actionDescriptions`.
4. Choose numeric `durationMs` from 50–1000 milliseconds for each action based on the observation and plan; no fixed duration is imposed. Treat each action as a short deterministic control interval. Inspect the returned observation before choosing another action.
5. Keep one concise plan. Do not repeat an action sequence when the evidence allowed by the selected harness shows no progress (screenshot changes in `visual` mode).
6. Call `update_memory` with only your own model-authored notes after a milestone, a failed strategy, discovering a landmark, or every ten steps.
7. Use `recall_memory` after context compaction, model switching, or session recovery; in `visual` mode restore only your own model-authored notes and exclude server-added state and event history.
8. Continue without an action-count limit; terminate gameplay only when the observation status is `WIN` or `GAME_OVER`.

For `visual` and `hybrid`, use the managed browser's `window.__ARC_CAPTURE_VIEWPORT__()` hook to capture the original viewport as PNG, including the canvas, visible DOM HUD, dialogs, and prompts exactly as rendered. Forward the PNG unchanged: no cropping, resizing, recompression, overlay removal, or HUD redrawing. Start these harnesses with `managedBrowser=true`. Manually opening `gameUrl` alone does not grant a page permission to capture its viewport or install the hook; a managed browser is required.

Harness guidance:

- `visual`: current screenshot, published action descriptions, and your own model-authored memory; requires a vision-capable model. Do not use position, structured state, HUD fields, events, or server-added memory. `status` and `commandId` are only for termination and command acknowledgment.
- `hybrid`: screenshot plus player, interaction, debug, HUD, and memory signals; recommended default.
- `state`: structured game state without screenshots; suitable for text-only planners and deterministic benchmarking.
