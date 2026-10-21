# RF-06 Cardinal Realism Brief

## Scope and frozen contract

- Rebuild the complete RF-06 level to the RF-01 realism standard, not only a static showcase corner.
- Keep the leak-response state machine, rewards, failure rules, movement, interaction order and completion condition unchanged.
- Keep all task coordinates, room bounds, collision rectangles, player envelope and the first/third/dual-view contract unchanged unless a visual QA failure proves that a camera-only correction is required.
- Retain the current 10.8 m x 8.0 m compact Chinese apartment layout and 2.75 m ceiling height.
- Keep programmatic architecture for exact walls, openings, counters and collision. Cardinal assets are visual meshes and are never authoritative collision.
- Replace a legacy object only after its Cardinal replacement has loaded successfully.
- Reuse the same Cardinal GLB for room, carried, dropped, placed and returned states of each interactive tool.

## Place, use state and visual direction

RF-06 is a contemporary, owner-occupied urban Chinese apartment in normal daily use. The scene is clean and maintained, but not a showroom. Materials should show restrained household wear: faint floor traffic, small cabinet fingerprints, subtle metal scuffs and realistic fabric variation. Do not introduce abandoned, disaster, construction, luxury-hotel or science-fiction styling.

Lighting is soft daytime window light with warm-neutral interior fill. Materials use physically plausible response without neon bloom, baked shadows, outlines, readable labels or floating UI. The top remains open for the fixed third-person overview, while first-person surfaces must hold up at close range.

## Surface plan

| Surface | Treatment | Runtime intent |
| --- | --- | --- |
| Living/dining floor | Cardinal seamless oak base color plus derived normal and roughness | Warm matte engineered oak planks at plausible board scale |
| Kitchen/utility floor | Cardinal seamless anti-slip porcelain tile plus derived normal and roughness | Light neutral tile, fine grout, no baked perspective |
| Walls | Cardinal seamless warm-white painted plaster plus derived normal and roughness | Low-contrast roller texture and subtle microvariation |
| Kitchen cabinetry | Retain exact procedural geometry; retune PBR materials | Matte warm-gray fronts, stone worktop, stainless sink |
| Glass and metal | Retain exact geometry; retune roughness/transmission | Controlled reflections with no black transparent planes |

All texture prompts require orthographic views, even neutral illumination and matching opposite edges. Large surfaces must tile instead of being replaced with 3D slabs.

## Cardinal model batch

| Asset | Target dimensions (m) | Placement rule | Front direction in source |
| --- | ---: | --- | --- |
| Sofa | 2.35 x 0.94 x 0.90 | Four feet on floor, back toward south wall | +Z |
| Dining set | 1.90 x 0.88 x 1.81 | All chair legs and table legs on floor | +Z |
| Coffee table | 1.16 x 0.45 x 0.62 | Four feet on rug/floor plane | +Z |
| TV console | 1.85 x 0.56 x 0.42 | Back flush with TV wall | +Z |
| Refrigerator | 0.82 x 1.85 x 0.75 | Feet on kitchen tile, door toward room | +Z |
| Washing machine | 0.64 x 0.85 x 0.66 | Feet on utility tile, front service clearance | +Z |
| Shoe cabinet | 1.32 x 1.05 x 0.35 | Back flush with east wall | +Z |
| Entry bench | 0.78 x 0.46 x 0.38 | Four feet on floor | +Z |
| Utility cabinet | 0.72 x 2.10 x 0.72 | Base on floor, back flush with north wall | +Z |
| Wall air conditioner | 0.90 x 0.29 x 0.21 | Rear mounting plane touches wall; never floor-aligned | +Z |
| Tool rack | 0.72 x 1.50 x 0.22 | Base on floor, back flush with east wall | +Z |
| Wrench | 0.32 x 0.046 x 0.119 | Bottom contact for room/drop poses | +Z |
| Bucket | 0.36 x 0.275 x 0.334 | Circular base on floor at all world poses | +Z |
| Mop | 0.58 x 1.35 x 0.18 | Mop head on floor; handle rises upward | +Z |
| Shutoff valve | 0.28 x 0.225 x 0.197 | Flat rear mount against under-sink pipe plane | +Z |

Every model request specifies Y-up, +Z front and bottom-center pivot. Generated environment, floor, wall, pedestal, character, hands, robot, floating parts, readable text, logos and baked lighting are forbidden.

## Orientation and contact acceptance

For each source GLB:

1. Render front, right, rear, left and top review views before runtime normalization.
2. Confirm the semantic front and record any corrective Y rotation.
3. Remove cameras, lights, detached environment fragments and empty nodes.
4. Move the horizontal bounds center to X/Z origin and the lowest intended support point to Y=0.
5. Fit to the target meter dimensions in the corrected parent coordinate system.
6. Re-read the runtime GLB and assert final bounds, Y-up, bottom contact and finite transforms.
7. Reject and regenerate models with sealed openings, unusable silhouettes, baked room surfaces or irreparable front orientation.

Wall-mounted assets use an explicit mounting offset after bottom normalization. The air conditioner and valve are checked against their wall/pipe contact planes rather than treated as floor props.

## Gameplay and collision

The existing `LEVEL.staticColliders` remain authoritative. Cardinal furniture is fitted inside the frozen collider footprints. The kitchen doorway, utility doorway and south entrance must remain open. The tool rack remains solid, the carried item has no world collision, and returned tools remain visible.

## Performance and fallback

- Preserve source high-poly GLBs separately from browser runtime GLBs.
- Runtime models use embedded textures and browser-supported compression.
- Keep the existing environment as a fallback. Hide named legacy furniture only for successfully loaded replacements.
- The original 40 MiB RF-06 contract applies to the legacy environment bundle. The Cardinal realism bundle is measured separately and optimized before final review.
- Record request file, task ID, source/runtime hashes, final dimensions, front correction, pivot and review status for every asset.

## Visual acceptance route

1. Third-person start overview: all room zones readable, no white-model furniture, no detached assets.
2. First-person entrance: wall/floor texture scale and close-range contact shadows hold up.
3. Walk to tool rack: rack back touches wall; wrench, bucket and mop have correct initial orientation.
4. Walk to sink: refrigerator, counters and floor are grounded; valve is mounted under the sink.
5. Complete valve, bucket, mop and return sequence: the same GLBs persist across every state.
6. Inspect all door openings and furniture edges for air walls, clipping and inaccessible targets.
7. Repeat third, first and dual views at desktop and a 390 x 844 mobile viewport.
