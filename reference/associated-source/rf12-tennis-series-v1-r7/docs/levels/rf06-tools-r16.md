# RF-06-2 dispersed tools and wrench grip — r16

Status: verified and deployed. User acceptance remains unrecorded.
Release: `rf06-series-v1-r16`; shared environment asset: `home-v7`.
Task records: `./authoring/server-production/rf06-tools-v2`.
The user's current server/project authorization is unchanged.

## Requested behavior

RF-06-2's wrench starts on the repair case supported by the entry bench (4.22, 0.825, -2.70), the bucket starts on the hall floor outside the kitchen (-0.62, 0.03, 2.90), and the mop hangs on the utility-room wall (4.98, 0.03, 2.22). Tools are separated by over 4 metres; pickup and return use this level's actual locations and support heights.

All three levels retain the shared apartment and furniture. RF-06 and RF-06-3 retain their existing wrench and bucket starts. The shared mop is moved against its wall board, and the floating oversized hoop shown in the user's screenshot is replaced with a compact wall plate, support and spring clip. A small closed repair case on the entry bench supports the RF-06-2 wrench at a reachable height.

## Wrench interaction

The normalized wrench is 0.32 m long. Its handle grip is measured at local (0.035, 0.020, 0), replacing the old centre/height-only attachment. On contact, the controller preserves the tool's resting orientation and records its transform relative to the actual wrist; subsequent motion follows the wrist rather than robot yaw alone. The right hand grips the handle, with the jaw forward/up in the inspected carry pose.

The jaw, at local (-0.123, 0.020, 0), is the valve interaction effector. The normal arm solver positions and rotates the wrench around this point while preserving the grip. Returning the wrench reuses its valid pickup stance and restores its supported resting orientation. All of this is level interaction animation; no robot mesh, skeleton, default pose, camera/FOV or controls were edited.

## Validation

- 35 relevant tests passed: fixed/growing water, pest rules, local collision approaches, variant-specific tool homes/returns, wrist-relative grip and jaw pivot.
- r16 production build passed.
- 29 exported collider footprints round-trip correctly within the existing 5 mm tolerance. Shared visual mesh: 105,062 triangles.
- Source/build/HTTP bytes match for home-v7 home, collision and valve GLBs, and the unchanged wrench GLB.
- Normal browser animations passed wrench pickup, valve operation, return to case, bucket pickup/placement, mop pickup/cleaning/return. Final complete=true, water=0, tools returned. Valve jaw error at commit: 0.39 mm; all grasp/release contacts under 25 mm.
- Actual first-person carry and post-shutoff screenshots were inspected in the task's CUA tool record. Static scene images are in `evidence/spread-third.png`, `supported-wrench-first.png`, and `mop-clip-first.png`. Side panels were hidden for those static inspection images, using the normal production camera.
- Evidence uses robot-only test stations followed by actual approach and animation. This is not a full navigation or resource-budget certification. Mop sweep samples are operation offsets, not grasp alignment errors.

Protected robot, input controls, shared scene/camera and original RF-06 engine/scene match the starting hashes. An independent concurrent change to game/app.js was detected; this task did not edit or stage it.

Evidence: `tests.tap`, `build-r16.log`, `measurements.json`, `assets.json`, and `evidence/actions-r16.json`.
Stable entry: http://127.0.0.1:4173/?mode=play&level=rf06-2&view=third
Explicit release: http://127.0.0.1:4173/rf06-series-v1-r16/?mode=play&level=rf06-2&view=third
