# RF-08 series — proposal v0.1

Status: initial gameplay and scene clarification. This is a proposal, not an implemented release.

## Verified source
- Current authoritative server/project: see server-profile.json. User selected the host/root explicitly.
- Menu RF-08 is Meeting Setup, internal route rf09. Internal route rf08 is the unnumbered real-scene scan interaction test. Verified docs/levels/display-numbering.md, runtime modules and live browser menus; user clarification requested.
- Meeting Setup: 26 × 18 m office, wall height about 3.3 m, reception, administrative supply cabinet, IT cabinet, workstations, glass meeting-room division, conference table and presentation equipment.
- Baseline rules: collect adapter, install adapter, collect clicker, install clicker, start conference terminal. Current initial reserve 100.
- Existing source has many unrelated modifications, including app.js, index.html, robot sources and rf09 modules; preserve all. Baseline snapshots/hashes must be taken after selection, before implementation.
- Live first/third-person browser views inspected. Meeting office has lights but no complete ceiling; first-person shows background above walls.

## Fixed user requirements
- Reuse the same scene for RF-08, RF-08-2, RF-08-3, increasing difficulty.
- Shared improvements must appear in all three levels. Preserve building footprint, main layout, materials, furniture and object set; differences are task conditions and initial equipment states.
- Ceiling visible in first-person, hidden in third-person, including simultaneous dual-view rendering.
- Preserve robot geometry, skeleton, dimensions, initial pose data, shared camera/FOV/socket, controls, kinematics and envelope. Runtime interaction animations require the clarified control-mode contract.
- Production, environments, assets and deployment under /path/to/arc-workspace; Mac is a control surface.
- Cardinal authorized, long-term credential configured privately, no cost reporting. High-highpoly for any required new props; reuse existing good assets first.

## Three proposed gameplay directions
A (recommended): equipment commissioning followed by dynamic fault recovery. RF-08-2: adapter/clicker installation plus video-input selection, visible test pattern and remote slide advance. RF-08-3: after startup, video-link loss or remote failure; diagnose visible symptom, obtain matching spare from IT cabinet, replace failed module, retest and resume presentation. Allow two sequential finite incidents; no infinite random failure loop.
B: meeting material arrangement followed by multiple seat-specific preparation conditions. RF-08-2: deliver document trays/water to marked seats. RF-08-3: match differentiated meeting requests to seats, verify AV setup and start. Additional small props in all three scenes.
C: post-meeting equipment return followed by inventory and replacement. RF-08-2: return devices to matching storage slots. RF-08-3: identify missing/damaged equipment, move it to service tray, replenish and finish inventory.

## Recommended A specification (pending selection)
- Preserve original RF-08 completion conditions.
- RF-08-2 final objective: complete equipment installation and AV tests, then start presentation. Dependency chain: adapter installed -> valid source -> image test; clicker installed -> slide advance test; both passed -> final start. Wrong order/source yields feedback and remains recoverable.
- RF-08-3 final objective: restore meeting operation and pass final recheck after two finite faults. Fault states: healthy -> fault indicated -> affected system stopped -> matching module replaced -> test passed -> presentation resumed. Wrong spare does not satisfy repair; no premature success before animation completes. Symptoms visible on screen/status indicators.
- Difficulty derives from additional conditions and diagnosing faults; no new hard time limit by default. Retain 100 initial reserve and existing controls. Any economy changes to be documented once chosen; no full-route reserve calibration by default.
- Indicative player duration: base 3–5 min, RF-08-2 5–7 min, RF-08-3 7–10 min; design targets, not measured completion times.
- Shared props: existing adapter, clicker, cabinets, conference table and terminal; potential matching spare modules/service tray and readable equipment indicators. Same object set across three levels.
- Visual improvements: ceiling tiles/panels and properly installed lights, coherent indoor illumination, device supports and reachable interaction positions. Existing interaction anchors and rendered podium/terminal positions need reconciliation before reliable hand-contact animation.
- Default control recommendation awaiting user: nearby F plays local alignment and operation animation, walking remains player-controlled; no object rigid-body simulation. Scene collision retained.
- Performance target: desktop 1080p 30 FPS, reuse/cache shared assets; not yet measured.
- Asset candidates go in new versioned directories, never overwrite active assets during trials. Precise shell/support/collision geometry in code or Blender; Cardinal for missing independent detailed props and texture refinements.
- Acceptance: isolated setup at interaction points followed by real interaction animation; inspect approach/contact/carry/release/recovery and state transitions. Local wall, door, furniture and carried-object collision checks. First/third/dual ceiling checks. No complete route navigation or reserve sufficiency claim.
- Build and meaningful impacted tests required. Known pre-existing dirty tree and historical stale rf09 test expectation must be distinguished from new regressions. Commit only task changes after successful checks; user has not authorized a push in this task.
- Deployment: existing selected-host service after internal gates; record exact code/asset version, HTTP hashes and screenshots. Retain prior version and rollback references.

## Pending questions
1. Does RF-08 refer to the menu Meeting Setup scene (recommended interpretation) or internal scan test?
2. Gameplay direction A/B/C (or user revision).
3. F-key animation, object physics, or 29-DOF Agent interaction contract.

No production code, asset generation or service switch has been performed for this proposal.
