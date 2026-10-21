# ARC Autonomous Play

Start immediately. Do not ask the operator questions and do not ask them to open a URL.

1. Use only the `arc-game` MCP tools for the game. Do not use shell or browser tools.
2. Call `start_episode` exactly once with the settings appended to this prompt and `managedBrowser=true`.
3. Confirm the result reports `managedBrowser=true`, then call `observe` and begin playing.
4. After each observation, choose exactly one `act` action from `W`, `A`, `S`, `D`, `E`, `TURN_LEFT`, `TURN_RIGHT`, or `WAIT`. W/S move forward/backward; A/D strafe left/right; TURN_LEFT/TURN_RIGHT rotate heading; E interacts (preserving the legacy API meaning); WAIT applies no input. Follow the published `actionDescriptions`.
5. Choose numeric `durationMs` from 50–1000 milliseconds for each action based on the observation and plan; no fixed duration is imposed. Treat each action as a short deterministic interval and inspect the returned observation before the next action.
6. Maintain one concise plan. If the evidence allowed by the selected harness shows no progress (screenshot changes in `visual` mode), change the plan instead of repeating the same sequence.
7. Call `update_memory` with only your own model-authored notes after every milestone, failed strategy, discovered landmark, and at least every ten steps.
8. Call `recall_memory` after context compaction, model switching, or session recovery; in `visual` mode restore only your own model-authored notes and exclude server-added state and event history.
9. If a tool times out, call `get_status` once and continue from the latest observation without creating another Episode.
10. Continue autonomously without an action-count limit; terminate gameplay only when the observation status is `WIN` or `GAME_OVER`.
11. At the end, report the Episode ID, result, step count, completed milestones, failed strategies, and final plan.

In `visual` mode, use only the current screenshot, published action descriptions, and your own model-authored memory. Do not use position, structured state, HUD fields, events, or server-added memory. Use `status` and `commandId` only for termination and command acknowledgment.

For `visual` and `hybrid`, use the managed browser's `window.__ARC_CAPTURE_VIEWPORT__()` hook to capture the original viewport as PNG, including the canvas, visible DOM HUD, dialogs, and prompts exactly as rendered. Forward the PNG unchanged: no cropping, resizing, recompression, overlay removal, or HUD redrawing. Start these harnesses with `managedBrowser=true`. Manually opening `gameUrl` alone does not grant a page permission to capture its viewport or install the hook; a managed browser is required.

The managed browser is the only browser for this Episode. Never open, duplicate, refresh, or replace its `gameUrl`.
