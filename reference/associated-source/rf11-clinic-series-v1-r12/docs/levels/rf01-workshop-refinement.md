# RF-01 shared workshop refinement — 2026-09-18

## Scope and deployment

The user requested a corrected interior shutter switch, lower lighting in both switch states, and more realistic rails and equipment controls. The changes apply to the shared RF-01, RF-01-2 and RF-01-3 scene. Mission completion rules are unchanged.

Authorized deployment: `127.0.0.1`, workspace `.`, Vite port `4173`. The running process cwd and command line were checked against that workspace. The original Cardinal workshop shell and opaque roof remain in place; no procedural interior shell was reintroduced.

## Final implementation

- Interior shutter control: `(4.05, 1.2, -1.53)`, facing inward. Ray intersections against the transformed original Cardinal wall at height 1.2 m measured z = -1.3905 at x = 4.05. The 8 cm mounting bracket reaches that surface. A playable approach is `(3.5, -2.8)`, facing the doorway.
- Lamp intensities: off `0.45`, on `18`, previously `4` and `72`. Diffuser emission: `0.025` / `1.1`. Fill intensity: `0.055` / `0.12`.
- Indoor indirect light is attenuated spatially to 9% inside the room, with a smooth boundary. The mask excludes the exterior roof and front facade. This addresses yard HDR and hemisphere light remaining bright indoors after lamp intensity changes. No additional lights, shadow maps, screen-space passes or camera transparency are added.
- Rails now have separate feet, webs and polished heads, sleepers and mounting plates. Rails extend beyond both trolley center endpoints; the rail head reaches y = 0.1375 m and the fitted trolley starts at y = 0.138 m.
- The control station reuses the existing Cardinal industrial button box at its original proportions, mounted on a steel pedestal with a base plate and anchors. Its status lamp has an independent material. Asset loading is required before the scene is ready; a failed model load does not silently expose a procedural fallback.

## Verification

- `node --test tests/rf01*.test.mjs`: 28 passing, 0 failing.
- Added continuous engine routes for approaching the moved inside switch and reopening the door, and for entering, lighting, stopping and safety-locking the RF-01-3 trolley.
- Existing checks cover shared layouts, shutter clearance and anti-crush behavior, carried envelopes, battery mobility, collision, reward deduplication, reset and failure states.
- `node --check` on edited modules, `git diff --check`, and `npm run build`: passed. The build retains the existing large shared bundle warning.
- Served Cardinal control GLB SHA-256 equals the on-disk asset: `fd238179d9ae124c08ddb07151ff45b990fcf15f98bd463c1df71477575b2b62`.
- Formal browser screenshots were inspected. G1 third-person confirms the original facade and blue roof remain unchanged. R1 first-person uses the same formal game scene and exercises entry, lights off/on, control request, stopped trolley and the relocated inside shutter control.
- The inside switch was operated at `(3.5, -2.8)`: `shutterPhase` reached `open`, the real doorway was visible, and the normal close countdown remained active.
- The new station was operated at `(-2.15, -3.1)`: `stopRequested` became true, the trolley reached x = 2.6, phase `stopped`, and the safety arm reached `raised`.
- No browser console errors were reported during final checks.

Evidence is stored outside Git under `production/rf01-workshop-20260918/`: `rf01-workshop-exterior.png`, `rf01-workshop-dark.png`, `rf01-workshop-lit.png`, `rf01-workshop-control.png`, `rf01-workshop-door.png`, and `rf01-workshop-door-open.png`. The temporary route harness calls the existing game action API without teleporting; it is archived under `/opt/arc-runtime/tmp/rf01-visual-qa.html` and removed from the public root after inspection.

Detailed indoor browser inspection used R1 to avoid an observed G1 velocity-mode idle yaw drift. No robot, shared camera, movement or simulation implementation is changed by this task. The full dynamic mission is verified by a continuous engine route; this record does not claim a new full G1/MuJoCo browser completion or an FPS benchmark.

## Source fingerprints

| File | SHA-256 |
| --- | --- |
| `game/rf01-shared-level.js` | `4d841a7e2195f10eb3e7af8e4348a026e6ee8281578b988cd262b6e8dc1406d7` |
| `game/rf01-shared-scene.js` | `555a945c93d78d8694b215725f333b047acb81cc8913fc650eb4595593ddb07e` |
| `game/rf01-workshop.js` | `2e9f6dc83584807f1aef77e2910bb11af5fae6c4e54ec775b0a7468d084c75ae` |

Internal review: passed for this refinement scope. User acceptance: not yet recorded.
