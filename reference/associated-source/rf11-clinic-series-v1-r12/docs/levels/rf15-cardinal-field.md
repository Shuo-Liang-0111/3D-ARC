# RF15 Cardinal field and tool-room exterior

## Authorized scope

The production workspace is `.` on the user-selected server. Existing shared robot, camera, input and MuJoCo code remain frozen. The three variants share one scene and interaction implementation; only their completion conditions differ.

Replace the old merged decorative field with two 1.1 × 5.2 m cultivated beds in a 4.4 × 5.2 m plot. Eight existing-field plant positions become independent stateful crops: four lettuce and four bok choy. A harvest basket sits adjacent to the plot at (10.2, 0, 2). The central aisle remains accessible and crop beds have solid collision boundaries.

RF15-1 requires the actual tool-room harvest knife. A short cutting action precedes carrying each vegetable to the basket. Empty hands and the trowel cannot harvest. Plants disappear from their soil positions only after cutting, then use the same model in the carried and collected states. No duplicate decorative vegetables remain.

RF15-2 can spray those same field objects. RF15-3 can collect the two prepared vegetable crates from the warehouse intake and use the fluctuating scale, packing station and loading position. All stations and the knife/field/basket interactions are available in every variant; completing a different interaction does not finish the wrong mission.

## Asset provenance

`tools/rf15/cardinal-field-assets.py` submits and records seven authorized Cardinal requests: high-highpoly PBR lettuce, bok choy and open harvest crate models, plus plaster, weathered wood, roof metal and soil base-color images. Request files, original high-poly assets, task IDs and statuses live outside Git under `./authoring/server-production/rf15-cardinal-field-v1`.

`tools/rf15/build-cardinal-field.py` produces versioned browser GLBs. Blender preserves the verified tool-room dimensions, door opening, hinge and hardware, replacing plaster, wood and roof surface materials with Cardinal imagery. Normal and roughness maps are derived from base color and are not claimed as scanned PBR channels. Soil beds and drip irrigation lines use measured Blender geometry. Plant and basket source meshes remain Cardinal-generated; runtime simplification and texture reduction preserve their original high-poly sources.

## Verification record

- Shared initial state across all three variants, knife requirement, solid beds and traversable central aisle: engine tests passed.
- Continuous spawn → tool room → knife → field → eight vegetables → basket route: 171.58 m, zero errors, final/minimum reserve 29.95 with 0.35 reserve per meter. Correct crop deposit rewards are once per crop; wrong interactions cost 5.
- Shared weighing/packaging/loading interactions and five-kilogram acceptance: engine tests passed.
- All seven Cardinal tasks completed. Active assets are `cardinal-field-v2`. Version 1 was rejected because excessive basket decimation damaged the lattice and the proportions were too tall. The selected basket preserves 120,000 triangles and measures 0.68 × 0.34 × 0.46 m; each plant preserves approximately 65,000 triangles.
- All six active GLBs have embedded textures and materials. Source, build-output and public HTTP SHA256 hashes match. Individual browser previews verified both leafy vegetable models, the open basket and the textured tool-room exterior.
- Fourteen focused tests pass, covering knife-gated cutting, the continuous harvesting route, shared scale/packing/loading stations, tool-room access and wall collision. Production build passes with the existing chunk-size warning. Robot, movement, operator-controls and MuJoCo client hashes match the protected baseline.
- Formal browser route passed in RF15-1 using the existing Agent movement/interaction API while MuJoCo was online: spawn → open door → enter tool room → take knife → field → all eight crops → basket → completion overlay. The existing Agent API advances the authoritative frontend movement engine; this is not a continuous manual MuJoCo locomotion test. No teleport or injected inventory/state was used. Actual route: 211.575 m, 18 interactions, zero errors, final/minimum reserve 15.949. Extra distance versus the engine route comes from heading corrections between Agent actions.
- Browser gate reports 52/52 world assets, no asset errors, cargo loaded and `cardinal-field-v2`. First-person field leaves, knife possession, disappearance of cut plants, incremental basket state and the final completion overlay were observed. First- and third-person screenshots were inspected during the route.
- Performance limitation: the long run measured 7–17 FPS. A fresh page reached 54 FPS before starting and approximately 17 FPS while running; unchanged original RF15 also measured 17 FPS in the same browser. New-scene renderer statistics were 176 draw calls and 1,047,775 triangles at spawn. This comparison does not isolate the cause or establish a sustained performance target; smooth rendering is not claimed. Shared robot/camera/simulation code was not changed to mask this limitation.

## Reproduction

Run `python3 tools/rf15/cardinal-field-assets.py . submit` once; recorded tasks are not submitted twice. Use the `poll` subcommand for status and controlled artifact downloads. Build with the installed Blender using `--python tools/rf15/build-cardinal-field.py -- .`. Completed asset files are immutable; incomplete batches can resume missing assets.
