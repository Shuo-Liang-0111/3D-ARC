# RF-04 shared home revision — architecture and performance

Status: completed. User acceptance not yet recorded. Date: 2026-09-20.
Deployment: rf04-series-v2-r16; runtime scene revision: rf04-series-v2.
All three variants use the same scene, example garments, openings and collision geometry.
Project: .. Evidence: ./authoring/server-production/rf04-series-v1/evidence.

## Requested changes delivered

1. Main room portals widened: west bedroom 1.50 m, bathroom 1.40 m, east bedroom 1.55 m, dining/hall 1.50 m, laundry/dining 1.60 m. Lintels retained at 2.22 m.
2. Green sectional sofa removed from the imported home, including its children.
3. Shirt, pants and towel examples moved inside their respective storage bays. Each bay reserves separate space for task clothing; the release target now corresponds to the interior placement. Front-of-bay visibility checking permits reaching into the bay while body/cargo collision still blocks entering the cabinet.
4. Removed exported door/window proxy solids and the external entrance block. Removed 10 of 22 window assemblies, reducing the two crowded curved walls and closing unnecessary internal window openings. Removed openings are filled with wall geometry; retained window transforms are preserved.
5. Downward-facing ceilings follow the actual room floor polygons. They are visible from the first-person interior and backface-culled from the elevated third-person view. Camera positions, FOV, controls, robot mesh and initial pose were not modified.
6. Static home geometry reduced from 5,641,544 source triangles to 614,467 (including ceilings). Removed duplicate original beds/bed linen, retained the established Cardinal beds. Optimized seven repeated props: shirt/pants/towel ~18k triangles each, wet bundle 25k, bed 35k, washer 55k, rack 40k. Preserved existing materials/textures. Draco compression, frozen static transforms, 1024 shadow map, and removal of tiny-decoration shadow casting reduce rendering work.
7. Repaired five intended room connections, filled removed window openings, cleared non-manifold slivers left inside expanded doorways, and generated collision records directly from repaired wall geometry. The layout preserves bedroom/bathroom entrances and dining-to-laundry connectivity.

The optional doorway clarification received no further placement constraints during implementation; the stated main-entry layout was used.

## Verification

- 43/43 state/collision tests passed: test-r16.log. Includes a carried-vacuum envelope swept across all five widened portals at three lateral offsets.
- Final Vite release build passed: build-r16.log. Existing chunk-size warnings remain.
- Actual browser short moves passed at wall, cabinet and all five portals: rf04-r15-collision.json. Wall stops at x=-9.035; cabinet stops at z=5.945; every doorway crosses >1.2 m. Collision geometry is unchanged between r15 and r16.
- Formal animated laundry/storage sequence passed all 15 interactions at the new interior targets: rf04-r15-storage-results.json. Final storage target error 0.047054 m; correct task states and standing recovery. r16 only additionally optimizes the same prop meshes and removes the isolated entrance node; interaction code/targets are unchanged.
- Final first/third-person screenshots were visually inspected: rf04-r16-first.jpg, rf04-r16-third.jpg. Final sample placement inspected: rf04-r16-storage-first.jpg. Normal D435 low-head control was used to inspect the lower shelf; no camera override.
- Same browser, same first-person starting position, 300-frame samples: baseline r13 27.668 FPS; house-only optimization r15 43.026 FPS; final r16 59.958 FPS. These are short local samples, not a guarantee across devices or full routes.
- Nine new/optimized GLBs match source, release copy and HTTP SHA-256; r16-assets.json. Release HTML/manifest/JS also matched HTTP bytes.
- Protected robot, locomotion, shared movement and controls hashes remain unchanged.

## Scope and reproducibility

This remains fixed-point functionality, animation and local collision acceptance. Only the robot is placed at test stations; object/task states are not injected. No full navigation or reserve-budget route test is claimed. Earlier unaffected vacuum behavior is retained at 1.4 m/s.
Assets are under public/local-assets/levels/rf04/architecture-v3; unchanged storage furniture/vacuum are reused from series-v1. Release r16 contains its own asset copies, including its Draco decoder.
Production tools: refine-home.py repairs and decimates the home; package-architecture.py compresses the home and exports authoritative collision geometry; optimize-props.py exports lighter copies of the existing Cardinal props. No new Cardinal generation was needed.
Generated GLBs, environments, credentials, logs and screenshots remain outside Git. The task-only source commit preserves pre-existing decoder-path changes in scene.js as unstaged work.


## Doorframe follow-up

Current delivery is rf04-series-v2-r22 with architecture-v4 doorframe assets pinned under r20. See rf04-series-acceptance.md, “r22 solid doorframe repair”, for exact clear widths, closed-mesh audit, threshold repair, both-face/oblique screenshots and local collision evidence. This supersedes the r16 opening-edge treatment; the remaining shared architecture/props are retained.
