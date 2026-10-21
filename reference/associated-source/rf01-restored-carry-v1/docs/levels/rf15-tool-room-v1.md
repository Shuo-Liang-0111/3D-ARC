# RF-15 tool room v1

## Scope and implementation

The RF-15-1 / RF-15-2 / RF-15-3 variants share the rebuilt northern tool room at x=-7..-1, z=-14..-10. The earlier southern shelf/door overlay has been removed. The original background building faces are removed from a cloned runtime mesh only after the replacement assets load successfully; the source environment GLB is preserved.

The room has textured plaster walls, a concrete floor, an independently hinged plank door, metal hinge pins/straps/lever handles, a corrugated roof and downpipes, a wooden workbench with steel legs, wall hooks, storage bottles and hoes. The harvest knife, concave hand trowel and pressure sprayer are independently load-gated GLBs. Assets were produced with Blender and reused embedded RF15 PBR textures; no new Cardinal generation is claimed.

The 1.7 m doorway is closed on reset. F near the handle opens or closes the door. Door animation and collision use the same angle. The conservative swing check rejects opening/closing when the robot occupies the swept region. Tools can only be taken from inside the room with the door open. F at the original tool position returns the tool; selecting another tool exchanges it. Cargo uses the same tool model as the bench. Hand harvesting remains available; this change does not add a tool prerequisite to RF-15-1.

The northern walkable boundary is extended to z=-15.2. A tested route goes around the eastern end of the main shed wall at x=2.8 and along the alley to the tool room. The shared robot, camera and control code are unchanged.

## Validation

- Node regression suite: RF-15 tool room across three variants, RF-15-1 harvesting and existing RF-15 wall regressions.
- Coverage: continuous updateMovement route from the original spawn, closed-door blocking, opening, entering, taking/returning both tools, sprayer pickup, exit and closing; wall pickup rejection, occupied doorway closure, reset.
- Blender GLBs: embedded image bufferViews and textured materials verified; five GLBs have identical source, build and served HTTP SHA-256.
- Production build uses the existing emptyOutDir=false convention; existing chunk-size warning remains.
- Formal RF-15-1 browser route uses the existing Agent actions via qa=tool-room, with no teleportation or direct state injection. Door-open first-person screenshot shows a clear opening and furnished room. Knife/trowel pickup is confirmed by HUD, scene source removal and toolRoomState.
- The shared third-person overview retains its fixed framing; it is not a close-up interior camera. First-person is used for the interior checks.
- Verification artifacts and baseline backups are outside Git under ./authoring/server-production/rf15-tool-room. Large GLBs remain server-side under public/local-assets/levels/rf15/tool-room-v1.
- Final formal-browser run: all five QA stages passed with MuJoCo online and worldAssetErrors=[]; harvest-knife and hand-trowel appeared in held state in sequence. After returning both tools and exiting, toolRoomOpen=false and toolDoorAngle=0 at x=-2.622, z=-9.196. First-person screenshots show the open doorway, workbench, tool board, wood grain and textured concrete floor.
- The normal F interaction button was also used to reopen the door while stationary (angle=-PI/2) and close it again. Node regression suite passed 11/11; production build passed with the existing chunk-size warning.

## Recovery

Build assets once with:
`blender -b -t 4 --python tools/rf15/build-tool-room.py -- <project-root>`

The asset script refuses to overwrite an existing generated version. The three variant scene modules all re-export the same shared-variant-scene.js. Query qa=tool-room adds an internal five-stage route panel; it is absent from normal gameplay URLs.

### Runtime fixes found during acceptance

- Door motion originally ran only inside movement updates. The optional environment tick in game/app.js now advances the door every animation frame while the level is active, including idle and Agent WAIT with MuJoCo online. Visual angle and collision remain synchronized.
- Old-building triangle removal now tests the average triangle height after checking every vertex against the building footprint. Requiring all vertices to be above the floor left the original vertical walls across the new opening.
- The WebSocket gateway could retain an upstream connection when its browser disconnected before the upstream handshake completed. It now terminates connecting upstreams and closes late arrivals. The existing gateway service was restarted; five connect/close cycles followed by a fresh hello handshake passed, and the formal browser reported MuJoCo online.
- The browser QA route accounts for the current robot heading and the standard forward/backward/lateral speed limits, and corrects lateral deviation along each corridor. It invokes existing Agent movement/interaction actions without changing game state directly.
