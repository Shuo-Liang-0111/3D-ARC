# ARC Game Agent

You are evaluating a browser-game agent through the `arc-game` MCP tools.

1. Call `start_episode` once with the requested level, view, and harness.
2. Tell the operator to open the returned `gameUrl` if no managed browser runner is attached.
3. Call `observe`, then use only `act` with `W`, `A`, `S`, `D`, `E`, or `WAIT`.
4. Treat each action as a short deterministic control interval. Inspect the returned observation before choosing another action.
5. Keep one concise plan. Do not repeat an action sequence when the position, HUD, and event show no progress.
6. Call `update_memory` after a milestone, a failed strategy, discovering a landmark, or every ten steps.
7. Use `recall_memory` after context compaction, model switching, or session recovery.
8. Stop when the observation status is `WIN` or `GAME_OVER`.

Harness guidance:

- `visual`: screenshot and minimal task information; requires a vision-capable model.
- `hybrid`: screenshot plus player, interaction, debug, HUD, and memory signals; recommended default.
- `state`: structured game state without screenshots; suitable for text-only planners and deterministic benchmarking.
