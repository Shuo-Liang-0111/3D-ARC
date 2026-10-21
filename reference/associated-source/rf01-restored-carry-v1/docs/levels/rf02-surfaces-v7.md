# RF-02 shared surface materials v7

RF-02, RF-02-2 and RF-02-3 share warm off-white painted plaster walls and 600 mm mineral-fiber acoustic ceiling textures. Cardinal supplies source images; the preparation script creates matching micro-normal and roughness maps and a restrained ceiling T-grid. Wall texels cover 1.2 m, ceiling modules 0.6 m. Images are embedded in versioned GLBs. Single-sided ceiling rendering retains the overhead cutaway.

The task changes materials and UVs only. Re-import verifies all original node bounds within 0.1 mm; collision GLB and level layouts are unchanged. First-person and overhead game screenshots were viewed; source/release/live hashes match. Syntax checks and production build passed. No route, reserve-sufficiency or unrelated control tests were run under the revised user scope.

Production: library-surfaces-v7, ./authoring/server-production/rf02-surfaces-v7/release, port 4192. Rollback: rf02-interactions-v6/release-r2. Evidence and source textures stay under the task directory. Asset metadata: rf02-surfaces-v7.json.

The shared working tree contains unrelated edits and an existing untracked series-scene.js. This commit stages only the task-owned tracked-source hunk, new surface module, material tooling and records. tools/rf02-series/surface-integration.patch records the exact applied import/ceiling-URL change to the untracked scene without absorbing its prior implementation. It is already applied in the working tree; do not apply twice.

To preserve other deployed behavior, stage-surface-release.mjs assembles from the verified prior release, substitutes only two material asset URLs and regenerates six affected bundle names and parent references. The full source build is retained as validation and is not deployed wholesale over other work. No robot, camera, gameplay, input or collision change is included.
