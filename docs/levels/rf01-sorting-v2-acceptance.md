# RF-01 sorting v2

User-authorized refinement on 2026-09-19, implemented only in `.` on the selected server. Revision `rf01-sorting-v2`. Original Cardinal assets remain immutable in `rf01-sorting-v1`; no new generation.

- Line equipment uniformly scales to 80%: two belts now total 3.2 m, belt top 0.798 m. Infeed and scanner scale together, with matching collision boxes.
- Sorting cages uniformly scale to 85%: 0.697 × 1.462 × 0.952 m after rotation. The support decks are at 0.3035 m; the largest parcel still fits the deck.
- Remove both dispatch rectangles, three cage floor diamonds, four legacy parking stripes and two gate lane markings. Keep physical obstacles, floor surfaces and parcel/cage identification labels.
- Conveyor starts with power, independently of lighting. Parcels loop at 0.7 m/s between x=-1.3 and x=1.3; held/sorted parcels are excluded. Lighting remains necessary for picking, sorting and RF-01-3 completion. Completion/failure still freeze state.
- All three RF-01 variants share these changes. Robot, camera, control mappings and locomotion remain unchanged.

Current phase: deployed. All requested refinements passed functional and visual checks. 53 related tests passed; decoded GLB scale, support and runtime/build/served-byte audit passed; build passed. Pre-edit task files are preserved at `./authoring/server-production/rf01-sorting-v2/baseline`.

The full suite currently reports 436 tests, 412 passing and 24 failing: the same 14 previously reproduced failures plus ten RF-02-2/3 cart/route failures in unrelated source. RF-02 files were not edited for this refinement. Automatic commit is withheld under the repository rule.

Development-server reloads interrupted two browser runs after partial successful sorting/lighting. Those runs are diagnostic only. Final QA uses a fixed copy of the successful build at `/rf01-sorting-build-v2/index.html`, through `/rf01-sorting-v2-build-qa.html`. This serves the compiled production game without the Vite HMR client and uses the same API and immutable asset URLs. Build files are generated server artifacts, excluded from any source commit; the 78-file hash inventory is `production/rf01-sorting-v2/build-snapshot.json` outside the repository.

This record supersedes v1 dimensions and conveyor gating; v1 screenshots remain historical evidence only. User acceptance is optional and not requested.

## Final browser evidence

- Successful fixed-build run: `data/recordings/1789809336046-rf01-sorting-v2-qa.json`. Thirteen formal screenshots and the full trace are served at `/rf01-sorting-evidence/v2/`; the gallery is `/rf01-sorting-evidence/v2/index.html`.
- All three parcels sorted, power/lighting/entry true, complete true and failed false. Ten interactions, distance 72.736482 m, final reserve 53.634200, minimum 50.634200. No teleport, task-state injection or collision bypass.
- Stationary motion pair: each parcel advanced 0.54789 m between screenshots 05 and 06. Both images were opened and inspected; positions visibly move along the smaller belt while supported at y≈0.79794 m.
- Formal screenshot 01 confirms outdoor parking/gate/dispatch marks are absent. Shared scene preview confirms the interior diamonds are absent and smaller equipment leaves open walking space. Formal screenshot 08 confirms the smaller cage supports its delivered parcel.
- Saved first-person cadence sample: 39.3 FPS at 1280 × 820. This is one observed configuration, not a universal or 1080p guarantee. No robot/camera/control changes; ten protected file hashes still match the initial baseline.
- Reproducible engine route remains 71.284956 m, final/minimum 49.715044/46.715044; with three injected errors 34.715044/31.715044. Initial/max reserve 100, active movement 1/m, blocked attempts 2/s, errors 5, first milestone reward 3.
