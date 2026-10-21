# RF-07 series acceptance — 2026-09-21

Stage: completed. Gameplay revision `rf07-series-v1`; deployed bundle `rf07-series-v1-r2`.

Scope: user-confirmed easy cold-cabinet toggling, existing medium cold-chain flow, and hard flow plus exactly one random container/device leak during the first 180 seconds. Hidden 120-second deadline, timeout failure. F drops existing hand cargo before response. First-person ceiling, third-person open roof, common scene.

## Evidence

Production record and all evidence: `./authoring/server-production/rf07-series-v1`.

- `tests-final.log`: 27/27 existing and new RF-07 unit tests passed. Random start, toggles, completion dependencies, wrong-order recovery, reward de-duplication, alarm deadlines, floor retrieval, reset, collision and open-door clearance.
- `build-final.log`: Vite production build passed; existing large-chunk warning remains.
- `release-inspection.log`: real F animations switch an active cabinet off and turn all cabinets on, then recover to standing and complete.
- `release-sample.log`: sample pickup, ground placement, re-pickup and case loading; cooling plate pickup and ground placement.
- `release-container.log`: leaking container pickup and supported placement into the sink-side tray. Resolution commits on placement, then normal task remains available.
- `qa-device.log`: actual switch contact shuts down the failed equipment and clears the alarm.
- `release-case.log`: front handle pickup, floor placement, retrieval, opening the cabinet and delivery; final state waits for recovery.
- `release-alarm.log` and `evidence/alarm-boundaries.json`: alarm interrupts an in-progress normal pickup; deadline fixture expires in actual browser time; failure overlay says leakage was not handled; no countdown number/progress displayed; restart clears incident and cargo.
- `evidence/first-ceiling.png`, `third-open-roof.png`, `device-alarm.png`, contact screenshots: actual production WebGL render, reviewed. Ceiling and ceiling lights toggle together. Floating packing-zone sign moved onto the island face.
- `evidence/views-collision.json`: local motion against cabinet, north equipment bank and sink tray stops before visible obstacles. A test labeled `wall` checks the north equipment-bank boundary, not the exterior wall.
- `online-check.json`: all three normal public entry points report `rf07-series-v1-r2`, all required assets ready, no page errors, no QA entry enabled. External host HTTP checks return 200 with the same release header.
- `frozen-files.json`: robot, G1 EDU2 and shared controls match the pre-task byte snapshots.
- `asset-verification.json`: 21 observed/required runtime assets, including Draco worker dependencies, copied into the release and hash-matched against served bytes.

## Rework performed

Tray placement moved toward its reachable inner edge without moving the table. Case got an accessible front handle instead of changing robot reach or shared camera. Existing metal surfaces receive neutral reflections. Sealed-case sample meshes are hidden to prevent contents penetrating the lid. Refrigerator door separated from the existing Cardinal skin using Blender; original GLB preserved.

## Boundaries

Tests use internal state fixtures and teleported stations followed by formal F actions and short movement checks. They are not a full player route, pure-vision navigation, reserve-budget calibration, rigid-body grasp or force-control validation. No robot model, skeleton, socket, camera algorithm/FOV or shared control changes. Hardware-browser frame-rate sample is specific to the server H20.

No user acceptance is claimed. Assets, credentials, environment, logs and generated screenshots are excluded from Git. Source commit is task-scoped; unrelated pre-existing modifications remain in the worktree. No push.
