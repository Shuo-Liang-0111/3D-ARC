# RF-12 Layout

| Item | Position (m) | Size (m) | Orientation |
| --- | --- | --- | --- |
| Kitchen shell | `[0, 0, 0]` | `8.4 × 2.8 × 6.8` | Y-up, front `+Z` |
| Robot start | `[0, 2.82]` | G1 envelope | yaw `π` |
| Fridge / recipe card | `[-3.52, 0.3]` / `[-3.45, 2.45]` | full height | against west wall |
| Prep targets | `[-1.25, -1.28]`, `[-0.25, -1.28]`, `[0.75, -1.28]` | counter height | bottoms contact worktop |
| Stove / hood | `[2.35, -2.55]` / `[2.35, -2.68]` | `1.6 × 0.9 × 1.25` | hood mounted to north wall |
| Gas valve | `[3.62, -2.5]` | wall fitting | handle faces aisle |
| Trivet | `[3.15, -1.42]` | `0.45 × 0.05 × 0.35` | counter anchored |
| Safety terminal | `[-3.35, 2.72]` | `0.8 × 1.0 × 0.5` | front `+Z` |

The visual environment, collision proxy and interactables share origin, meter scale and Y-up orientation. The north prep aisle and south entrance remain clear for a G1 envelope.
