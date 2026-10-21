# RF-11 clinic series v1
Status: production
User authorization: RF-11-02 low; RF-11 medium unchanged objectives; RF-11-03 high dynamic 6 requests in 3 pairs; final pair urgent request with hidden 90 second hard deadline. F local walk and action animation. Same scene and assets.
Protected current bytes: baseline.json. No shared robot or camera edits.
Visual, animation, collision, deployment checks: pending.

Engine checks: 7 passed (low, medium, randomized dynamic waves, invalid delivery, exact 90s boundary, reset, local wall blocking). Existing RF13 realism: 4 passed. Build r1 passed.
Scene assets reused from realism-v0.4.3; verified manifest flags old carry contact as failed, so this task independently checks new animation. Supplies shifted 0.15m toward counter front; delivery/return support offsets 0.20/0.18m.
Cardinal chime task aigc_1a522948d64744c2b74479db870a2cdb completed and downloaded.
Animation evidence so far: gauze pickup 0.0292m max hand contact error, local walk 0.112m. Other new positions pending retest.

Browser r4: trolley moved 1.8505m, contact error .00124m; chair moved .9498m, contact .00853m; empty box pickup .03408m, held error .00445m. Return test fixture chose back of counter and triggered floor drop; fixture corrected to front and return pending.
First-person ceiling visually confirmed; third-person cutaway visually confirmed. r2 low completion confirmed after terminal recovery. r2 high urgent boundary fixture (89s elapsed) failed with visible urgent-specific failure, no countdown on request panel. Engine exact 90s test passes.

Browser r6: gloves pickup .02952m, delivery .03450m, empty pickup .03345m, empty return .03224m; held error .0034m. Return visibly supported on original counter in first person. Version r6 keeps validated r4 trolley/seat movement; only reduced local approach detour, continuous chair yaw easing, clock contact check and floor-drop target differ.
HTTP: 13 GLB/audio files match source hashes. Frozen seven robot/camera/control source files match baseline.

Concurrent unrelated RF14 tennis modifications appeared in game/app.js, index.html and vite.config.js during task. Preserve in working tree; stage clinic-only index blobs at commit. No other changes are ours.

## 2026-09-23 latest requirements — r12
Latest rules supersede the earlier 90-second deadline: every dynamic request has a 120-second hard deadline, all request publication times are at least 60 seconds apart across waves. Extra request HUD removed; front-desk lamp physically supported at x=4.3,z=2.31 with base bottom y=.90, clear of monitor/folders/cargo. All modes use 1.5 movement drain/sec and 5 interaction cost. 16 tests/build pass; 13 asset hashes and seven protected files verified. r12 browser first/third-person, lamp support, pickup, held wall collision and actual deadline failure checked. Screenshots and telemetry: evidence-r12/. Scope remains fixed-position G1 velocity-control functional testing, no route or budget calibration. Task-only Git commit pending; unrelated kitchen staging preserved.

Completed: deployed rf11-clinic-series-v1-r12; Git commit 1c025549c42b7230966e12d8a5f219d90a13839b. No push performed. Other tasks' working tree and staged changes preserved. User acceptance not claimed.
