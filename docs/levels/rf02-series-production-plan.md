# RF-02 series / library-operations-v5

## Current authorized behavior

The latest user request supersedes the bookend-fault and precise furniture-placement rules.

- RF-02 retains its original three-book sorting objective.
- RF-02-2 requires moving two displaced chairs beside their associated reading tables and manually parking the return cart inside the yellow bay.
- RF-02-3 adds three automatic book falls, each from a different randomly ordered color shelf. Each interval is randomly 60–90 simulation seconds, including the first interval. No shelf repair and no global countdown. All three fallen books must be returned.
- All three levels share the same library, original chairs/cart, fifteen books and parking signage. No added furniture handles or repair fixtures.
- The cart is approached at either original handle end (initial world-X ends), with two hands on that handle. Nearby F initiates collision-aware alignment; the player controls pushing and presses F to release.
- A chair is restored when its non-overlapping footprint is within 0.38 m of its table. There is no exact chair heading or home-position requirement.
- Cart parking accepts any heading whose rotated footprint fits inside the 1.8 × 1.52 m marked bay at (8.65, -3.15). Floor and wall labels identify the destination.
- Both new levels animate reaching, lifting, hand carrying and placing books. Ground pickup uses a crouch. Original model geometry, bones, dimensions, rest pose, camera/FOV and shared control/kinematics/envelope remain frozen.
- No directory clues or step navigation. Final objectives, permanent parking signage and necessary interaction feedback remain.

## Deployment scope

Authoritative host: 127.0.0.1; account: chenhaoyuan; project: .. Runtime, assets, releases and production evidence remain under /path/to/arc-workspace. Mac is a control/evidence surface.

Task artifacts: ./authoring/server-production/rf02-usability-v5. Preview 4194; deploy to task-owned 4192 after verification. Preserve unrelated changes and services. The v4 fixed release remains available for rollback. Credentials stay outside project files. Do not report Cardinal cost. Existing scene assets are reused; no new generated asset is needed.

## Geometry and validation

Retain the 24 × 16 m library and Cardinal/EmbodiedGen models. The native cart measures approximately 0.86 × 0.54 × 1.12 m; robot stands 0.91 m from its center along the handle axis. Moving objects and collision transforms share authoritative state. Parking and collision GLBs use versioned directories.

Required checks: original RF-02 regression; six tabletop books in both variants; both native cart ends; relaxed chair placement; rotated parking bounds; autonomous 60–90 second intervals, distinct shelves and maximum three; full clean/two-error engine routes; real browser interactions, carrying and full routes; protected-file and source/build/HTTP hashes; production build. Failures and candidate evidence remain distinct from deployment and user acceptance.

## Reserve

Initial/maximum 100. RF-02-2 movement 1.45 points/m, invalid interaction 3, chair reward 5, cart reward 8. RF-02-3 movement 0.98 points/m, invalid interaction 5, chair reward 3, cart reward 5. First pickup/return reward 1 each. Blocked movement costs 1/1.4 points/s; repeats cost 1. Rewards are deduplicated and capped. Idle and free turn cost zero. Failure is atomic; terminal states freeze; reset clears rewards.

RF-02-3 requires longer routes across all three shelves and has higher mistake penalties. Engine and browser endpoint/minimum reserve must remain positive and are recorded independently.
