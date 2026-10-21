# RF-04 series v1
User approved v0.1 on 2026-09-20. Automatic production and deployment on the user-selected server, root /path/to/arc-workspace; authoritative project arc-game, Vite PID 4146057 port 4173 verified.
- RF-04: retain collect / wash / unload / hang completion.
- RF-04-2: same laundry cycle, 8-second accelerated drying, store shirt/pants/towel in three labeled open compartments.
- RF-04-3: same storage plus continuously moving vacuum; catch with F, carry with manual movement, F to return to dock; either order.
- Same geometry, assets, colliders and object inventory for all three. Vacuum docked in first two.
- F uses local collision-constrained step alignment, animated reach, carry and release. No rigid-body grasp. No robot model, skeleton, initial pose, camera or control edits.
- Reuse RF-04 home and Cardinal laundry/beds/textures. Cardinal high-highpoly vacuum, precision Blender storage and docking hardware. Asset generation/necessary rework authorized; do not report costs.
- Desktop browser target 30 FPS. Measure rather than assume.
- Tests use internal station placement plus real interaction animation; local collision checks only, no full navigation or reserve calibration.
- Versioned assets and rollback in production/rf04-series-v1. Preserve all baseline changes. Task-only commit after checks; no push without applicable authorization and safe remote history.
