# ARC Level Production Harness

This harness is the repeatable gate for RF level production. It is independent of a specific theme so the same sequence works for a Chinese home, laboratory, hotel, library, or logistics scene.

## Commands

- `init` creates standard asset directories, a manifest scaffold, and a layout scaffold without overwriting existing files.
- `validate` verifies GLB headers, embedded textures, mesh presence, compression declarations, duplicate paths, declared dimensions, and the runtime byte budget.
- `layout` verifies meter-space bounds, collider rectangles, stable IDs, and interaction points.
- `preview` creates a clean no-HUD browser page. The level preview module must set `window.__ARC_PREVIEW__.requiredAssetsReady = true` only after all required assets have loaded.
- `gate` blocks promotion until human visual review, reference match, first/third/dual view screenshots, browser console, tests, build, generator success, and asset validation all pass.

## Asset contract

Use `public/local-assets/levels/<level>/models/runtime/` for only the currently referenced final GLBs and manifest. Keep source high-poly files, request payloads, candidate models, screenshots, and generator logs outside the web runtime directory. The manifest must use `arc-level-assets/v1`, meters, Y-up, and an explicit visual and collision environment.

## Human gate

Automated checks prove file integrity, not realism. A person must inspect screenshots for Chinese household plausibility, scale, placement, orientation, grounding, material response, openings, and air-wall absence. The result stays blocked until all three view modes pass.

## RF-12 execution

For RF-12 the order is: approve the kitchen gameplay brief, build the graybox, run engine tests, generate the environment and independent interaction assets with Cardinal or EmbodiedGen, normalize and review them in isolation, update the manifest, run this harness, then perform browser screenshot acceptance. Only after that can the same scene be integrated into the normal game page.
