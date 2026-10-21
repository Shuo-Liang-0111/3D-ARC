# RF-06 shared apartment realism — r11

Status: verified and deployed; user acceptance not yet recorded.
Release: `rf06-series-v1-r11`. Environment assets: `home-v5`. Shared layout revision: `rf06-home-v3`. Flat mop: `tools-v1`.
Authoritative workspace: `.`; production records: `./authoring/server-production/rf06-home-v3`.
Server and deployment scope are the current user's explicit selection. No remote Git push.

## Scope and resulting scene

The user's latest request is to correct the apartment layout and object appearance, integrate the shutoff into plausible plumbing, make water emerge from the faucet, and allow overflow to reach the living room. This iteration uses Blender 4.5.3 for exact room geometry and furniture; existing Cardinal wall/floor textures, insecticide and bucket are reused.

All three RF-06 levels load the same apartment, furniture, colliders and tool locations. The kitchen has actual recessed sink geometry, a gooseneck faucet/aerator, copper supply, braided hose, waste trap and a compact shutoff below the sink. An open service bay makes the shutoff accessible. The refrigerator faces the usable kitchen aisle. Countertop, cabinet fronts, handles, oven and hood form one fitted kitchen. The living room groups the sofa and coffee table facing the television; four dining chairs face their table. The utility room has a washer below its worktop, supported shelves, a bucket tray and a dimensioned aluminium/microfiber flat mop.

The faucet jet falls into the basin; the full basin spills over its front lip in a tapering animated sheet. Floor water expands through connected floor cells and the kitchen doorway, respecting walls and cabinet footprints. Closing the supply stops volume growth; the remaining visual trickle fades over 12 seconds. This is a game water-coverage and surface animation model, not CFD.

## Preserved gameplay and robot contract

- RF-06 retains its fixed initial 3 L coverage.
- RF-06-2 grows until the supply is shut off; delayed intervention allows water to cross the kitchen doorway into the living area.
- RF-06-3 remains two small cockroaches and insecticide. Cockroaches travel at twice G1 normal forward speed, choose headings with the accepted 80/20 semicircle distribution, and die on a hit. One action is a 0.18-second burst. No old capacity/dumping gameplay is reinstated.
- Ceiling geometry is visible in first-person and hidden in third-person.
- Robot source, controls, original RF-06 engine/scene and base level file hashes match the task's starting baseline. No robot geometry, skeleton, shared camera/FOV or input mapping was changed.

## Verification

`node --test tests/rf06*.test.mjs`: 31 passed, 0 failed.
`node tools/rf06-series/build.mjs rf06-series-v1-r11`: passed.
Blender round-trip measurement: 29 exported collider footprints match the authoritative layout within 5 mm; apartment visual mesh has 103,214 triangles.
Movement tests exercise wall approach, doorway passage while carrying the bucket, and shelf blocking in all three variants.
Source / release / served HTTP bytes match for all seven mandatory shared asset files; hashes are in the accompanying asset manifest.

The actual r11 browser ran the normal controller and animation sequence for wrench pickup, shutoff, wrench return, bucket pickup/placement, mop pickup/cleaning/return. Final state: water 0, valve closed, bucket placed, tools returned, complete true. Pickup/placement contacts were within 2.5 cm. Mop operational samples include the deliberate lateral sweep and are recorded separately from grasp contact. RF-06-3 also passed normal can pickup and two live 0.18-second sprays, yielding two dead cockroaches and completion. Observed browser performance was about 60 fps on the inspection machine, not a hardware-wide benchmark.

These checks use robot-only QA stations and normal local alignment/interaction animations. They do not certify autonomous navigation or a full route/budget run. The flood screenshot advances the authoritative environment by 180 simulated seconds; it is not a claim of 180 seconds of real-time waiting.

All mandatory models and collision assets load. The only HTTP error observed during screenshots is the unrelated missing `/favicon.ico`; no mandatory scene asset failed. The legacy HUD `environmentMapLoaded=false` refers to an external HDR load; this scene uses an in-memory reflection map.

## Current evidence

Server directory: `./authoring/server-production/rf06-home-v3/evidence/`.

- `third-formal.png`: unaltered third-person game UI.
- `third-clear.png`: third-person apartment with side panels hidden for inspection.
- `kitchen-first.png`: normal first-person camera, faucet/sink/overflow/plumbing; side panels hidden.
- `flood-to-living.png`: connected spread through the doorway after 180 simulated environment seconds.
- `browser.json`, `http-errors.json`: current r11 scene state and load result.
- `actions-r11.json`, `pest-actions-r11.json`: actual browser action results.
- Parent directory: `tests.tap`, `measurements.json`, `asset-verification.json`, `build-r11.log`.

Scene screenshots use the shared production camera; only panels are hidden in the indicated images. No offline beauty render replaces game evidence.

## Reproduction

Run from the authoritative project. Export `{LEVEL,HOME}` from `game/levels/rf06/home-layout.js` to the production record `layout.json` before building the apartment. Run `tools/rf06-series/build-home-v3.py -- home-v5` with the authorized Blender binary, and `tools/rf06-series/build-mop.py -- <new-output-path>/mop.glb` for the mop. Always use a new candidate directory when revising assets. `measure-home.py` verifies the exported home-v5 files. `home-evidence.mjs` captures the exact r11 release.

Stable play entry: http://127.0.0.1:4173/?mode=play&level=rf06-2&view=third
Explicit release: http://127.0.0.1:4173/rf06-series-v1-r11/?mode=play&level=rf06-2&view=third
