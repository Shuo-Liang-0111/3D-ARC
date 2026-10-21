# RF15 browser contact physics and F scripts

Status: superseded by `rf15-interaction-animation.md` after the user explicitly
requested visual choreography without object physics. This document records the
historical prototype. The default F route and old `physics=1` links now use the
animation controller described in that document.

RF15-1, RF15-2 and RF15-3 share one scene and one browser physics world. The
current candidate is enabled with `physics=1`. The ordinary route retains its
previous interactions until the browser acceptance gates pass.

## Authority

- Three.js renders objects from Rapier rigid-body poses. Gravity, object-object
  collisions, articulated finger contacts and friction are solved in the browser.
- The user explicitly authorized browser-authored F motion on 2026-09-17.
  F applies bounded, rate-limited arm poses and a crouch/recovery animation to
  the rendered robot. Local alignment uses the existing scene movement and
  collision rules. MuJoCo continues to supply ordinary locomotion feedback.
- F motion is a scripted presentation controller, not a whole-body torque
  controller or a demonstration of MuJoCo balancing under an external load.
- The joint/Agent mode does not invoke the F script. Full agent grasp control
  and load-feedback balancing remain separate work.
- Physical hand palms follow the rendered wrist transforms. Finger bodies are
  dynamic, connected by revolute joints with compliant motors. A held object
  remains a Rapier dynamic body. After sustained opposing-finger contact, a
  fixed joint preserves the object's position and rotation relative to the palm.
- The user's latest instruction explicitly permits fixed holding for tools and
  vegetables. Grip strength no longer causes a successfully attached object to
  slip. Rooted vegetables attach only after blade contact cuts the stem.
- Opening the hand removes the fixed joint immediately. Gravity and world
  collisions remain active; robot collisions resume once the object clears the
  fingers, preventing release from trapping it inside an opening hand. Reset
  detaches before restoring object poses; disposal restores collision masks.

This does not implement a browser-to-MuJoCo load-feedback balance controller.
Robot arm servo tracking and standing tests do not prove balance under an
arbitrary external load.

## Candidate coverage

The physics definitions include rooted vegetables, filled produce crates,
harvest basket, knife, trowel, sprayer, scale, pallet jack, door and tail lift.
An object definition alone does not establish a working F interaction.
Fixed-grasp integration passed knife pickup, return, pickup again, crop cutting,
standing recovery, transport and one basket deposit. A fixture-based eight-crop
run held and released all eight crops, but only six counted as deposited. Basket
capacity/placement and the full three-level mission routes remain unaccepted.

Harvesting now requires opposing-finger contact and knife-blade contact before
the crop becomes dynamic. The integration is still being verified. Leaf clusters
use a coarse rigid support collider that excludes finger contacts; the stem is
the gripping surface. This approximates compressible leaves, not soft-body leaves.
The existing fluctuating weight rule is not a physical load-cell simulation.

## Verification

- `node --test tools/rf15-browser-physics.test.mjs`: support, gravity, push,
  rooted-to-dynamic conversion, door clearance, contact lift, open-hand release
  fixed relative position/rotation during movement, retention under weak grip,
  explicit release, collision-mask restoration and constraint disposal using
  the actual knife collision shapes. Five focused tests pass.
- `python -m unittest discover -s simulation -p test_browser_arm_control.py -v`:
  bounded commands, reset, arm tracking and a sequence of standing/reaching poses.
- Existing G1 locomotion tests and RF15 scene/mission tests remain separate from
  browser contact acceptance.
- `npm run build` checks the runtime hand asset allowlist and module integration.
- `qa=physics` exposes explicit fixture positioning, navigation and contact
  controls. Fixture positioning is a test setup; it is not route-completion proof.

The DOM `data-rf15-physics` telemetry records action phases, actual object poses,
opposing-finger contacts and the backend balance state. Pair it with a visible
game screenshot and a successful actual F action before claiming deployment.

## Reproduction assets

`tools/rf15/export-browser-hands.py` exports official Unitree hand definitions
and copies the referenced STL meshes into the versioned runtime asset folder.
These generated assets are deployment dependencies, not source-control files.
Production evidence and pre-change baselines live outside the repository.
