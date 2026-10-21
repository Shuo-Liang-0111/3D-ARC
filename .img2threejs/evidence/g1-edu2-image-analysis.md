# G1 EDU2 reconstruction intake and silhouette pass 1

## Identification

- Subject: Unitree G1 EDU humanoid robot, configured with optional three-axis waist and Dex3-1 three-finger hands.
- Primary domain: hybrid (mechanical humanoid character).
- Confidence: 0.94 for G1 family, 0.78 for the exact EDU2 accessory configuration.
- Structural reference: `public/local-assets/unitree/g1/g1_29dof_official.glb`, SHA-256 `4e8e83e42cb7a9d1d93c46eb0da821eb54ebf3596923bee087cf7e614ae367b9`.

## Observable form and hierarchy

- Bilaterally symmetric, upright humanoid volume with narrow sagittal depth relative to standing height.
- Macro assemblies: sensor head, torso/compute enclosure, pelvis, articulated arm chains, articulated leg chains, end effectors.
- Meso assemblies: three-axis shoulder and hip stacks, elbow/knee actuators, three-axis wrists, two-axis ankles, waist yaw/roll chain.
- The GLB exposes 68 named nodes, 36 meshes, 36 primitives and two untextured opaque materials. Its semantic decomposition is `rich` with named-node boundaries.
- No skin or animation is embedded; articulation must remain an authored group hierarchy.

## Materials and finish

- Reference GLB contains two untextured opaque materials. It proves material boundaries but not EDU2 surface colour or roughness.
- Current procedural render uses light neutral painted shell, dark graphite actuator housings and low-roughness black sensor glazing. These remain visual approximations.

## Identity-defining features

- Compact head sensor enclosure rather than a human head.
- Narrow torso and pelvis around exposed rotary actuator chains.
- Optional three-axis waist and wrist chains.
- Dex3-1 end effector: thumb plus index and middle fingers, seven active hand degrees of freedom according to Unitree's official G1 parameter table.
- Long narrow feet and a 1320 x 450 x 200 mm standing envelope according to Unitree's official G1 product page.

## Pass 1 changes and evidence

- Replaced sharp box head, chest, shoulder bridge, pelvis and sensor panels with bevelled extruded shells.
- Head shell changed from `0.39 x 0.27 x 0.31` to `0.29 x 0.20 x 0.22` model units.
- Shoulder X anchors changed from `+-0.43` to `+-0.36`; shoulder motor radius changed from `0.125` to `0.092`.
- Torso shell changed from `0.54 x 0.47 x 0.30` to `0.46 x 0.43 x 0.25`.
- Pelvis shell changed from `0.43 x 0.20 x 0.31` to `0.36 x 0.18 x 0.25`.
- Hip yaw motor radius changed from `0.13` to `0.098`; knee motor radius changed from `0.112` to `0.082`.
- Browser evidence: `g1-edu2-silhouette-pass-1.png` at 1280 x 720. No console warnings or errors were present.
- Verification: four G1 EDU2 tests passed and the Vite production build succeeded.

## Remaining mismatch and uncertainty

- Shin and forearm armour still read as simplified columns rather than the reference's tapered continuous shells.
- Chest front panel and head sensor arrangement remain inferred EDU2 styling, not pixel-matched evidence.
- Dex3 palm, tendon covers, knuckles and fingertips are under-detailed and visually undersized.
- Back compute enclosure, cable routing and hidden fasteners have not been visually reviewed.
- No fixed-camera six-pass GLB/procedural comparison has been captured yet; this pass is not a fidelity-gate completion.

## Decision

`refine-spec`: retain the improved global envelope, then define reference-derived tapered limb profiles and the exact visible sensor/hand assemblies before the next code correction.
