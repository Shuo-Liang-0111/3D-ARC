# RF15 F interaction animation

Current revision: `f-animation-v5-walking-approach`.

The user's clarified requirement restores automatic local approach within the
normal interaction range. Pressing F starts a collision-checked walk to the
operating stance: turn toward the path, step forward (never strafe), turn to face
the object, settle both feet, then perform the hand action. The 0.18 m / 0.30 rad
entry rejection from v4 is superseded. Cart push travel remains player-controlled.

Following range tuning, F entry requires horizontal distance at most 1.20 m
from a crop or the collection basket, and 1.10 m from the cart's driver stance
(previously 1.45 m, 1.40 m and 1.55 m respectively). The existing tool range is
1.15 m. No precise facing requirement is reintroduced: accepted interactions
still turn and walk into position before the hand animation.

`interaction-walk.js` plans a bounded local route using the actual runtime
walkability checks. Foot targets alternate between a planted support foot and a
lifted swing foot; leg IK follows those targets. Body flex blends in and out,
and the next hand action waits for the final foot placement. Blocked paths
cancel without teleportation. Pause and reset stop/clear the approach state.
The stationary-version descriptions and evidence below are historical.

## Current walking-approach verification

The focused RF-15 animation, harvest, cart and G1 motion-calibration checks pass
42/42 tests. The production build passes with the existing bundle-size warning.
Tests cover wrong-facing nearby entry in both variants, continuous forward-only
approach, collision checks, obstacle detours, blocked routes, settling, pause,
reset and manual-only cart travel after gripping.

Live browser inspection of this revision completed sequential knife pickup,
one harvest and basket deposit (1/8) from deliberately offset QA station fixtures.
The measured local approaches were 0.421 m, 0.567 m and 0.161 m respectively.
Each finished standing before the hand action; the left hand emptied after
deposit and the right retained the knife. Consecutive actions clear swing-foot
origins so a previous station cannot pull the next step toward stale coordinates.

RF-15-2 browser checks completed offset/wrong-facing approach, grip and idle
with zero cart travel; an explicit W input then moved the cart 2.359 m until
the existing collision checks stopped it. Release, another offset approach and
re-grip passed without moving the cart automatically. First-person pickup/carry
and third-person cart frames were inspected; the cart page reported no console
errors. These are local-interaction checks using explicit QA fixtures, not a
claim of full browser navigation from spawn or full mission completion.

## Historical animation evidence

The user replaced the earlier contact-physics requirement with visual animation:
approach an interaction area and press F; the robot keeps its current position, reaches,
closes its fingers, cuts or lifts, stands and adopts a carrying pose. The knife
follows the right hand and a harvested vegetable follows the left hand. Deposits
use a short eased placement into eight deterministic basket positions. There is
no object gravity, contact grasp, friction, slip or bounce simulation in this
path. The existing navigation collision rules remain in use.

The standard G1 velocity-control routes for RF15-1, RF15-2 and RF15-3 load the
same animation controller. The old `physics=1` URL also reaches this controller;
it no longer selects the experimental object physics. Agent joint control does
not start the F controller. Existing scene assets and cameras are reused.

`interaction-animation.js` owns choreography and visual poses;
`animation-hand.js` animates the official articulated hand meshes without rigid
bodies. `variant-engine.js` remains authoritative for mission state, interaction
costs, errors and one-time rewards. Pickup commits when the grasp/cut animation
reaches its event, and a deposit commits when fingers open. Final success waits
until the robot completes its recovery animation. Reset restores tool and crop
transforms. No new crop copies are added for the animation.

Validation for RF15-1:

- 25 focused animation and existing RF15 regression tests pass.
- Production build passes with the existing bundle-size warning.
- An integration run with the official G1 skeleton and a recorded standing pose
  passes pickup, return, pickup again, all eight harvest/deposit animations, task
  completion and reset. It uses explicit station fixtures between tasks, so it
  does not establish automatic navigation between the tool room and field.
- The live browser passes F pickup, local alignment, harvest, standing recovery
  and basket deposit (1/8). Both hand attachments release or persist as expected.
  First-person images were inspected during carrying and after deposit.
- The original version used automatic F alignment. The current version below replaces it.
- `qa=animation` exposes labeled station fixtures and the same F action for live
  visual inspection. `data-rf15-animation` reports the current action, hands and
  visual transforms, and explicitly labels the mode `scripted-animation`.

Complete RF15-2 and RF15-3 animation routes have not been accepted by this check.
The earlier Rapier prototype and its tests remain historical source; it is not
the active F interaction implementation.

## Historical v4 fixed interaction stance (superseded)

RF-15-1 and RF-15-2 now share stationary F interaction: no automatic translation
or rotation to the planned stance. Before starting, check that the player is
within 0.18 m of the reachable operating stance, and within 0.30 rad of a fixed
tool/crop/cart direction where applicable. Otherwise show a proximity or facing
message and leave both the player and task state unchanged. Basket and other
placements use the current player heading when computing arm-side reach.

The runtime's movement input stays zero through pickup, harvest, placement and
cart gripping/release animations. Crouching and arm motion remain visual poses.
Only the manually controlled cart push phase forwards W/S, A/D and Q/E.
Gripping records the player's actual cart-relative offset; subsequent manual
cart movement preserves it instead of snapping the player to the handle center.
Idle input preserves the exact player pose. QA station fixtures have been
updated to valid operating stances and do not count as navigation evidence.


Verification of `f-animation-v4-stationary`: 38 RF-15 tests and the production build pass (existing chunk-size warning). Live browser QA station fixtures completed knife pickup, one vegetable harvest and basket deposit (1/8), plus cart grip, explicit W movement and release. Player x/z/yaw stayed unchanged throughout each stationary action and after idle recovery. The cart retained its measured 5 cm lateral / 2 cm longitudinal grip offset. These fixtures verify actions, not full navigation from spawn. RF-15 keyboard mode ignores MuJoCo root drift while movement keys are released; other modes keep the existing movement contract.

The earlier v4 wider movement check passed 18 of 21 tests. Two RF-08 movement assertions failed in untouched code, and the shared keyboard-source assertion expects an old F handler already absent from HEAD. That phase was left uncommitted. The v5 correction above passes its applicable focused checks; those unrelated failures are not fixed by this change.
