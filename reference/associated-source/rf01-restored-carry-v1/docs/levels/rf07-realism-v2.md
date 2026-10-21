# RF-07 realism revision v2

User scope: repair floating lights/controls and unsupported objects before animation work. Latest correction supersedes the earlier two-incident design: only equipment leaks; the blue specimen box has no lamp, button, leak outlet, or incident behavior. RF-07-3 still triggers exactly once in the first 180 seconds, with a hidden 120-second deadline and immediate failure on timeout. F drops cargo first and switches off the faulty device. All three levels share the same physical scene.

## Assets and physical corrections

Existing Cardinal meshes were refined in Blender 4.5.3, retaining original textures; no new generated assets were requested. New outputs live under `public/local-assets/levels/rf07/realism-v2/` outside Git. Reproducible exporter: `tools/rf07-series/refine-fixtures.py`.

- BSC: 26 mm round alarm lens and 28 mm power switch mounted on measured fascia/upright surfaces, with recessed rubber gaskets and metal bezels. Leak starts at a small chassis port. Old free-floating beacons and black button boxes removed.
- Refrigerator: removed the legacy fallback cabinet that occluded the loaded GLB; small controls on its fixed right frame, away from the door handle; thin numbered decal follows the upper fascia normal.
- Specimen box: passive original carrier, scaled consistently; no added controls or alarm parts.
- Packing island: worktop corrected from 1.21553 m to 0.92 m. Original textured body shortened; upper rack dimensions preserved.
- Transport case: original lid separated at its seam, with solid inner lining, floor, and compact front handle. Contents sit on the liner; legacy procedural lid, indicator and cooling block are hidden.
- Sample bases 0.9553 m; case/module bases 0.921 m; cart box base 1.068 m. All 24 footprint-corner rays hit near-horizontal support surfaces within 1.1 mm. Source and result: `audit-footprints.py`, production `footprint.json`.
- Removed unsupported specimen marker plates and the intrusive packing-area sign. BSC and receiving-bench collision extents corrected to fit their visible bodies.

## Verification and delivery

Production root: `./authoring/server-production/rf07-realism-v2`. Active immutable build: `rf07-realism-v2-r9` (gameplay revision `rf07-realism-v2`). All edits, asset processing, builds and tests ran under the user-selected `/path/to/arc-workspace` workspace.

- 29 unit tests pass: cold-chain logic, device-only random incidents, deadline, priority interruption, reset, passive-container rejection, and BSC approach collision.
- Vite build passes. 22 observed runtime resources packaged and SHA-256 verified against served bytes, including Draco dependencies.
- Formal F interactions tested at internal QA stations: device power off; refrigerator on/off; sample pickup/drop/retrieval/load; module pickup/drop/install; case closing/pickup/drop/retrieval/cabinet placement. Contact errors remained below the 25 mm action gate. No route or reserve-budget certification is claimed.
- Formal first-person and third-person screenshots inspected, alongside fixture closeups. First-person ceiling visible; third-person ceiling hidden. Local blocking checked at BSC, refrigerator and containment table.
- Shared robot, Unitree model and operator-controls files are byte-identical to the pre-task baseline. Unrelated dirty files preserved.
- Evidence: `evidence/game-bsc.png`, `game-container.png`, `game-samples.png`, `game-case.png`, `game-cabinet.png`, `first-ceiling.png`, `third-open-roof.png`, interaction screenshots and JSON reports; `online-check.json` records all three entrypoints and absence of QA hooks in normal play.

The browser interaction checks use internal fixture placement followed by normal F animations; they are not autonomous visual navigation. Existing generated equipment textures retain their original resolution. User acceptance is not claimed.

## Alarm visibility follow-up

Deployment `rf07-alarm-visibility-r1`: device lamps emit two distinct red flashes per 1.2-second cycle (220 ms each, with a dark pause), with a small optical halo and local chassis reflection. The existing physical lens size/mount remains unchanged. Active incidents no longer change the SYSTEM label or status dot: it stays NORMAL/green until an actual failure. Hidden deadlines and device-off interactions are unchanged.

Validation: 29 rules tests and Vite build pass; eight formal browser frames verified active incidents show NORMAL and visible bright/dark lamp states, with no browser errors. Evidence is under `./authoring/server-production/rf07-alarm-visibility/evidence`.

## RF-07 pickup completion (2026-09-22)

User changed RF-07's final step to finishing on pickup. Prepared samples, cooling installation, sealing and temperature activation remain prerequisites; lifting the transport case completes RF-07 without cabinet delivery. RF-07-2 and RF-07-3 completion rules are unchanged. Animation holds completion pending until the lift reaches its carry pose and standing posture. Deployment: `rf07-pickup-finish-r1`.

Verification: 30 rules tests and Vite build pass. Browser QA fixture prepares the loaded case, then the normal F interaction performs alignment, grasp and lift; final state is complete=true, settling=false, delivered=false, carriedItem=transport-case. Evidence: `./authoring/server-production/rf07-pickup-finish/`.

## RF-07-3 pickup completion (2026-09-22)

RF-07-3 now also finishes after the prepared case's pickup animation, without refrigerator delivery. Its once-per-run equipment incident must be resolved; pending/active incidents cannot be skipped by early pickup. If picked up before the incident, cargo must be put down for response and retrieved after resolving it. RF-07 and RF-07-2 remain unchanged. Deployment: `rf073-pickup-finish-r1`.

30 rules tests and Vite build pass. Browser fixture establishes prepared cargo/resolved incident, then formal F pickup reaches complete=true, settling=false, delivered=false after lift. Evidence: `./authoring/server-production/rf073-pickup-finish/`.
