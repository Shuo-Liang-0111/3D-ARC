# RF-10 series v2 — interaction and prop rework

Status: completed. User acceptance: not yet requested/received.
Server workspace: ..
Runtime routes: rf12 (RF-10), rf12-2 (RF-10-2), rf12-3 (RF-10-3).
Production records: ./authoring/server-production/rf10-series-v2.

## Defects verified in v1
- Oil and skillet disappear while carried; extinguisher follows the feet instead of a hand.
- Oil default position and pan start/target support are inconsistent with the visible cabinets.
- Floor-dropped props cannot be picked up again.
- Extinguisher teleports back to the wall after extinguishing.
- Overhead fixtures remain in third-person cutaway views.
- Cooking clock clamps elapsed time to a rendering frame, extending the deadline on slow devices.
- Three variants do not populate the same prop set; default cloth appears at world origin.
- The inherited scanned stove lacks clean burner/support geometry.

## Rework
- Shared metric layout and identical oil/skillet/extinguisher/cloth set across all three routes.
- New Cardinal oil bottle, hollow skillet and portable Class F extinguisher, high-highpoly source.
- Blender normalization, handle calibration, embedded PBR textures, web meshes.
- Precision glass/steel hob with brass injectors and cast iron supports; explicit tray/bracket/control housings.
- Existing project arm and stepping modules reused without modifying robot, skeleton, socket, camera or shared movement.
- F: nearby stance adjustment, reach, grasp/release event, lift, carry and recovery.
- Two-hand extinguisher presentation with hose, aimed spray and gradually suppressed flame.
- Drops remain at their release coordinates and can be retrieved.
- Timer uses actual elapsed seconds; original 55–65 second rule and early/late branches retained.
- Required prop GLB load failures fail the asset gate; no procedural-success fallback.

## Evidence scope
Explicit rf10qa=1 UI fixtures position the robot near a target, then invoke the same animation controller as F. No object teleport or success-state injection is used for interaction acceptance. Clock fixtures only accelerate the wait to test fire/timeout branches. These are local interaction/animation/collision tests, not complete-route or reserve-budget verification.

## Completed checks
- Node: 15/15 tests passed. Boundary times 55/60/65 seconds, early shutdown, overrun, repeat fire recovery, retrievable floor items, stale action rejection and local counter/wall/fridge collision.
- Vite production build passed; pre-existing large chunk warning remains.
- RF-10-2: prompt, pickup, placement and terminal, using real arm actions. Max measured contact error 0.02381 m.
- RF-10 medium: all eight interactions including cloth pickup/place, window and gas valve; completed. Max contact error 0.02215 m.
- RF-10-3: pan pickup/place, hood, ignition, early shutdown/restart, overrun, extinguisher pickup, spray, grounded release, hood and re-ignition, final shutdown at 58.7696 seconds; three cooking attempts; completed after arm recovery. Max measured contact error 0.02492 m.
- Carried oil and skillet remain visible. Prop grip transforms coincide with the hand transform; no rack replacement or feet-following cylinder.
- First-person: actual ceiling and oil closeup viewed. Third-person: ceiling and existing overhead fixture meshes hidden.
- Protected bytes: robot.js, unitree-g1-edu2.js, movement.js, g1-locomotion.js, view-mode.js and app.js match pre-task hashes.
- Required prop assets load with embedded textures; failures do not count as successful fallbacks.

## Evidence
Production evidence/browser-actions.json records controller events, errors, completion and scope.
Isolated Cardinal model review PNGs are in production evidence; they are asset inspections, not substitutes for formal browser views.
Formal browser screenshots are native tool attachments in this task, including pickup, supported props, ceiling/cutaway and completion views.

## Limits
F mode uses the existing browser joint animation/IK and collision-aware local footsteps, not force-controlled physical grasping. No full-route or reserve-budget validation is claimed. User acceptance remains unconfirmed.


## Final visual rework and publication
- Lowered carry pose, face-on extinguisher stance: first-person view shows the skillet, flame and spray; hands no longer fill the camera.
- Spray uses radial soft alpha particles; burner control uses a separate precision dial GLB instead of the deformed legacy scan.
- Formal first-person spray and third-person cylinder/nozzle pose were inspected in the browser. The spray stage was paused only for visual QA and resumed afterward.
- Full cooking sequence repeated successfully on the final prop version. Contact events stayed within 3 cm; grip binding follows the actual animated hand.
- Source, dist, release and HTTP GLB SHA-256 match for oil, skillet, extinguisher, hob and dial; evidence/served-hashes.json.
- Published at the existing port 4173; frozen build snapshot in release/. No additional service or environment outside the authorized /path/to/arc-workspace root.
