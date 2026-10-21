# RF-01 sorting v1 — acceptance and continuation

Task authorized on 2026-09-19. Server-only workspace `.`, deployed through the existing `http://127.0.0.1:4173` application. Revision `rf01-sorting-v1`; no new Cardinal requests. Credentials are not recorded.

Current phase: deployed; functional and visual review passed at the tested configuration. Optional user acceptance: not_requested. The 1080p performance target is not certified; measured configuration and dual-view limitation are recorded below.

## Completed checks

- Related baseline: 45 tests passed before edits. Current RF-01/RF-03 regression: 52 tests passed, including the new complete sorting route, three injected mistakes, reward deduplication, depletion rollback/freeze/reset, ground parcel collisions, pickup clearance, passive MuJoCo movement accounting and ±0.12 rad / ±0.1 m aisle drift.
- Full suite: 440 tests, 426 passed, 14 failed. The same 14 failures were reproduced against isolated pre-task source. Failures concern managed-browser arguments, RF-04 rewards, legacy RF-09/10/robot/control/registration source assertions and pre-existing RF-01 asset/collision source assertions. No unrelated fixes were attempted. Automatic commit is withheld under the repository rule because the full check is not green.
- Asset audit: five Cardinal GLBs reused and simplified into immutable candidates, 3,141,156 bytes total, 443,722 visible instance triangles instead of 1,491,490; valid GLB 2, original embedded textures, decoded bounds and runtime/HTTP byte equality. Original source hashes and optimized runtime hashes are recorded separately. Files and script under `production/rf01-sorting-v1/asset-audit.json` and `tools/rf01-sorting-audit.mjs`.
- Belt support measured with rays at five lateral positions: world y≈0.987424; parcels use y=0.9875. Cages have explicit y=0.35 support decks, matched to the original chassis.
- Final build passed; all five optimized GLB runtime, built and served hashes match (`deployment-audit.json`).
- Ten robot, locomotion, control and view files retain their initial SHA-256 values. Application-entry edits are RF-01-3's final objective text and passing passive-motion accounting metadata to the RF-01 budget; controller mappings, movement vectors and camera algorithms are unchanged.
- Shared preview inspected: unchanged workshop shell/lighting, original-scale infeed, DWS scanner, two 2 m belts, three marked cages, three labeled parcels, clear east control aisle. Preview uses the same scene and HDR/lighting, with inspection cameras only in the preview.

## Rework observed in the actual browser

1. The old RF-03 belt-height parameter intersected this model's actual belt. Fixed from decoded geometry, not visual guesswork.
2. The first loaded aisle route failed under MuJoCo yaw/position drift. The layout and route were adjusted, then tested with yaw/position perturbations. The final actual-browser route completed successfully.
3. Cages rotated to put the loading side toward the operation aisle; collision bounds follow the rotation, and labels mount above the opening. Delivery uses a 1.8 m center-distance threshold; belt pickups use 1.75 m.

4. The browser QA's long side-steps accumulated heading drift into equipment. QA now navigates continuous 0.25 m segments and settles turning within the measured tolerance; it does not teleport, weaken collisions or supply task state.
5. Existing RF-01 billing charged passive physics motion as movement/wall attempts. The shared budget now distinguishes real translation commands from passive MuJoCo movement. A separate test preserves normal charge behavior when a caller sets `drain:false`.
6. Belt/ground pickup range is 1.75 m; pickup is rejected if the resulting carried envelope would already overlap an obstacle. Cage range is 1.8 m, and the carried aisle is centered at z=-4.1 m.
7. Final QA corrects position after turning, verifies the carried parcel before continuing, and opens the shutter from a station aligned with the doorway. This avoids wasting the ten-second open window on a long lateral approach. Door timing and robot controls remain unchanged.

## Evidence and resumption

- Baseline hashes/current dirty state: `./authoring/server-production/rf01-sorting-v1/baseline`.
- Preserved pre-task fixture: `baseline-fixture`; baseline failures: `baseline-failures.log`.
- Latest focused regression: `regression.log`; broad suite: `full-tests-final.log`; build: `build-final.log`.
- Formal QA: `/rf01-sorting-qa.html`. Runs the production iframe through actual navigation/interactions and captures first/third views. The Save button writes to the existing `/api/recordings` endpoint under the server workspace.
- Diagnostic preview: `/rf01-sorting-preview.html`.
- Successful production-browser record: `data/recordings/1789806711299-rf01-sorting-v1-qa.json`, captured 2026-09-19 08:25:55–08:31:50 UTC. Public evidence: `/rf01-sorting-evidence/`; full trace and twelve screenshots under `/rf01-sorting-evidence/1789806711299/`. Actual navigation and interactions, no teleport or task-state injection.
- Browser result: all three parcels sorted, power/lights/entry true, complete true, failed false, ten interactions; distance 72.7555 m, final reserve 53.6793, minimum 50.6793. Reset subsequently verified: reserve 100, power/lights/entry false, parcels on conveyor, rewards cleared.
- All three formal entries report `requiredAssetsReady=true` and `revision=rf01-sorting-v1`; RF-01 reports all 31 Cardinal assets loaded. Scene/object/interaction parity is additionally covered by the shared-engine regression. Reset evidence is retained at `/rf01-sorting-evidence/1789806711299/reset.json` and `reset-first.png`.
- First-person line, held parcels, correct delivery and completion images and dual-view start were inspected. The images retain existing workshop materials and show supported parcels and reachable equipment. Protected robot/camera/control files remain byte-identical.
- Observed first-person cadence at 1280 × 820: approximately 31–46 FPS, saved completion sample 37.3 FPS. Dual view approximately 23 FPS. Desktop 1080p/30 FPS remains unverified; do not claim a universal performance pass.
