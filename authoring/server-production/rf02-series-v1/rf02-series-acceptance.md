# RF-02 series delivery verification — shared-library-v1

Status: gameplay and technical checks passed; performance target not met; user decision on accepting the performance limitation is pending. This is not an unconditional completed/accepted quality verdict.

## Task and deployed target

- User requested RF-02-2 and RF-02-3 with increasing difficulty, one dynamic falling-book event, no terminal clues or step navigation, and the same scene as RF-02.
- Authorized project: . on the user-selected host 127.0.0.1. Runtime, assets, releases and evidence are beneath /path/to/arc-workspace.
- Fixed playable release: ./authoring/server-production/rf02-series-v1/release, served by Vite preview on port 4192, PID 3974501 at verification.
- URLs: http://127.0.0.1:4192/?level=rf02-2&view=third and http://127.0.0.1:4192/?level=rf02-3&view=third.
- Asset/rule revision: shared-library-v1. Rules: distance-and-deduplicated-reward-v1. Git commit is pending the outstanding performance decision; no push is authorized.
- Existing dev ports and other work were preserved. A fixed release avoids unrelated HMR/build changes resetting browser tests.
- Cardinal credential persistence was explicitly requested and verified with its official private helper; credentials and cost data are excluded here.

## Implemented progression

RF-02 retains its original three-book task and reserve rules. RF-02-2 requires six books, two per color, distributed across the return desk, two reading tables and a return cart. RF-02-3 adds one randomly selected shelf-book fall after the second correct return. The event must finish falling before pickup and must be restored before success. Reset selects a new shelf; there is one event per episode.

All three share the same room, furniture, nine distinct books, support heights and interaction scenery. Added task books are background in the original task. A separate ceiling underside and lamp connections complete the shared structure. Scene layouts, static collision rectangles and shared robot/camera/control files remain consistent. New levels have no directory interaction or step navigation; only the final objective and normal controls/results are displayed.

## Reserve rules and measured routes

Both variants start at 100, capped at 100. First pickup rewards 1; first correct return rewards 2, deduplicated per book/node. Idle and pure rotation are free. Failed/complete states freeze. Failed actions roll back state changes atomically.

| Rule | RF-02-2 | RF-02-3 |
| --- | ---: | ---: |
| Actual movement, points/metre | 0.86 | 0.94 |
| Blocked translation, points/second | 1.05 | 1.25 |
| Empty/wrong/blocked-placement interaction | 3 | 5 |
| Drop/repeat attempt | 1 | 1 |

Engine routes use actual updateMovement and collision checks, grid waypoints with 7 cm added clearance, and no position injection during navigation. Two-error routes inject actual invalid interactions.

| Engine route | Distance m | End reserve | Minimum reserve | End with two errors | Minimum with two errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| RF-02-2 | 96.24 | 35.2336 | 33.2336 | 29.2336 | 27.2336 |
| RF-02-3 red fall | 114.00 | 13.8400 | 10.8400 | 3.8400 | 0.8400 |
| RF-02-3 black fall | 108.96 | 18.5776 | 15.5776 | 8.5776 | 5.5776 |
| RF-02-3 white fall | 96.96 | 29.8576 | 25.5344 | 19.8576 | 15.5344 |

The formal browser runs include real-duration shared control/physics movement, so their trajectories are longer than the engine route planner:

| Browser route, fixed 4192 release | Distance m | End reserve | Minimum reserve | Result |
| --- | ---: | ---: | ---: | --- |
| RF-02-2, 12 successful operations | 108.1479 | 24.9928 | 22.9928 | complete, no failure |
| RF-02-3, black fall, 14 operations | 120.1125 | 8.0942 | 5.0943 | complete, incident restored |

RF-02-3 therefore has limited tolerance for detours. The browser route did not inject two errors; the engine two-error results must not be presented as browser error-tolerance results.

## Assets, geometry and collision

16 runtime assets total 4,774,699 bytes. The manifest records source, fixed-release and HTTP 4192 SHA-256 matches, GLB validity and embedded textures. Thirteen existing RF-02 assets are reused; collision, ceiling connections and impact audio are separate. The single Cardinal impact sound task is aigc_de47994684c44a6d92e4bf0f0af17d06, completed, actual FLAC, no regeneration.

Blender ray measurements located the real support surfaces: reading table 0.6853 m, cart 1.0097 m, return desk task row 0.676–0.680 m. Book bases are 0.686, 1.01 and 0.677/0.681 m respectively. The original return-desk row moved 0.30 m forward to avoid baked-in desk props. Collision GLB contains the 25 authoritative rectangles plus a floor, 26 nodes; browser loading checks collider world bounds within 1 mm. Full engine and browser routes cover empty and carried travel to task stations.

No robot dimensions, bones, camera socket/FOV, movement controls, shared envelopes or kinematics were changed. Nine protected-file baseline hashes match. Original RF-02 engine behavior has 12 passing regression tests.

## Verification and screenshots

- Combined original/new tests: 32/32 passed. Build passed, with the existing large-chunk warning.
- Covered: all random branches, falling/ground/restored phases, six-return success guard, failed early pickup, catalog exclusion, wrong shelf, blocked drop, blocked translation, free idle/turn, low-positive reserve, reward cap, repeat reward prevention, atomic failure, freeze and reset.
- Formal RF-02-2/3 success screenshots and reports are in the task evidence directory. Start, before pickup, carried/removed, returned, falling, ground and recovered snapshots were captured from the actual formal game.
- First/third/dual formal screenshots were visually checked; all use the unchanged shared camera. The built-in control overlay occupies substantial screen area, and the overview makes small books difficult to see; players can use first person and the existing camera controls.
- Evidence source: fixed release 4192, shared-library-v1, 2026-09-19 UTC. Browser reports contain exact operation timestamps and state. Original development-route screenshots are historical visual evidence only, not the final success evidence.
- Main evidence files: rf02-2-browser-report.json, rf02-2-complete.png, rf02-3-browser-report.json, rf02-3-complete.png, rf02-3-falling-black.jpg, rf02-3-landed-black.jpg, rf02-3-first-final.png, rf02-3-third-final.png, rf02-3-dual-final.png.

## Outstanding performance gate and rejected experiment

At 1280 × 680, Apple M3 / ANGLE Metal, after asset readiness, 180-frame samples measured first 17.35 FPS, third 17.92 FPS and dual 16.94 FPS. RF-02 on the same shared scene measured 18.35 FPS; a blank-page control measured 43.35 FPS. A separate unchanged RF-01 comparison measured 13.47 FPS. These measurements do not identify a single proven bottleneck or establish 1080p/30 FPS compliance.

- Manual keyboard smoke test on 4192 passed: F at the empty start location changed RF-02-2 reserve from 100 to 97; R reset it to 100 and displayed the normal reset confirmation.
- The final rebuild passed in 6.77 seconds. RF-02 source/QA modules and runtime asset hashes match the fixed release. Concurrent RF-01 changes caused different RF-01/shared-entry chunk names in the latest general dist; those unrelated changes were not copied over the already tested fixed release.
- The rejected 4193 candidate service was stopped. The 4192 playable release remains active.
A separate shared-library-v2 candidate simplified ten meshes using Blender while retaining textures and source models (asset total 3,628,879 bytes). Formal screenshots remained consistent, but measured performance was 9.23–14.54 FPS rather than a stable improvement. It was not selected. Source was returned using only the task's optimization patch; the already tested v1 release remains the delivery target. Candidate files and diagnostics remain isolated in task artifacts; no model simplification is active in v1.

Performance status: failed-target, not waived as of this record. The requested gameplay is deployed and usable, but the skill's unconditional completion gate remains open until performance is fixed or the user explicitly accepts this known limitation. User acceptance of the gameplay/visual result is not presumed.

## Reproduction and rollback

Run from the authoritative project:
- node --test tests/rf02-*.test.mjs
- npm run build
- node tools/rf02-series/prepare-browser-qa.mjs
- node tools/rf02-series/measure-routes.mjs ./authoring/server-production/rf02-series-v1/routes.json
- node tools/rf02-series/write-manifest.mjs ./authoring/server-production/rf02-series-v1/release http://127.0.0.1:4192
- sha256sum -c ./authoring/server-production/rf02-series-v1/baseline/protected.sha256

Browser QA: /rf02-series-qa.html, performance sampling: /rf02-performance-qa.html. These are review utilities, not player navigation. Preserve the fixed release and baselines before replacing any service; do not reset unrelated working-tree changes. Media/builds/logs/private credentials remain untracked.
