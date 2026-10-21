# RF-02 usability / library-operations-v5

Status: completed. Fixed release: ./authoring/server-production/rf02-usability-v5/release-r7. Deployed on the authorized port 4192, PID 1232588. Optional user acceptance is pending.

## Delivered behavior

- RF-02, RF-02-2 and RF-02-3 retain the same library, furniture and book models. No additional chair/cart handles. The east reading-table black book moves 0.10 m toward its reachable edge in all three scenes.
- The cart is approached at either native handle end, initially along world X. The robot stands 0.91 m from its center, aligns without teleporting, reaches with both hands, and is pushed using the ordinary movement controls. Final contact errors in the full route were 0.0022/0.0028 m.
- A permanent yellow 1.8 × 1.52 m parking bay, floor label and wall sign identify the destination. The full rotated cart footprint must fit inside; no exact heading is required.
- Chairs may stop beside their reading table with a gap up to 0.38 m and without overlapping it. No exact home pose or yaw is required. The browser route deliberately used offset placements: west approximately (-5.496, 1.261), east (6.426, 1.307); both succeeded.
- Books use visible runtime reach, lift, hand carrying and placement. Ground books require crouching. The book visual follows the actual right-hand grasp point; the obsolete rear-rack payload is hidden in the two variants.
- Shelf/bookend repair, its objects, interactions and completion dependency are removed.
- RF-02-3 schedules three automatic falls, one from each differently colored shelf in shuffled order. Every interval, including the first, is independently random between 60 and 90 simulation seconds. All three recoveries are required. There is no global countdown, directory clue or step navigation.

## Verification

45/45 original-library and series tests pass. Tests cover all six tabletop books and collision-safe animation stances in both variants; both native handles; cart-book support tracking; chair tolerance; rotated parking bounds; blocked movement; preferred-target rejection; reward deduplication; idle/turn/error behavior; failure/reset; all timer bounds and distinct shelves; full routes with zero and two errors.

Both production browser routes passed against release-r7 using ordinary F input and keyboard furniture pushing. Transit uses the supported agent movement API. No teleportation, reserve editing or clock acceleration is used.

| Browser route | Distance | Final reserve | Minimum reserve | Interactions |
| --- | ---: | ---: | ---: | ---: |
| RF-02-2 | 50.100 m | 45.355 | 37.355 | 6 |
| RF-02-3 | 104.003 m | 15.077 | 14.077 | 12 |

The final patrol had no invalid interactions, all three books were picked up and returned, both chairs were restored and the cart parked. Its scheduled fall times were 79.177 s (white), 154.011 s (black), 216.499 s (red): intervals 79.177, 74.833 and 62.488 seconds. Visual evidence includes falling and ground states; observation polling can record a landing later than its scheduled fall.

All six tabletop locations were checked visually during the candidate regressions. The final build also repeats the desk black-book pickup after a completed RF-02-2 reset. Saved evidence includes first-person hand carrying, native cart-end contact, third-person parking, and both completion screens.

Production build passes with the existing large-chunk warning. Nine robot/shared-control/camera hashes match the protected baseline. All 17 resources (4,798,411 bytes) match source, release and deployed HTTP bytes.

On the local Apple M3 browser at 1280 × 680, 180-frame samples measured 59.95 FPS first person, 59.97 third person and 52.89 dual view. Asset gates passed; warm resource load was approximately 967 ms. These measurements do not claim a separate 1080p run.

## Reserve calibration

Initial/maximum 100. RF-02-2 movement 1.45 points/m, invalid F 3, chair reward 5, cart reward 8. RF-02-3 movement 0.98 points/m, invalid F 5, chair reward 3, cart reward 5. First pickup/return rewards 1 each; repeats cost 1. Blocked movement costs 1/1.4 points/s. Idle and free turn cost zero. Rewards are deduplicated/capped; failure and terminal-state behavior are tested.

The patrol rate includes the extra walking required by real hand-animation alignment. Engine route measurements:
| Level | Clean final / minimum | Two-error final / minimum |
| --- | --- | --- |
| RF-02-2 | 47.286 / 39.286 | 41.286 / 33.286 |
| RF-02-3, all tested shuffled schedules | 25.023 / 23.886 | 15.023 / 13.886 |

## Evidence and limitations

Authoritative project: . on 127.0.0.1. Task artifacts: ./authoring/server-production/rf02-usability-v5. Browser evidence is in its browser-evidence directory:
- rf02-2-full-route-final.json and rf02-3-full-route-final.json
- rf02-2-complete-final.png and rf02-3-complete-final.png
- table-black-final-first.jpg, ground-black-carried-first.jpg, ground-white-final-first.jpg
- cart-native-end-first.jpg, parking-final-third.jpg
- performance-final.json and staged tabletop pickup reports

Earlier candidate failures remain separately labelled: insufficient reach, unstable cart reach and QA approaches selecting the wrong nearby object. They are not counted as completed routes. Final release-r7 routes both pass. Captures from intermediate candidates supplement the final captures and are not represented as final-build completion evidence.

The broader shared-controls check retains three pre-existing failures: RF-08 lateral movement, RF-08 free turning and an exact-source-string browser control assertion. Its result is 16/19, unchanged in scope from the previous task. Per the repository rule, no Git commit or push is made while this verification has failures. Unrelated changes are preserved.

Rollback release: ./authoring/server-production/rf02-fixes-v4/release-r1. No credentials, environments, generated assets, builds, backups or logs are committed.

## Reproduction

- node --test tests/rf02-library.test.mjs tests/rf02-series.test.mjs
- node tools/rf02-series/measure-routes.mjs <task-directory>/routes.json
- npm run build -- --outDir <new-release-directory>
- Copy dist/local-assets, dist/vendor and dist/agent-kit into that release (the existing asset plugin writes those folders to dist).
- node tools/rf02-series/prepare-browser-qa.mjs <new-release-directory>
- Use /rf02-series-qa.html for both full routes and tabletop checks.
- node tools/rf02-series/write-manifest.mjs <release-directory> <served-origin>

Playable URLs:
- http://127.0.0.1:4192/?mode=play&level=rf02-2&view=third&robot=g1&control=velocity
- http://127.0.0.1:4192/?mode=play&level=rf02-3&view=third&robot=g1&control=velocity
