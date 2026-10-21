# RF-15 static-object and material revision v0.3.2

Active asset revision: `realism-v0.3.2`. This revision replaces conspicuous block props and restores embedded surface textures in the existing harvest → weigh → pack → load level.

## Delivered changes

- Six stacked solid crate blocks are replaced by fitted Poly Haven plastic-crate scans with open lattice sides, handles and worn surface detail.
- Three workstations now have separate timber or stainless tops, support rails, tube legs, adjustable feet, bolts and slatted lower shelves. Their interaction surface heights are preserved.
- The sink has a hollow pressed basin, faucet, drain trap, legs and splashback. The electrical cabinet uses a fitted scanned enclosure.
- Two pallets have individual boards, stringers and nails. Truck door hardware is aligned with the folded doors, and tread blocks follow the original wheels.
- The independent moving tail lift has a textured metal deck, small grip diamonds and fasteners. Packed cartons have paper-fibre texture and sealing tape.
- Wood, plaster, floor, asphalt, roof and metal export embedded base-colour, roughness and normal maps. Material revisions do not change the wall-shell geometry or collision GLB.

## Reproduction and provenance

Run `blender --background --python tools/rf15/real-materials.py -- <project-root>` with Blender 4.5.3 and the server's existing source assets. The script starts from `realism-v0.2.8`, refuses to overwrite an existing candidate, and exports all ten runtime GLBs into one new revision directory. Set a new revision in the script for a subsequent run, then update both the level revision and Vite asset allowlist after verification.

This pass uses Blender reconstruction and existing assets; it submits no new Cardinal generation jobs. Wood reuses the existing Cardinal oak image. Plaster and kraft reuse existing project images. Ground and roof reuse Poly Haven textures; plastic crates and the electrical enclosure use Poly Haven CC0 scans. Steel micrograin is deterministically baked with seed 15. The candidate manifest records source paths and hashes. Derived roughness and normal maps are generated from colour images where independent scanned maps are unavailable.

All GLBs and generated texture files remain on the production server and are excluded from this source commit. The collision GLB is byte-identical to v0.2.8. Existing produce, scale, pallet jack and tree assets remain in the complete runtime package.

## Verification

- `node --test tests/rf15-materials.test.mjs tests/rf15-wall-assets.test.mjs tests/rf15-harvest.test.mjs`: 12/12 pass, including texture embedding, ten manifest hashes, unchanged collision bytes, wall geometry, loaded/empty robot wall blocking and the engine's complete harvest route.
- `node --check game/levels/rf15/scene.js`: passes.
- `npm run build -- --emptyOutDir false`: passes; existing bundle-size warnings remain.
- SHA-256 matches across source, build output and public HTTP response for all ten runtime GLBs.
- Formal browser game reports `levelRevision=realism-v0.3.2`, `worldAssetsLoaded=21`, `worldAssetsTotal=21`, `requiredAssetsReady=true`, `worldAssetErrors=[]`; captured browser error log is empty.
- Actual formal first- and third-person screenshots were inspected. Ground, roof, worktops, crates and lift render with materials. Close-up review inspected perforated crates, timber workstations, sink and truck lift; white ground and oversized black metal stripes from rejected internal candidates are absent.

The material review page is `/level-preview/rf15-material-review.html`. It provides orbit controls and five close-up viewpoints for inspecting the deployed package; formal gameplay remains the acceptance surface.

## Limits and lessons

The complete route was verified in engine tests; a new complete manual browser gameplay run was not performed for this material pass. The truck body still uses the existing modeled shell, and this report does not certify every scene object as photorealistic. Old embedded sign lettering is imperfect in the diagnostic preview; the formal scene supplies readable labels.

Re-imported GLBs can retain texture references with empty image payloads. Reload original image files before export and check embedded buffers afterward. Preserve metal environment reflections during preview; use fine baked grain rather than oversized striped diffuse images. Dynamic equipment must stay independent of static geometry, and every version switch must include the full runtime asset package and the build allowlist.

Production logs are retained outside Git under the task's production record directory as `materials-v032.log`, `materials-v032-tests.log` and `materials-v032-build.log`. Browser acceptance is recorded as agent verification; user acceptance has not been assumed.
