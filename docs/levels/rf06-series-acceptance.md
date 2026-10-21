# RF-06 series acceptance
Date: 2026-09-21. Release: rf06-series-v1-r6. Stable entry: port 4173, /?mode=play&level=rf06 (or rf06-2 / rf06-3).
User acceptance is not claimed.

## Verified
- 28 tests: original RF06 behavior/assets, fixed/growing water, removal of obsolete capacity engine, two insects, 100k samples of 80/20 uniform semicircles, frame independence, 10k collision steps, immediate-hit short bursts, range/angle/occlusion, shared wall/door/shelf collisions.
- Isolated Vite production build succeeded (large-chunk advisory only).
- Formal in-app browser r6: RF06 and RF06-2 robot-only station action sequences passed, including wrench pickup, valve, tool return, bucket pickup/placement, mop pickup, cleaning and return.
- Formal RF06-3: actual can pickup (contact error 0.02057 m), two actual shots / two kills, completion after final burst. No insect movement or kill-state injection.
- First/third views inspected. First sees ceiling and fixtures; third is open roof. Held can inspected in production rendering; the 180 ms burst and expiration were verified in engine and real-action state checks.
- G1 foot measured about 0.2085 m long, 0.0762 m wide; insect body 0.06 m and full length about 0.098 m.
- Single active in-app test measured about 60 FPS. Multiple tabs/background load reduced performance; server software-rendering FPS is not a desktop performance result.
- 14 asset HTTP SHA256 hashes match source manifest. Robot model code, shared controls and original scene byte hashes match task baseline.

## Evidence
Server directory: ./authoring/server-production/rf06-series-v1/evidence/r6.
first.png, third.png, dimensions.json, http-assets.json, held.png and interaction.json. Burst screenshots record the short-spray feedback; they are not a reliable freeze-frame of the 180 ms particles.
Earlier r1-r5 images are historical and are not release evidence.
QA is opt-in via rf06qa=1, uses privileged robot station setup only. This is local interaction/collision acceptance, not unprivileged navigation or full-route certification.

## Scope and dependencies
Old RF06-3 capacity, wringing, pouring, drain visuals and public r1-r5 previews were removed. Nonpublic rollback archives remain. Shared bucket/tools remain because RF06/2 use them.
Cockroach uses a compact procedural segmented mesh, Cardinal supplies insecticide and replacement bucket. No claim that the small procedural insect is a photographic scan.
G1 animated F / velocity control is the validated mode; R1 and direct 29DOF manipulation are outside this acceptance.
Task runs on a pre-existing modified deployment checkout, including its shared interaction hook. Task commit e54ae00 excludes unrelated changes. A later screenshot-helper correction uses a verified walkable station and avoids pausing the browser compositor. No push.
