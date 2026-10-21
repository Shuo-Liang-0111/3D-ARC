> Superseded by [RF-01 restored carry v1](rf01-restored-carry-v1.md). The controller documented below was rejected and removed; these results are historical.

# RF-01 two-hand cargo actions — 2026-10-08

Release: `rf01-cargo-actions-v1`, served for the three RF-01 root play URLs.

The previous release used generic crate pickup/place presentation. The special battery hold hook covered only RF-01/2 and was overwritten in the non-MuJoCo render path. No complete RF-01 target-aware pickup controller was found in the previous immutable bundle. This change adds a shared G1 velocity-mode controller through the existing runtime animation hook, rather than changing robot models, skeletons, camera or movement controls.

Battery and parcel interactions now approach a collision-checked station, prepare posture, reach both actual side surfaces, transfer only on contact, lift continuously, restore standing and release movement. Conveyor parcels continue moving while the hands wait at the pickup station; the selected parcel is committed only when it reaches both hands. The visible original asset is carried between the palms; the generic rack clone is suppressed. Placement interpolates position/orientation, releases at contact and recovers. Last-parcel completion waits for recovery. Battery power and workshop parcel lighting gates remain active.

The close carry position requires a correspondingly closer parcel collision offset and reachable battery/parcel ground drop distances. The unsafe-drop test station is adjusted so the expected drop still intersects the belt. Other scene assets and behavior remain unchanged.

Validation:
- 43 RF-01 source regressions pass; Vite production build passes.
- `node tools/check-rf01-pickup.mjs public/rf01-cargo-actions-v1` passes using the actual G1 skeleton and published runtime. Eleven full local actions cover rack battery pickup, slot insertion, three moving parcel sizes and sorting deposits, battery drop/re-pickup, retained movement and reset. Contacts, phase sequence, object continuity and deferred final completion are asserted.
- Measured contact errors remain below 4.5 cm in these fixtures (moving pickups approximately 0.5–1.1 cm; battery rack approximately 0.2 cm in the browser); no held-object frame step exceeds 6.4 cm at 20 Hz.
- `tools/check-rf01-release.mjs` verifies all three animation exports, battery gates, door clearance/reset and parcel visibility in bundled code; 27 entry/runtime/dependency files match live HTTP bytes.
- Actual asset/G1 keyframes for battery and conveyor pickup were inspected in the browser using the published runtime. This is internal-state local animation verification, not full robot navigation or user acceptance.
- G1 velocity mode is covered. R1 and joint-control mode retain their existing interaction paths.

Edits, builds, assets and logs remain on the selected server under `/path/to/arc-workspace`. Detailed evidence: `production/rf01-pickup-20261008/`. Generated review pages and bundles are server-only; unrelated uncommitted sorting work is preserved.
