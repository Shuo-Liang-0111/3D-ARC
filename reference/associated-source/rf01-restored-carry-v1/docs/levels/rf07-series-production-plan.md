# RF-07 series v1

Scope authorized in the current conversation on 2026-09-21. Server: 127.0.0.1, account chenhaoyuan, root /path/to/arc-workspace. Verified project .; Vite 4173 PID 4146057 at initial inspection. Credentials excluded. Mac checkout is control-only.

- RF-07-2: easy. Three cold cabinets start with one or two randomly off. F toggles power. All on completes the task.
- RF-07: medium. Existing A-17, C-04, B-12 sequence; cooling plate, seal, activate, deliver to cabinet 02.
- RF-07-3: hard. Same cold-chain task plus exactly one incident. Container/device chosen randomly, starts uniformly during the first 180 seconds (1–180 s). Hidden deadline 120 s from the alarm. Timeout fails. Both delivery and resolution required, even if delivery finishes before the incident.
- Incident blocks normal work. F puts held cargo down on nearby clear floor. It remains available for later pickup. Container: pick up and carry to the containment tray at the handwash station, F places it. Device: F presses power-off. Resolved incidents do not repeat.
- F runs local collision-aware stepping, reach, contact, lift/release and recovery; player controls travel between stations. State commits at contact/release; completion waits for standing recovery. No rigid-body grasp claims.
- Shared scene, same 24 x 16 x 3.3 m shell, equipment and objects for all three. Ceiling plus ceiling-mounted lights visible only in first person through prepareView. No camera/FOV/robot/skeleton/socket/controller edits.
- Reuse existing Cardinal assets and EmbodiedGen environment; no new Cardinal generation required. Add exact code-built ceiling, switches, indicator displays and supported containment tray. Existing metal equipment receives a neutral reflection environment. Case/plate move to the reachable front edge of the packing island in all three levels. Blender separates the reused refrigerator door and adds internal shelves; delivery opens it and places the case on the shelf. A front carry handle is added to the existing case.
- Desktop 1440x900 target, 30 FPS target; single hardware browser snapshot 31.6 FPS (H20, not a consumer-device benchmark). Source assets remain server-side and outside Git.
- Verification: unit state boundaries; internal test stations for formal F animation, contact and recovery; local approach/collision; actual browser first/third views. No full-route or reserve-balance claim.
- Candidate build and evidence: ./authoring/server-production/rf07-series-v1. Preserve original dirty work; scoped commit only after checks, no automatic push authorized in current user instructions.
