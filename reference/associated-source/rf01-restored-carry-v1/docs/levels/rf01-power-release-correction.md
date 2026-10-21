# RF-01 battery/lighting release correction — 2026-10-08

RF-01-2 and RF-01-3 still opened the workshop shutter without a battery because the root play URLs served the immutable `rf01-sorting-build-v4-navigation-v1` bundle. Source changes in commit `236848b` did not update those deployed chunks. The previous source-module HTTP check and source preview did not verify the deployed gameplay behavior.

The old published runtime reproduces `powered=false, battery.location=ground -> shutterPhase=opening` in both affected variants. The corrected release is `rf01-sorting-power-light-v1`, built from the authoritative server working tree and selected by the RF-01-only Vite route. The response header uses the same release variable as the index path. The previous release is retained for rollback. No robot, camera, appearance or interaction implementation was edited in this correction.

Validation:
- 43 RF-01 source tests pass; production build passes (existing chunk-size warning).
- `tools/check-rf01-release.mjs` imports the exact published runtime chunks selected by the build manifest and checks ground/held/installed battery states, both workshop controls, opening completion, door collision clearance, reset, and actual bundled parcel render sync for lights off/on/off.
- RF-01 retains its prior unpowered workshop-door behavior.
- Root play URLs for all three RF-01 variants return `X-ARC-Release: rf01-sorting-power-light-v1`, no-store HTML and the new entry, without the Vite HMR client.
- All 26 entry/runtime/static dependency and stylesheet files checked against HTTP have identical bytes.
- Public IP HTTP confirms the new release header.
- Verification uses nearby internal-state fixtures, not a robot navigation route.

Recheck an already published version with:
```sh
node tools/check-rf01-release.mjs public/rf01-sorting-power-light-v1 http://127.0.0.1:4173
```

Server workspace: `.`. Build and logs: `./authoring/server-production/rf01-power-release-20261008/`. Existing uncommitted source work remains outside this task commit; generated bundles and assets remain on the server. Refresh open game tabs to load the new bundle.
