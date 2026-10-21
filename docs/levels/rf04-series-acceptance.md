# RF-04 series acceptance

Status: completed, 2026-09-20. User acceptance: optional / not yet recorded.
Approved plan: v0.1; F-key animated local alignment and grasp, player-controlled carrying.
Authoritative workspace: ..
Evidence and protected baseline: ./authoring/server-production/rf04-series-v1.

## Delivered behavior

All three variants share the RF-04 apartment, laundry props, three-bay storage and charging dock. The storage now uses permanent garment samples instead of text labels.
RF-04 finishes at hanging. RF-04-2 additionally waits 8 seconds for drying and requires correct shirt/pants/towel storage.
RF-04-3 additionally requires grabbing the moving vacuum, manually carrying it and placing it in the charging area. Either objective order works. Dropping elsewhere resumes roaming.
A nearby F immediately stops the vacuum at its exact position before alignment, crouching and reaching. Stopped mode grants no cargo, score or completion; contact alone commits pickup. Interrupted attempts leave it stopped and retryable.
The vacuum now uses the same BASE.moveSpeed as the player: 1.4 m/s, without proximity slowdown; obstacle response turns it away. It only becomes carried at the successful contact event and becomes docked after placement.
Original robot, shared movement, controls and initial-pose files match protected hashes; the RF-04 camera contract is retained.

## Release

Code build: rf04-series-v2-r23. Shared scene revision: rf04-series-v2. See rf04-architecture-v2-acceptance.md for the current architecture/performance revision.
URL: http://127.0.0.1:4173/rf04-series-v2-r23/index.html?mode=play&level=rf04-2
URL: http://127.0.0.1:4173/rf04-series-v2-r23/index.html?mode=play&level=rf04-3
Original variant: same URL with level=rf04.
Current r23 code pins the r20 asset copies, including architecture-v4; preserve the r20 directory. Earlier r7/r13 releases pin r4 copies; preserve those older dependencies for rollback.
All three normal pages reported data-required-assets-ready=true. Normal pages have no QA panel.
64 release HTML/JSON/JS responses match deployed bytes (evidence/r7-http.json).
11 required GLBs match source, pinned build and HTTP hashes (evidence/asset-hashes.json).
Build command: RF04_ASSETS_BASE=/rf04-series-v1-r4 RF04_RELEASE=<new immutable release name> node node_modules/vite/bin/vite.js build --config tools/rf04-series/release.config.mjs

## Verification and evidence

- node --test tests/rf04-laundry.test.mjs tests/rf04-series.test.mjs: 41/41 passed; test.log.
- Vite release build succeeded; build-r7.log. Existing large-chunk warnings remain.
- RF-04-2: 15 formal animated interactions through completed storage; evidence/rf04-2-results.json, rf04-2-complete.png and rf04-2-first.jpg.
- RF-04-3: 17 formal animated interactions, vacuum first then laundry, complete only after both objectives and standing recovery; evidence/rf04-3-complete-results.json and rf04-3-complete.png.
- The full laundry browser evidence above is from r4. Laundry code/assets are unchanged in r7; only affected vacuum behavior was retested. r6 exposed a moving-target reach timeout. r7 adds near-person crawling and passes actual pickup/recovery and dock/recovery.
- r7 vacuum contact errors: pickup 0.054262 m; docking 0.053270 m. Evidence: rf04-3-r7-vacuum-results.json, rf04-3-r7-carry-third.jpg, rf04-3-r7-docked-third.jpg.
- rf04-3-r7-carry-diagnostic.png is a separate diagnostic-camera image of the same scene/current animation, not the formal gameplay camera. Hands support both sides of the vacuum.
- r7 fixed-point short movement: wall blocked at x=-8.895; storage blocked at z=5.945; doorway traversed from z=5.15 to 3.225. evidence/rf04-r7-collision.json. State tests also cover carried-object clearance, wrong storage, remote/blocked F, reset, both completion orders, and motion after release in another room.
- Earlier first-person sample: about 37.8 FPS over 300 frames in the local in-app browser. Not a cross-device performance guarantee.

## Scope and limitations

This is privileged fixed-point functionality/animation/collision acceptance: only the robot is positioned at test stations; actual object pickup, carrying pose, release, task commits and standing recovery use the normal controller. It is not visual-agent navigation or a complete manual carrying-route test.
G1 velocity/F mode was browser-tested. Other robots and 29DOF agent control were not accepted in this task.
Remote software-render browser capture timed out; local browser evidence is the accepted visual evidence.
The existing apartment and Cardinal laundry props are reused. New vacuum/furnishings/collisions use the authorized Blender fallback: Cardinal model task failed and image request returned HTTP 409. No new Cardinal vacuum is claimed.
The source commit is intentionally scoped to this task and relies on pre-existing runtime animation/rendering hooks in the dirty server workspace; unrelated changes are preserved. Release artifacts capture the tested server workspace. Large generated assets, environments, credentials and evidence logs are not committed.


## r9 visual-cue revision

User requested removing storage labels and using example garments for classification.
Removed all three storage text plaques. Reused the existing Cardinal shirt, pants and towel models as permanent examples on the top board, with two towels stacked above the towel bay. Samples are shared by all three variants and do not count as task items or obstruct the placement surface.
Only shared scene decoration changed; task state, animation, collisions and camera are unchanged.
Checks: 41/41 existing tests passed (test-r8.log); final Vite build passed (build-r9.log); r9 HTML/manifest/JavaScript HTTP bytes matched. Formal first-person r9 screenshot inspected: evidence/rf04-r9-storage-examples.jpg. Previous unaffected interaction/collision evidence remains applicable.


## r13 equal-speed vacuum revision

User requested matching the player robot movement speed. VACUUM.speed now references BASE.moveSpeed (1.4 m/s); the proximity crawl has been removed.
The fast target could escape during the original preparation. The animation now waits ready for actual contact on a subsequent pass, keeps the hands within reach when the target is distant, and follows nearby targets with faster arm animation. Pickup requires both hands near the vacuum's cylindrical shell (maximum surface gap 0.055 m, hand separation at least 0.20 m), instead of requiring two exact predetermined points. The vacuum is never slowed/frozen to make the test pass. No robot model, initial pose, shared controls or movement source was changed.
42/42 tests passed, including equal displacement at both near and far player distances (test-r13.log). Vite build passed (build-r13.log); served HTML/manifest/JS bytes matched (evidence/r13-http.json).
r13 browser fixed-point pickup and docking both passed using real animations; pickup surface gap 0.033074 m, dock target error 0.013309 m. Evidence: rf04-r13-vacuum-results.json and rf04-r13-docked.jpg. This verifies one actual capture/return case; at the higher speed, timing and interception matter, and an escaped target can still time out and require retry.

Current scene revision supersedes the older top-board samples: examples are inside bays, main doors are wider, window counts are reduced, and first-person ceilings are present. See rf04-architecture-v2-acceptance.md.


## r18 immediate-stop pickup correction (2026-09-20)

Supersedes earlier moving-target pickup behavior. F changes roaming to stopped synchronously; the robot then aligns, crouches, reaches, grasps and stands. Ordinary arm speed is restored. Remote F cannot stop the vacuum, stopped vacuums retain body collision, and wrong-place release resumes roaming at 1.4 m/s.

Verification: 45/45 Node tests passed; immutable Vite build passed. All three runtime modules export the stop transition. Formal r18 fixed-point QA passed pickup and docking (robot test placement only; no object teleport, direct cargo injection or skipped animation). Stage evidence records roaming -> stopped while crouch=0 and cargo=null, unchanged x/z during full crouch/reach, then carried after contact and docked after release. Pickup contact error 0.051146 m and placement 0.054863 m satisfy the existing 0.055 m contact threshold. Robot restores standing posture. Laundry remains incomplete in this vacuum-only fixture, as expected.

Evidence in ./authoring/server-production/rf04-series-v1/evidence: r18-actions.json, r18-carry.jpg, r18-carry-close.png, r18-docked.jpg. Formal third-person captures and a separately identified close diagnostic were visually reviewed. Protected robot/movement/control hashes match the baseline. 34 release HTML/runtime/series HTTP responses match build bytes (r18-http.json). Existing shared-scene/laundry/collision evidence remains applicable; no complete route test was claimed.

r17 exposed a missing runtime export in browser QA and was superseded by r18; r17 is retained only as the immutable asset dependency. No Cardinal assets or scene geometry changed in this correction.


## r19 indoor wall following (2026-09-20)

Replaces rectangular roaming/bounce behavior with collision-boundary following, keeping the wall on the right and targeting a 0.12 m shell-to-wall gap. It acquires a nearby wall, follows inner/outer corners and door openings, and detours around furniture. A floor-outline boundary prevents decorative window gaps from becoming outdoor exits. Swept checks use <= 3 cm steps and a 1.5 cm safety margin. Angular speed is limited to 3.5 rad/s; tight corners turn in place. Translation remains 1.4 m/s. Nearby player exclusion remains 0.48 m. F-stop, contact pickup, manual carrying and docking are unchanged; dropping elsewhere reacquires the local boundary without a synthetic roaming box.

46/46 tests and immutable r19 build passed. The affected motion tests cover sustained wall proximity/corner progress, indoor containment, collision clearance, translation speed, dropped-vacuum motion, stopped-state immobility and both objective orders. A 300-second engine diagnostic travelled 317.17 m with 92.1% of samples within 0.65 m of architecture/boundary; this is vacuum motion validation, not robot-route acceptance.

Formal browser patrol QA sampled 80 live frames over 20 seconds, passed indoor/collision checks and movement progress. Formal third-person screenshot r19-wall.jpg was reviewed: vacuum visible by the laundry-room perimeter, remaining on the floor. Browser performance sample: 300 frames, 59.97 FPS. Following patrol, fixed-point formal pickup/docking passed both actions, including synchronous stopped/empty-handed state before crouching. Evidence: r19-patrol.json, r19-wall.jpg, r19-actions.json under the existing production evidence directory. No object teleport or animation skipping. Robot station placement was used only for pickup/docking QA. Protected robot/shared-control hashes remain unchanged; 34 release responses matched build bytes (r19-http.json). Assets still pin r17; preserve that dependency.


## r22 solid doorframe repair (2026-09-20)

The widened non-manifold wall shells had uncapped cuts. Five main portals now have closed solid jambs and head returns spanning the paired wall shells, plus casing on both room faces. 45 beveled components bridge the cuts; exported GLB re-import and welded-edge audit confirms every component is manifold with positive volume. 30 floor-level jamb/casing footprints are included in the authoritative movement and collision GLB. Runtime flush stone thresholds bridge the floor gaps at the same five openings; their top is 5 mm above the floor and they do not create a blocking step. No camera/FOV/backface workaround was introduced.

Clear doorway widths: west bedroom 1.43 m, bathroom 1.33 m, east bedroom 1.48 m, dining/hall 1.43 m, laundry/dining 1.53 m; clear height 2.185 m. All three variants share architecture-v4/home.glb and collision.glb, with unchanged v3 props. Geometry is 45 low-poly solids plus five runtime threshold boxes.

Verification: 46/46 state/collision tests passed (r22-tests.log), including carried-vacuum passage across all five portals and wall-following vacuum safety. Build passed (r22-build.log). Formal browser local movement passed walls/storage blocking and all five door crossings, each 1.925 m (r20-door-collision.json). r20/r21/r22 share the same door/collision GLBs; r21 adds QA viewpoints, r22 additionally seals floor gaps without altering movement collision. Ten formal first-person captures inspect both faces of each portal (r20-door-west-a.jpg and r20-door-1..9.jpg). Oblique review found remaining floor gaps; r22-door-oblique.jpg confirms the background slit is replaced by a solid threshold. Final third-person r22-door-third.jpg reviewed, ceiling still absent in the elevated view. Test stations use explicit QA placement; no full robot navigation route is claimed.

Asset source/build/HTTP equality: r20-assets.json (pinned current assets); 34 final HTML/runtime/series responses match bytes: r22-http.json. Export audit: r20-mesh-audit.json. Protected robot/movement/control hashes remain unchanged. Runtime/build/QA/documentation only are committed; assets and evidence remain under /path/to/arc-workspace. Tools: repair-doorframes.py and package-doorframe-collision.py, with combined SHARED_COLLIDERS serialized to collision-v4.json before collision export. User acceptance remains optional, not yet recorded.


## r23 washer unload movement lock (2026-09-21)

Reproduced a collision transition defect: the empty-handed pickup stand could be legal while the newly carried wet-batch envelope overlapped the washer, rejecting movement/turning (especially small high-frame-rate steps). Washer-unload now reserves the carrying and 0.57 m turning clearance before alignment/crouching. Existing physical collision remains enabled. findLaundryStand is exported for regression coverage; other actions retain their prior selection behavior.

47/47 tests passed, including all three variants from three washer approach positions, backward/lateral/turn inputs at 144 Hz, and full carrying yaw clearance. Build passed; 7 HTML/series HTTP responses match release bytes, protected hashes unchanged. Assets still pin r20.

Formal r23 browser QA starts from an explicitly prepared washer-finished fixture, then plays the real alignment/crouch/contact/pickup/standing animation without injecting pickup results. Contact error 0.05383 m; final animation phase holding, crouch=0, bend=0. Backward, both lateral and both turn inputs passed; subsequent backing movement travelled approximately 0.514 m from (8.2004,-5.3926) to (8.0590,-4.8987), carrying wet-batch. This is fixed-point unload/movement acceptance, not a full laundry route. Evidence: r23-actions.json, r23-unload.json and visually reviewed formal screenshot r23-unload.jpg in the production evidence directory.
