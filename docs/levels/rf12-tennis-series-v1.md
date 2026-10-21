# RF-12 tennis series v1

Status: completed. User acceptance: not yet recorded.

The page label RF-12 maps to internal route `rf14`, not the kitchen `rf12` family. The three tennis levels share the original `realism-v0.4.8` court, eight balls, two labelled baskets and the new east-side shelter. RF-12 remains collection; RF-12-2 requires four yellow and four orange balls in matching baskets; RF-12-3 adds rain. Wrongly sorted balls can be retrieved through the formal pickup animation. There is no cart-pushing objective.

## Weather contract

- First storm and subsequent dry intervals: random 45–90 seconds.
- Each storm: random 60–90 seconds; repeats until the task finishes.
- Each storm separately accumulates outdoor exposure. Exactly 30 seconds is allowed; greater than 30 seconds fails.
- Entire robot collision envelope must be under the roof. Entering shelter pauses exposure without clearing it; the next storm clears it.
- All three levels start with 100 reserve points. Actual translation costs 0.4 points/m; every accepted F attempt costs 2 points at animation start; first correct return of each ball rewards 6 points, capped at 100. Idle shelter waiting, turning and passive simulation drift do not drain reserve. At zero, the mission fails.
- Storm visuals, overcast lighting and rain audio remain. Collection/weather counters and the top-right system status are removed; mission and reserve displays remain.

## Deployment

Task-authorized server: `127.0.0.1`; project: `.`.
Production records: `./authoring/server-production/rf12-tennis-series-v1`.
Active release: `rf12-tennis-series-v1-r7`; scene/rules: `tennis-series-v1`; added assets: `series-v1`.

- RF-12: `http://127.0.0.1:4173/?mode=play&level=rf14`
- RF-12-2: `http://127.0.0.1:4173/?mode=play&level=rf14-2`
- RF-12-3: `http://127.0.0.1:4173/?mode=play&level=rf14-3`

Root tennis middleware serves the immutable release entry and emits `x-arc-release`. Run `node tools/rf14-series/build-release.mjs rf12-tennis-series-v1-rN` with a new version to create another candidate. Runtime assets are served at `/local-assets/levels/rf14/`; the main build allowlist includes the new directory. The copy plugin now respects the resolved Vite output directory, retaining the default `dist` behavior.

Generated media, build output, links, candidate HTML/JS, production records and credentials are intentionally excluded from the task commit. Deployment must retain the release directory and the existing public asset directories. See the adjacent asset manifest for hashes and provenance. The shelter is precise Blender geometry; the rain sound is Cardinal-generated.

## Verification, 2026-09-22

- `node --test tests/rf14-series.test.mjs tests/rf14-tennis.test.mjs`: 18/18 passed, including sorting, correction, full engine completion, rain boundaries, deterministic timing, reset, shelter envelope, post/bin/net collisions and base reserves.
- Dedicated release build passed; standard full project build with custom output directory passed. Only existing bundle-size warnings remain.
- Source, full-build and HTTP bytes matched for all three new assets and nine reused GLBs. All three root HTML responses exactly matched r5.
- Blender re-import audit checked exported shelter roof/post dimensions and the separate collision GLB.
- Final browser r5: orange floor pickup and matching basket release both completed, delivered count became 1, and the robot returned to standing. Recorded contact errors were 0.0004682 m (pickup) and 0.0198287 m (release), both below the 0.02 m commit threshold. Earlier r3 exercised yellow pickup → wrong basket → retrieval → correct basket using the same final animation source.
- Final browser r5: over 36 seconds under rain shelter left exposure at zero; a 29-second setup fixture followed by real elapsed time failed at 30.0045 seconds outdoors. Failure text and restart were checked.
- Actual first/third-person rain, basket contact, result and base scene screenshots are archived under production `evidence/`. Browser console error sample was empty. One third-person rain performance sample was 47.4 FPS, 178 draw calls and 1,336,926 triangles; this is a device-specific sample, not a benchmark guarantee.
- Nine protected robot, locomotion, shared envelope and control files matched the task-start hashes. No shared camera, robot asset or initial-pose contract was changed.

## Scope and limitations

Acceptance uses internal-information setup fixtures for point-based actions and actual animation playback; it is not autonomous navigation or a full-route playthrough. Collision regression uses the real movement function and exported geometry; very short browser key taps were inconclusive for manual locomotion and are not claimed as a collision pass. Full MuJoCo navigation and reserve calibration were outside the agreed default scope. First-person screenshots use the existing shared camera and its letterboxing.

QA setup controls load only with `tennisqa=1`; normal player entry has no fixture panel. Final completion is committed only after the last animation returns to standing.


## HUD and reserve revision, 2026-09-23 (r7)

User requested removal of collection/rain counters and top-right weather status, plus movement/interaction costs and successful return rewards. Scope applies to the three shared tennis variants. The bottom general collected-count telemetry is hidden as well. Controls, robot/camera contracts, scene assets and rain timing are unchanged.

Charging happens once when an interaction starts, including empty/blocked attempts; the animation contact commits the same action without charging twice. Successful matching-bin delivery awards the ball only once. Pickup/drop/wrong-bin placement provide no reward. The standard engine path also charges, and insufficient reserve fails before committing the action. Reserve failure text is distinct from rain failure.

22/22 targeted tests pass, including actual-distance charging, idle/turn/passive-drift exclusions, wrong-bin correction costs, animation start/contact billing, one-time capped reward and depletion/reset. Dedicated r7 build passes. Browser verification and final deployment evidence are archived in `./authoring/server-production/rf12-tennis-series-v1/hud-reserve-r6`; the directory retains the initial attempt label, while final shipping release is r7. This change has point-based validation, not full-route reserve calibration.

Final r7 browser action sample: initial 100 → empty F and pickup plus 0.4131 m approach → 95.8348 → return F and 1.5946 m approach plus 6 reward → 99.1969. Ball delivered, empty hand and standing idle confirmed. The movement distance used by the formal approach animation is included in reserve billing.

Final r7 rain screenshot confirms the collection/exposure/countdown panel and top-right system indicator are absent while rain remains visible and shelter exposure remains zero. No current r7 browser errors were observed; r6 interface-wiring errors were fixed before final release.
