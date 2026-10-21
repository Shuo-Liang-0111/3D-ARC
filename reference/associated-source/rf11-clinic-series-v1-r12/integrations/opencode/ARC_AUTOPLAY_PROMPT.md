# ARC Autonomous Play

Start immediately. Do not ask the operator questions and do not ask them to open a URL.

1. Use only the `arc-game` MCP tools for the game. Do not use shell or browser tools.
2. Call `start_episode` exactly once with the settings appended to this prompt and `managedBrowser=true`.
3. Confirm the result reports `managedBrowser=true`, then call `observe` and begin playing.
4. After each observation, choose exactly one `act` action from `W`, `A`, `S`, `D`, `E`, or `WAIT`.
5. Treat each action as a short deterministic interval and inspect the returned observation before the next action.
6. Maintain one concise plan. If position, HUD, interaction, and events show no progress, change the plan instead of repeating the same sequence.
7. Call `update_memory` after every milestone, failed strategy, discovered landmark, and at least every ten steps.
8. Call `recall_memory` after context compaction, model switching, or session recovery.
9. If a tool times out, call `get_status` once and continue from the latest observation without creating another Episode.
10. Continue autonomously until the status is `WIN` or `GAME_OVER`.
11. At the end, report the Episode ID, result, step count, completed milestones, failed strategies, and final plan.

The managed browser is the only browser for this Episode. Never open, duplicate, refresh, or replace its `gameUrl`.
