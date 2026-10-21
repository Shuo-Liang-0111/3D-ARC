# RF15 contact-driven grasping

## Requested behavior

The user explicitly selected articulated finger contact and friction, including slipping when grip force is insufficient. This authorizes the necessary hand model and grasp-controller changes beyond the earlier frozen-robot constraint. Object parenting, fixed carry sockets and hand/object weld constraints do not satisfy this request.

The latest requirement is active body balance after grasping: legs and torso must respond to load and keep the robot standing. Fixed pelvis constraints, hidden upright forces and freezing the stance are not acceptable. The earlier stance-assistance question has been answered by this requirement.

The selected production workspace remains `.`. Existing RF15 Cardinal assets, layout and the three shared variants are retained. Robot cameras and input mappings are not part of this change.

## Implementation under verification

- Official Unitree G1 three-finger hand geometry and joint definitions, seven independently driven joints per hand, are available from the official `unitree_ros` repository and existing server meshes.
- Finger motor torques are bounded. Tools and harvested plants use free joints, explicit masses, friction and collision shapes in MuJoCo.
- Articulated hands, robot and objects share the same physical world in the candidate. Positive-force contacts on the thumb and another finger or the palm identify a candidate grasp; loss of contact clears the held state. The palm must count because the official hand can hold a handle between thumb and palm. Objects are never positioned from a carry socket after grasping.
- Original 29-joint locomotion observations and actions retain their order. Named position/velocity addresses permit additional finger and object degrees of freedom without feeding them to the locomotion policy.
- Reach, close, lift, carry, release, floor pickup and basket placement require actual physical and formal browser verification before enabling the new runtime.

## Evidence so far

An isolated official right-hand probe used dynamic fingers, a free 0.12 kg cylinder and gravity. A wrist-to-test-fixture constraint drives the hand, with no constraint involving the object. At a 0.7 N m finger torque limit, the object followed a 0.03 m lift and remained at 0.824 m while the palm target was 0.830 m. Reducing the limit to 0.02 N m or zero made the cylinder fall to the floor at 0.015 m. This is isolated contact evidence, not a completed RF15 gameplay test.

The full-body candidate compiles with 120 position coordinates, 109 velocity coordinates and 43 actuators: 29 existing robot actuators plus 14 finger motors. The original standing policy remains stable during an initial no-command test. A tool attempt from the old 0.95 m interaction distance was correctly rejected as outside arm reach; reachable standing positions and grasp orientation are being tuned.

Three reproducible tests in `simulation/test_rf15_contact.py` pass: friction-only lifting, low-torque slipping and opening-finger release. All ten existing `simulation/test_g1_simulation.py` tests also pass after introducing explicit robot joint addresses.

The experimental pelvis support has been removed from the candidate model and controller. The constrained inverse-dynamics standing controller drives only robot joint actuators, using center-of-mass, torso and foot feedback, with motor torque limits and foot friction/center-of-pressure limits. It applies no external body force or torque while active. SciPy and OSQP were installed in the authorized server runtime; the optional dependency list is `simulation/requirements-rf15-contact.txt`.

The first full-body attempts failed because interpolated arm poses hit the bench, a wrist orientation exceeded the available reach, and fingers could not fit underneath a handle lying flat on the bench. `rf15_reach.py` now finds collision-checked arm configurations and joint-space routes. Motor interpolation follows the same joint-space segment used by collision checks. A candidate two-point knife rest exposes the handle, with a 16 mm handle collision radius and a grasp near the blade end of the handle. These support and collision changes are currently test-fixture changes; the online meshes and layout have not been changed to match them.

Two full-body pickup tests now pass using the official articulated hand and a free 0.22 kg knife, with normal gravity throughout and zero equality constraints anywhere in the fixture. The robot reaches from its standing pose, closes the hand by bounded motor torque, lifts the knife approximately 0.0801 m and maintains a five-second physical hold. Minimum pelvis height during the pickup and hold is 0.7862 m, maximum tilt is 2.625 degrees. Opening the fingers makes the knife fall back to its support, and reducing grip strength to 0.01 causes slipping; the robot stays standing in both cases. These are physics integration tests, not browser or complete gameplay acceptance.

Two additional tests pass for arm movement with a 6 N downward wrist load and a short 18 N lateral disturbance. They assert finite state, standing height, tilt, center-of-mass error, recovery velocity and absence of externally applied pelvis support. The wrist load is an explicit disturbance fixture, not an object-grasp substitute for the full-body tests.

Final combined validation: all 17 tests passed in 35.920 seconds (`simulation.test_g1_simulation`, `simulation.test_rf15_contact`, `simulation.test_rf15_balance`). Python compilation and the tracked patch whitespace check also passed. The full-body tests build their knife-rest fixture from source, so they do not depend on the exploratory production layout JSON. Logs are in `final-balance-tests.log` under the candidate artifacts directory.

No browser contact runtime, new service, or deployment switch has been installed. Full-body right-hand knife pickup, stationary holding, release and slipping now pass their dedicated physics tests. Walking while holding, left-hand grasping, floor pickup, crop harvesting, physical basket placement, visual hand alignment and the original online tool layout remain unverified. The contact candidate must remain disabled in the public game until those required integration gates pass. No commit is made while overall integration is incomplete.

## Status

`in_progress`. Existing online gameplay remains active. The active-balance component passes dedicated physics tests, but transport, basket and browser gates remain pending. The overall contact feature must not be described as deployed or complete.

Candidate artifacts, official-source download, baseline hashes, test outputs and detailed probes are outside Git under `./authoring/server-production/rf15-contact-v1`.

## Remaining integration work

1. Match the real tool mesh, support geometry and collision model, then exercise the full RF15 layout rather than only the reproducible bench fixture.
2. Integrate physical hand meshes, object poses, grasp/release commands and balance telemetry with the browser and service, preserving authoritative world coordinates.
3. Validate walking with a held object, crouching/reaching field vegetables, the second hand and basket deposition before replacing existing interactions.
4. Verify all three shared-scene variants in the formal browser, then deploy and make the scoped task commit. Existing public gameplay is still the previously deployed scripted interaction implementation.
