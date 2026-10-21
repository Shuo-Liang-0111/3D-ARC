# RF-01 sorting v3

Status: deployed; task-specific technical, gameplay and visual gates passed. User authorization continues from the approved shared-yard sorting task, including the request to make the line smaller, increase parcel gaps and remove the infeed if useful. All edits, builds, tests and artifacts remain on the selected server under `/path/to/arc-workspace`.

## Changes

- Remove the RF-03 automatic infeed model and its collider. Two 1.4 m belt modules give a 2.8 m line, versus the previous 5.2 m combined infeed/belt footprint. The scanner and belts use uniform 0.7 scale; the previously reduced cages retain 0.85 scale.
- Feed the three original-size parcels at 1.6 m center spacing, leaving at least 1.05 m between adjacent boxes. One or two parcels are on the short belt at once. Uncollected parcels recirculate through the feed queue; queued objects are invisible and cannot be picked up.
- Add a rubber belt surface with moving transverse seams. Its texture offset and parcel positions use the same authoritative conveyor phase and 0.7 m/s speed. Power starts motion; lighting does not gate it. Completion and failure freeze state as before.
- Preserve shared geometry, objects, power/door/light interactions and cleared floor markings across RF-01, RF-01-2 and RF-01-3. Preserve original completion conditions in the first two variants and the final-objective-only HUD.

## Reproduction and validation

The v2 fixed build was replayed through F key events for battery pickup, power connection, shutter and lighting. At a stationary observation point, every parcel moved 0.58261 m between the recorded frames. That run did not reproduce frozen parcels, but the old belt surface was visually static and had no animation code. The user's exact previous URL/state is not yet known, so this report does not claim to have identified every possible cause of their observed freeze.

- Reproduction: `data/recordings/1789810555635-rf01-sorting-v2-qa.json`.
- Task regressions: 54/54 pass, including continuous normal and three-error routes, three-variant parity, queue visibility/pickup, at least 1 m gaps across 20 seconds, collisions, removed-infeed clearance, loaded aisle, power dependency and failure/reset.
- Build: passes. Fixed snapshot: `public/rf01-sorting-build-v3`; 78 compiled files verified byte-for-byte against HTTP. The snapshot contains no Vite HMR client and remains stable during unrelated development edits.
- Asset audit: four reused GLBs, nine instances, 2,372,332 unique asset bytes. Source/runtime/served hashes, dimensions, embedded textures and five belt support rays pass. Measured support is approximately 0.7032 m.
- All ten protected robot/control/camera hashes match the original baseline.
- Full suite: 441 tests, 427 pass, 14 existing unrelated failures. Automatic commit is withheld under the repository verification rule; no push performed.

Evidence and machine-readable measurements are under `./authoring/server-production/rf01-sorting-v3`, including baseline, regression/build/full-suite logs, `asset-audit.json` and `build-snapshot.json`. Original RF-03 and optimized v1 GLBs remain unchanged.

## Deployment

Workspace: `.`. Verified listeners: Vite PID 4146057 on 4173, API PID 2978983 on 127.0.0.1:4176. No credentials recorded.

Formal playable URL: `http://127.0.0.1:4173/rf01-sorting-build-v3/index.html?mode=play&level=rf01-3&view=first`.

Formal browser route: `data/recordings/1789811609683-rf01-sorting-v3-qa.json`. All three parcels sorted, ten interactions, 71.5192 m traveled, final reserve 53.0365 and minimum reserve 50.0365. Supply, shutter, lighting, pickups and deposits use F key events through the actual application handler; navigation uses continuous engine movement and keyboard turning, without teleportation or injected task flags. The complete modal was also inspected in the live browser.

The stationary observation pair advances conveyor phase by 0.60697 m; the on-belt parcel and surface seams visibly move in the inspected first-person screenshots. The preview shows the compact line, removed infeed and larger gaps. Formal pickup, cage placement, first-person and dual-view frames were inspected. Screenshot gallery and state evidence: `http://127.0.0.1:4173/rf01-sorting-evidence/v3/`.

The immediate reset frame precedes MuJoCo pose settling; the gallery uses the supplemental settled start frame from `data/recordings/1789811779175-rf01-sorting-v3-qa.json`. The uninterrupted successful route record remains separate and unchanged.

Observed first-person frame cadence: 32.6 FPS at 1280 × 820, a short rAF sample rather than a 1080p performance guarantee. An earlier v3 browser run timed out during the last automatic turn (`1789811218879-rf01-sorting-v3-qa`); it is retained as an interrupted run. The subsequent single-game-page run completes. No robot or controller code was changed to bypass that timeout.

Normal engine route: 71.285 m, final reserve 49.7150 and minimum 46.7150. Three injected mistakes: final 34.7150 and minimum 31.7150. Budget remains initial/max 100, movement 1/m, blocked movement 2/s, invalid interaction 5, first correct milestone +3. User acceptance is not yet assessed.
