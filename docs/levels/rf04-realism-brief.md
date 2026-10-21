# RF-04 Cardinal Realism Brief

## Status

- Scope: highest-quality vertical slice before full-level expansion
- Asset status: `runtime_candidate`
- Region: modern urban Chinese apartment
- Operating state: normal daytime use, clean but lived-in
- Visual priority: realism first, restrained household wear, no sci-fi language
- Gameplay authority: `game/levels/rf04/engine.js` and `game/levels/rf04/level.js`

## Frozen Gameplay Contract

- Keep the collection, loading, washing, unloading, and hanging sequence unchanged.
- Keep reserve costs, rewards, failure, completion, interaction ranges, and all task coordinates unchanged.
- Keep first-person, third-person, and dual-view camera positions, FOV, controls, and clipping contracts unchanged.
- Keep the G1 player envelope and the existing static collider layout authoritative.
- Preserve the visible washer states: stopped/neutral, rotating/blue, and complete/green.

## Vertical Slice

The slice follows the complete playable route from the three dirty clothes in the living room to the washing machine and then to the balcony drying rack. It includes:

- one Cardinal front-loading washing machine;
- one Cardinal double-bed GLB cloned into the four preserved bedroom placements;
- one repeatable Cardinal drying rack structure;
- independent Cardinal shirt, pants, towel, and wet-laundry bundle assets;
- nearby floors, walls, contact shadows, and route-facing furniture surfaces;
- the same asset appearance before pickup, while carried, after dropping, and at the destination;
- browser verification in first-person, third-person, and dual views.

The accepted EmbodiedGen roofless apartment shell remains the structural base for this slice. It may be replaced only after a later full-home review. The current material-color restoration, generated-node filtering, and playable-bounds cleanup are preserved as baseline work.

## Asset Strategy

| Asset | Role | Strategy | Target size |
| --- | --- | --- | --- |
| Washing machine | dynamic target | Cardinal high-highpoly, isolated GLB | 0.65 × 0.85 × 0.65 m |
| Drying rack | repeatable dynamic target | one Cardinal rack GLB with runtime clothing states | about 3.3 × 2.2 × 0.45 m |
| Shirt | interactive cargo | Cardinal isolated cloth GLB reused across world and cargo states | longest dimension about 0.62 m |
| Pants | interactive cargo | Cardinal isolated cloth GLB reused across world and cargo states | longest dimension about 0.85 m |
| Towel | interactive cargo | Cardinal isolated cloth GLB reused across world and cargo states | longest dimension about 0.72 m |
| Wet bundle | interactive cargo | Cardinal isolated folded wet-cloth bundle | longest dimension about 0.85 m |
| Double bed | static furnishing | one Cardinal PBR GLB cloned after load; original beds remain as failure fallback | 1.65 × 1.05 × 2.10 m |
| Apartment shell | static environment | preserve accepted EmbodiedGen geometry; improve materials and lighting | existing meter space |
| Large surfaces | static materials | CC0 or Cardinal seamless PBR textures where needed | tiled in meter space |

Cardinal visuals never become authoritative collision. Runtime colliders, task coordinates, and interaction proxies remain explicit project data.

## Material And Lighting Direction

- Warm neutral daylight with believable window direction and soft interior fill.
- Warm oak or engineered-wood living-room floor, muted ceramic utility-area surfaces, off-white plaster, restrained dark metal and charcoal accents.
- PBR response must distinguish enamel, rubber, smoked glass, steel, plastic, fabric, wood, and ceramic.
- No neon, holograms, baked UI, readable generated labels, logos, oversized bloom, or excessive grime.
- Contact shadows and ambient occlusion may reinforce grounding but must not hide floating or intersecting geometry.

## Dynamic-State Rules

- The Cardinal washer shell remains visually stable across loading, washing, and complete phases.
- Runtime-only meshes or material regions provide drum rotation and neutral/blue/green indicators.
- The same clothing GLB is reused on the floor, in cargo, after dropping, and when hung whenever the state permits.
- The drying rack structure remains the same asset; empty/loaded differences come from clothing visibility rather than a second unrelated rack.
- New assets hide their existing fallbacks only after successful loading.

## Performance Budget

- Desktop third-person target: 60 FPS.
- Dual-view target: at least 30 FPS.
- New runtime assets for the first slice: approximately 60 MB maximum.
- Record triangles, materials, texture count, runtime bytes, first-load time, cached-load time, and both view-mode frame rates.

## Current Cardinal Expansion

- Seven runtime GLBs are active: washing machine, drying rack, shirt, pants, towel, wet-laundry bundle, and one double bed cloned into four locations.
- The six newly approved `high-highpoly` expansion models use bottom-center pivots, calibrated meter dimensions, WebP-packed runtime textures, and isolated procedural fallbacks.
- The same drying-rack GLB is reused for empty and loaded states; the same three garment GLBs are cloned for their floor and hanging states.
- The living-room and bedroom floors use the approved 2048 × 2048 warm-oak Cardinal texture with sRGB sampling, 1.92 m world-space tiling, and 0.78 roughness.
- The bed source is normalized from a `-X` headboard to `-Z`; all four original `BedFactory` nodes remain visible until all four Cardinal clones load successfully.

The current runtime payload is 42,517,308 bytes in decimal units: 37,063,600 bytes for the seven GLBs plus 5,453,708 bytes for the floor texture. This is below the 60 MB vertical-slice budget. Successful expansion assets cost 33,300 Cardinal tokens: the earlier 27,800-token batch plus 300 for the accepted bed reference and 5,200 for its `high-highpoly` image-to-3D model. One annotated bed reference was rejected at the visual quality gate, bringing billed expansion work to 33,600 tokens; two text-to-model attempts failed before creating upstream tasks.

## Acceptance Matrix

- No console errors or asset-load warnings.
- No text baked into Cardinal surfaces.
- Correct meter scale, front axis, bottom-center pivot, ground contact, and wall clearance.
- All three clothes remain reachable and retain their current interaction behavior.
- Washer drum and indicator states remain visible to humans and AI screenshots.
- Drying-rack collision and balcony route remain aligned and unobstructed.
- Pickup, carry, drop, reload, unload, hang, completion, and reserve tests remain unchanged.
- Full automated tests, production build, and fixed browser screenshots pass before commit.
