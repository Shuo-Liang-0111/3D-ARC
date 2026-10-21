# Unitree G1 EDU official multi-reference analysis

## Provenance

- Authoritative page: `https://www.unitree.com/cn/g1/`
- Main reference: `g1-03.jpg` (2740 x 1720), standing front three-quarter view.
- Supporting full-body views: `g1-01.jpg`, `g1-02.jpg`, `g1-04.jpg`, `g1-05.jpg`, `g1-07.jpg`.
- Component close-ups: `g1-06.jpg` (pelvis, waist, arms, hands), `g1-08.jpg` (waist and elbow linkages), `g1-params.png` (Dex3-1, standing scale, head sensor close-up).
- Structural reference: official-family 29-DOF GLB already probed as 68 named nodes and 36 separate meshes. It supplies hierarchy evidence only, not surface pixels.

## Layer 1 — identification and classification

- Work type: Unitree G1 EDU humanoid robot with optional three-axis waist and Dex3-1 three-finger hands.
- Broad class: articulated electromechanical humanoid.
- Primary domain: hybrid.
- Identity confidence: 0.98 for the pictured official G1 EDU configuration.

## Layer 2 — overall form and silhouette

- Bilateral humanoid silhouette within the official 1320 x 450 x 200 mm standing envelope.
- Narrow sagittal depth; long legs account for approximately half the standing height.
- The head is a compact helmet-like sensor shell with a continuous dark face cavity and cyan perimeter/light bar. It has no eyes.
- The torso is one continuous tapered white shell: rounded shoulders, slightly wider upper chest, nearly vertical sides and a curved lower lip.
- The pelvis is visually separate from the torso, connected through exposed stacked black waist actuators.
- Limbs alternate between continuous metallic-silver armour shells and exposed dark rotary joint housings.

## Layer 3 — macro, meso and micro hierarchy

- Macro: head sensor module; neck; torso shell; three-axis waist; pelvis; two arm chains; two leg chains; two Dex3 hands.
- Meso: shoulder cap and pitch/roll/yaw chain; sculpted upper-arm link; elbow disc; forearm shell; stacked wrist rings; hip lateral drums; thigh shell; knee side disc; tapered shin shell; exposed ankle linkage; shoe-like foot.
- Micro: cyan head perimeter and horizontal sensor bar; black triangular chest mark; shoulder circular caps; wrist cooling grooves; pelvis front service cover and fasteners; thigh and shin seam lines; ankle perforations/link pins; Dex3 segmented pads and joint pins; right torso battery/status panel.

## Layer 4 — spatial and attachment relationships

- Head sensor shell is socketed to a flared black neck pedestal; neck overlaps the upper torso aperture.
- Torso is attached to a visible stacked waist yaw/roll/pitch column; the column embeds into the pelvis top.
- Shoulder actuator stacks are socketed into the upper lateral torso, not represented by floating spheres.
- Upper-arm and forearm shells wrap continuous load-bearing links and terminate at visible rotary joints.
- Thigh shells originate around lateral hip drums; knee discs sit on the outer side; shin shells connect to exposed ankle linkages and long dark feet.
- Dex3 palms socket to stacked wrist rings; two long fingers and an opposable thumb form each three-digit hand.

## Layer 5 — materials and PBR observations

- Main armour: metallic-silver/very light neutral albedo, medium metal response or coated metallic substrate, satin roughness approximately 0.28–0.40.
- Dark structural parts: near-black graphite albedo, mostly opaque, roughness approximately 0.28–0.48 depending on housing versus soft hand pads.
- Face cavity: very dark blue-black, low roughness, clear-coated glazing response.
- Cyan perimeter and bar: emissive translucent/acrylic light guide; emission must remain separate from base colour.
- Feet and finger pads: dark elastomer/composite, dielectric, roughness approximately 0.55–0.75.

## Layer 6 — colour and finish

- Armour: low-saturation cool silver, high value, satin metallic finish.
- Mechanisms: low-value neutral graphite/black, mixed satin and semi-matte finish.
- Sensor accent: vivid cyan-blue emission concentrated on the head perimeter and horizontal brow bar.
- The official references show clean product-render surfaces with no visible wear layer.

## Layer 7 — identity-defining features

1. Cyan-outlined, open-face helmet sensor head with one horizontal cyan bar; absolutely no eyes.
2. Single clean tapered torso shell with a small black downward triangle, not a rectangular chest screen.
3. Exposed stacked three-axis waist above a compact black pelvis.
4. Sculpted S-profile arm links and stacked black wrist grooves.
5. Long continuous thigh and shin armour with lateral black knee discs.
6. Exposed metallic ankle linkage entering a long dark shoe-like foot.
7. Dex3-1 hand: two long fingers plus opposable thumb, segmented black pads and seven active hand DOF in the official configuration.
8. Right torso-side battery/status panel with green indicators.

## Layer 8 — uncertainty and limits

- The downloaded static set has strong front and front-three-quarter coverage but no clean orthographic rear view.
- Back compute cover, rear pelvis fasteners and cable routing remain conditional until a rear video frame is admitted.
- Poses differ between references; proportions must be solved from the neutral standing images, not running or crouching frames.
- Product appearance may change by configuration; this reconstruction targets the exact official image set downloaded on 2026-08-12.
- The result will be a code-only procedural Three.js reconstruction, not copied GLB topology and not manufacturing geometry.

## Suitability verdict

- Verdict: `pass` for a high-fidelity real-time browser reconstruction.
- Reason: the target is unambiguous, occupies enough pixels, has several strong silhouettes, material response is visible, close-ups cover the critical waist/hand/head regions, and the official GLB resolves hidden articulation hierarchy.
- Limitation: the rear surface remains conditional; it must be labelled inferred unless a rear frame is captured from the official video.
