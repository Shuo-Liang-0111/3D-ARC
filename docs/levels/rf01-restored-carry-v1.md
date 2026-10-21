# RF-01 restored carry v1

The rejected cargo-actions-v1 controller bypassed the existing RF-01 hold and wrote zero hip/knee/ankle and torso angles every carried frame. This interfered with locomotion.

## Implementation

- Restore the two-arm HOLD calibration from commit 3e01ef5 and the existing robot-action timeline introduced in fc7168f.
- Export the same cargo pose hook from RF-01, RF-01-2 and RF-01-3. Run it after both locomotion rendering paths.
- Remove the RF-15-derived RF01InteractionAnimation controller. Retain the original robot model, shared locomotion, skeleton, dimensions and cameras.
- Use the same two-arm support for parcels, accounting for their existing local model offset.
- Preserve the final parcel placement / light-switch gesture when mission completion replaces the event name.
- Retain battery power interlock, indoor parcel visibility, scene assets and sorting rules.

## Verification

- 51 RF-01 and robot-action regression tests passed.
- tools/check-rf01-pickup.mjs: 12 level/cargo combinations on the actual G1 skeleton; original reach/lift/hold/place timing, arm attachment, unchanged lower-body walking joints, movement and turning, and final parcel placement.
- Candidate bundle checks passed for all three levels, battery interlock, door clearance/reset and parcel visibility.
- Live release headers and 26 entry/runtime/dependency files match the published bytes.
- Internal nearby-state render inspection used actual scene/cargo/G1 assets for battery and parcel keyframes and four walking phases. This is privileged fixture inspection, not navigation.
- Formal RF-01-3 page loaded assets and entered gameplay. No full route or full MuJoCo driving run performed.
- Vite production build passed (existing large-chunk advisory remains).

This restores the historical timed two-hand animation; it does not introduce a new contact-solving controller. User visual acceptance has not been claimed.

Deployment: public/rf01-restored-carry-v1, selected by the scoped Vite middleware.
Evidence and baseline: ./authoring/server-production/rf01-restore-carry-20261008/.

