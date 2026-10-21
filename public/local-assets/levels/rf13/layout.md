# RF-13 Graybox Layout v0.2

- Scene: contemporary Chinese urban community clinic.
- Bounds: 14 m × 11 m × 2.8 m clear height; Y-up, meter units.
- Start: [0, 0, 4.5], facing south toward reception.
- Route: supply counter at z=-2.15 → exam-a (-4,1), exam-b (-1.3,1), treatment (2,1), front desk (4.5,3) → waiting chair (-4.5,3.8) → aisle obstacle (2.8,4.2) → opening terminal (5.2,4).
- Graybox objects: walls, open entry, counter, four stations, front desk, chair, obstacle, terminal, four supply models.
- Collision: explicit `LEVEL.staticColliders`; visible graybox remains diagnostic until graybox approval.
- Robot contract: shared model, D435, camera, controls and locomotion unchanged.
