# RF-11 Layout

| Item | Position (m) | Size (m) | Orientation |
| --- | --- | --- | --- |
| Workshop | `[0, 0, 0]` | `24 × 4.2 × 16` | Y-up, front `+Z` |
| Robot alpha | `[-7.2, 0, 5.5]` | G1 envelope | yaw `0` |
| Robot beta | `[7.2, 0, 5.5]` | G1 envelope | yaw `π` |
| Servo pump case | `[0, 0, 3]` | `0.9 × 0.48 × 0.64` | bottom-center |
| Safety door | `[0, 0, -1]` | clear width `3.2` | south wall |
| Assembly base | `[0, 0, -5.15]` | `3.4 × 0.18 × 1.8` | floor anchored |

The visual environment, collision proxy and all interactables share origin, scale and orientation. The collision GLB is hidden and static colliders remain explicit in `level.js` so the safety-door opening stays traversable.
