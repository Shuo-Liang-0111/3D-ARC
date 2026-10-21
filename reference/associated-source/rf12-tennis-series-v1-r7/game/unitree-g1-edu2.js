import * as THREE from "three";

const COLORS = Object.freeze({
  shell: 0xd9dedb,
  shellLight: 0xf0f2ef,
  graphite: 0x202628,
  joint: 0x0d1112,
  visor: 0x070a0b,
  status: 0x66e7c1,
  warning: 0xe5a12a,
});

function physical(color, metalness, roughness, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: options.clearcoat ?? 0,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.25,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function prepare(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(name, size, material, position = [0, 0, 0]) {
  const mesh = prepare(new THREE.Mesh(new THREE.BoxGeometry(...size), material), name);
  mesh.position.set(...position);
  return mesh;
}

function roundedBox(name, size, radius, material, position = [0, 0, 0]) {
  const [width, height, depth] = size;
  const bevel = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + bevel, -height / 2);
  shape.lineTo(width / 2 - bevel, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + bevel);
  shape.lineTo(width / 2, height / 2 - bevel);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - bevel, height / 2);
  shape.lineTo(-width / 2 + bevel, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - bevel);
  shape.lineTo(-width / 2, -height / 2 + bevel);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + bevel, -height / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 0.7),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel * 0.35,
    bevelThickness: bevel * 0.35,
    curveSegments: 8,
  });
  geometry.center();
  const mesh = prepare(new THREE.Mesh(geometry, material), name);
  mesh.position.set(...position);
  return mesh;
}

function capsule(name, radius, length, material, position = [0, 0, 0]) {
  const mesh = prepare(new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 18), material), name);
  mesh.position.set(...position);
  return mesh;
}

function cylinder(name, radiusTop, radiusBottom, height, material, position = [0, 0, 0], segments = 24) {
  const mesh = prepare(
    new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material),
    name,
  );
  mesh.position.set(...position);
  return mesh;
}

function sphere(name, radius, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = prepare(new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material), name);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  return mesh;
}

function registerPart(parts, group, name) {
  group.name = name;
  group.userData.partId = name;
  parts.push(group);
  return group;
}

function addFastenerRing(parent, material, radius, count, y, z) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const fastener = cylinder(
      `${parent.name}-fastener-${index + 1}`,
      0.012,
      0.012,
      0.009,
      material,
      [Math.cos(angle) * radius, y + Math.sin(angle) * radius, z],
      12,
    );
    fastener.rotation.x = Math.PI / 2;
    fastener.userData.explodeWithParent = true;
    parent.add(fastener);
  }
}

function createThreeFingerHand(side, materials, parts) {
  const hand = registerPart(parts, new THREE.Group(), side < 0 ? "left-dex3-hand" : "right-dex3-hand");
  const wrist = cylinder(`${hand.name}-wrist`, 0.055, 0.06, 0.09, materials.joint, [0, -0.015, 0], 18);
  hand.add(wrist);
  const palm = box(`${hand.name}-palm`, [0.13, 0.14, 0.065], materials.graphite, [0, -0.125, 0.008]);
  palm.scale.x = 0.92;
  hand.add(palm);

  const digits = [];
  const digitSpecs = [
    { x: -0.045, spread: -0.12, lengths: [0.075, 0.055] },
    { x: 0.045, spread: 0.12, lengths: [0.075, 0.055] },
  ];
  for (const [digitIndex, spec] of digitSpecs.entries()) {
    const digit = new THREE.Group();
    digit.name = `${hand.name}-finger-${digitIndex + 1}`;
    digit.position.set(spec.x, -0.19, 0);
    digit.rotation.z = spec.spread;
    hand.add(digit);
    const joints = [];
    let parent = digit;
    for (const [segmentIndex, length] of spec.lengths.entries()) {
      const joint = new THREE.Group();
      joint.name = `${digit.name}-joint-${segmentIndex + 1}`;
      if (segmentIndex > 0) joint.position.y = -spec.lengths[segmentIndex - 1];
      parent.add(joint);
      const segment = capsule(`${joint.name}-shell`, 0.022, length - 0.035, materials.shell, [0, -length / 2, 0]);
      joint.add(segment);
      joints.push(joint);
      parent = joint;
    }
    digits.push({ root: digit, joints });
  }

  const thumb = new THREE.Group();
  thumb.name = `${hand.name}-thumb`;
  thumb.position.set(side * -0.072, -0.11, 0.006);
  thumb.rotation.set(0.24, 0, side * -0.82);
  hand.add(thumb);
  const thumbJoint = new THREE.Group();
  thumb.add(thumbJoint);
  thumbJoint.add(capsule(`${thumb.name}-proximal`, 0.024, 0.07, materials.shell, [0, -0.052, 0]));
  const thumbTip = new THREE.Group();
  thumbTip.position.y = -0.09;
  thumbJoint.add(thumbTip);
  thumbTip.add(capsule(`${thumb.name}-distal`, 0.02, 0.045, materials.shell, [0, -0.04, 0]));

  hand.userData.digits = digits;
  hand.userData.thumb = { root: thumb, joints: [thumbJoint, thumbTip] };
  hand.userData.grip = 0;
  return hand;
}

export function setUnitreeG1Edu2Grip(hand, amount) {
  const grip = THREE.MathUtils.clamp(amount, 0, 1);
  hand.userData.grip = grip;
  hand.userData.digits.forEach(({ joints }) => {
    joints[0].rotation.x = -grip * 0.85;
    joints[1].rotation.x = -grip * 1.05;
  });
  const thumb = hand.userData.thumb;
  thumb.root.rotation.y = hand.name.startsWith("left") ? grip * 0.32 : -grip * 0.32;
  thumb.joints[0].rotation.x = -grip * 0.62;
  thumb.joints[1].rotation.x = -grip * 0.78;
}

function createArm(side, materials, parts) {
  const prefix = side < 0 ? "left" : "right";
  const shoulder = registerPart(parts, new THREE.Group(), `${prefix}-shoulder`);
  shoulder.position.set(side * 0.36, 1.91, 0);
  shoulder.rotation.z = side * 0.08;
  const motor = cylinder(`${prefix}-shoulder-motor`, 0.092, 0.092, 0.14, materials.joint, [0, 0, 0], 24);
  motor.rotation.z = Math.PI / 2;
  shoulder.add(motor);
  shoulder.add(sphere(`${prefix}-shoulder-cap`, 0.102, materials.shell, [side * 0.018, 0, 0], [1.06, 0.9, 1]));
  shoulder.add(box(`${prefix}-upper-arm-rail`, [0.085, 0.34, 0.085], materials.graphite, [0, -0.27, 0]));
  shoulder.add(capsule(`${prefix}-upper-arm-shell`, 0.068, 0.25, materials.shell, [0, -0.28, 0.005]));

  const elbow = registerPart(parts, new THREE.Group(), `${prefix}-elbow`);
  elbow.position.y = -0.55;
  shoulder.add(elbow);
  const elbowMotor = cylinder(`${prefix}-elbow-motor`, 0.078, 0.078, 0.12, materials.joint, [0, 0, 0], 22);
  elbowMotor.rotation.z = Math.PI / 2;
  elbow.add(elbowMotor);
  elbow.add(box(`${prefix}-forearm-spine`, [0.085, 0.33, 0.08], materials.graphite, [0, -0.24, 0]));
  const forearmShell = capsule(`${prefix}-forearm-shell`, 0.067, 0.24, materials.shellLight, [0, -0.25, 0.005]);
  forearmShell.scale.set(1.05, 1, 0.88);
  elbow.add(forearmShell);
  const wrist = new THREE.Group();
  wrist.name = `${prefix}-wrist`;
  wrist.position.y = -0.5;
  elbow.add(wrist);
  const hand = createThreeFingerHand(side, materials, parts);
  hand.position.y = -0.02;
  wrist.add(hand);
  setUnitreeG1Edu2Grip(hand, 0.12);
  return { shoulder, elbow, wrist, hand, phase: side < 0 ? 0 : Math.PI, side, baseZ: shoulder.rotation.z };
}

function createLeg(side, materials, parts) {
  const prefix = side < 0 ? "left" : "right";
  const hip = registerPart(parts, new THREE.Group(), `${prefix}-hip`);
  hip.position.set(side * 0.155, 1.19, 0);
  hip.add(sphere(`${prefix}-hip-yaw-motor`, 0.098, materials.joint, [0, 0, 0], [1.05, 0.95, 1]));
  const sideMotor = cylinder(`${prefix}-hip-roll-motor`, 0.075, 0.075, 0.14, materials.graphite, [side * 0.07, -0.04, 0], 22);
  sideMotor.rotation.z = Math.PI / 2;
  hip.add(sideMotor);
  hip.add(box(`${prefix}-thigh-spine`, [0.12, 0.39, 0.12], materials.graphite, [0, -0.3, -0.005]));
  const thighShell = capsule(`${prefix}-thigh-shell`, 0.105, 0.29, materials.shell, [0, -0.31, 0.012]);
  thighShell.scale.set(1.05, 1, 0.92);
  hip.add(thighShell);

  const knee = registerPart(parts, new THREE.Group(), `${prefix}-knee`);
  knee.position.y = -0.64;
  hip.add(knee);
  const kneeMotor = cylinder(`${prefix}-knee-motor`, 0.082, 0.082, 0.13, materials.joint, [0, 0, 0], 24);
  kneeMotor.rotation.z = Math.PI / 2;
  knee.add(kneeMotor);
  addFastenerRing(knee, materials.fastener, 0.052, 6, 0, 0.07);
  knee.add(box(`${prefix}-shin-spine`, [0.105, 0.38, 0.105], materials.graphite, [0, -0.29, -0.01]));
  const shinGuard = box(`${prefix}-shin-guard`, [0.17, 0.38, 0.11], materials.shellLight, [0, -0.28, 0.045]);
  shinGuard.scale.set(0.86, 1, 1);
  knee.add(shinGuard);

  const ankle = registerPart(parts, new THREE.Group(), `${prefix}-ankle`);
  ankle.position.y = -0.58;
  knee.add(ankle);
  ankle.add(sphere(`${prefix}-ankle-motor`, 0.082, materials.joint, [0, 0, 0], [1, 0.9, 1]));
  ankle.add(box(`${prefix}-foot`, [0.19, 0.09, 0.36], materials.graphite, [0, -0.095, 0.095]));
  ankle.add(box(`${prefix}-toe-armor`, [0.18, 0.055, 0.17], materials.shell, [0, -0.07, 0.24]));
  ankle.add(box(`${prefix}-sole`, [0.2, 0.025, 0.37], materials.joint, [0, -0.15, 0.1]));
  return { hip, knee, ankle, phase: side < 0 ? 0 : Math.PI, side };
}

export function createUnitreeG1Edu2Model(options = {}) {
  const root = new THREE.Group();
  root.name = "unitree-g1-edu2-procedural";
  root.scale.setScalar(options.scale ?? 1);
  const parts = [];
  const materials = {
    shell: physical(COLORS.shell, 0.62, 0.28, { clearcoat: 0.16 }),
    shellLight: physical(COLORS.shellLight, 0.55, 0.31, { clearcoat: 0.12 }),
    graphite: physical(COLORS.graphite, 0.78, 0.24),
    joint: physical(COLORS.joint, 0.84, 0.2),
    visor: physical(COLORS.visor, 0.82, 0.12, { clearcoat: 0.75, clearcoatRoughness: 0.08 }),
    status: physical(COLORS.status, 0.3, 0.22, { emissive: 0x2c9478, emissiveIntensity: 2 }),
    warning: physical(COLORS.warning, 0.32, 0.34, { emissive: 0x8c4b08, emissiveIntensity: 0.45 }),
    fastener: physical(0x6f7775, 0.9, 0.2),
  };

  const bodyRig = new THREE.Group();
  bodyRig.name = "g1-edu2-body-rig";
  root.add(bodyRig);

  const pelvis = registerPart(parts, new THREE.Group(), "pelvis-module");
  pelvis.position.y = 1.2;
  pelvis.add(box("pelvis-core", [0.38, 0.24, 0.27], materials.graphite));
  const pelvisShell = roundedBox("pelvis-shell", [0.36, 0.18, 0.25], 0.055, materials.shell, [0, 0.015, 0.008]);
  pelvisShell.scale.set(1, 0.92, 1);
  pelvis.add(pelvisShell);
  pelvis.add(box("pelvis-front-panel", [0.24, 0.11, 0.025], materials.visor, [0, 0.02, 0.17]));
  bodyRig.add(pelvis);

  const waist = registerPart(parts, new THREE.Group(), "three-dof-waist");
  waist.position.y = 1.43;
  waist.add(cylinder("waist-yaw-ring", 0.14, 0.15, 0.11, materials.joint, [0, 0, 0], 28));
  waist.add(cylinder("waist-roll-ring", 0.125, 0.135, 0.1, materials.graphite, [0, 0.1, 0], 28));
  waist.add(box("waist-cable-cover", [0.21, 0.13, 0.18], materials.shell, [0, 0.13, 0]));
  bodyRig.add(waist);

  const torso = registerPart(parts, new THREE.Group(), "torso-module");
  torso.position.y = 1.57;
  const chest = roundedBox("torso-shell", [0.46, 0.43, 0.25], 0.065, materials.shell, [0, 0.22, 0]);
  chest.scale.set(1, 1, 0.94);
  torso.add(chest);
  torso.add(roundedBox("shoulder-bridge", [0.55, 0.12, 0.27], 0.04, materials.shellLight, [0, 0.42, 0]));
  torso.add(roundedBox("chest-visor", [0.28, 0.2, 0.024], 0.028, materials.visor, [0, 0.23, 0.132]));
  torso.add(box("chest-status-bar", [0.18, 0.018, 0.014], materials.status, [0, 0.32, 0.178]));
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      torso.add(box(
        `${side < 0 ? "left" : "right"}-chest-vent-${index + 1}`,
        [0.018, 0.115, 0.018],
        materials.graphite,
        [side * (0.16 + index * 0.019), 0.22, 0.145],
      ));
    }
  }
  torso.add(box("rear-compute-pack", [0.36, 0.31, 0.11], materials.graphite, [0, 0.22, -0.19]));
  bodyRig.add(torso);

  const head = registerPart(parts, new THREE.Group(), "sensor-head");
  head.position.y = 2.08;
  head.add(box("neck-interface", [0.2, 0.1, 0.2], materials.joint, [0, -0.08, 0]));
  const headShell = roundedBox("head-shell", [0.29, 0.2, 0.22], 0.05, materials.shellLight);
  headShell.scale.set(1, 0.95, 1);
  head.add(headShell);
  head.add(roundedBox("head-visor", [0.25, 0.095, 0.025], 0.025, materials.visor, [0, -0.005, 0.118]));
  head.add(roundedBox("head-cap", [0.24, 0.028, 0.17], 0.012, materials.graphite, [0, 0.11, -0.005]));
  for (const side of [-1, 1]) {
    const camera = cylinder(`${side < 0 ? "left" : "right"}-stereo-camera`, 0.021, 0.021, 0.014, materials.status, [side * 0.073, 0.002, 0.137], 18);
    camera.rotation.x = Math.PI / 2;
    head.add(camera);
  }
  const lidar = cylinder("forehead-lidar", 0.038, 0.045, 0.038, materials.visor, [0, 0.07, 0.122], 24);
  lidar.rotation.x = Math.PI / 2;
  head.add(lidar);
  head.add(roundedBox("edu2-temple-accent", [0.022, 0.082, 0.15], 0.009, materials.warning, [0.155, -0.002, 0]));
  bodyRig.add(head);

  const arms = [-1, 1].map((side) => createArm(side, materials, parts));
  arms.forEach(({ shoulder }) => bodyRig.add(shoulder));
  const legs = [-1, 1].map((side) => createLeg(side, materials, parts));
  legs.forEach(({ hip }) => bodyRig.add(hip));

  const initialPartPositions = new Map(parts.map((part) => [part, part.position.clone()]));
  const sculptRuntime = {
    model: "Unitree G1 EDU2",
    basis: "procedural approximation informed by the official G1 29-DOF GLB hierarchy",
    hiddenRegionConfidence: "medium",
    parts,
    sockets: {
      leftHand: arms[0].wrist,
      rightHand: arms[1].wrist,
      chest: torso,
      head,
    },
    setExploded(amount = 0) {
      const spread = THREE.MathUtils.clamp(amount, 0, 1) * 0.38;
      for (const part of parts) {
        const base = initialPartPositions.get(part);
        const direction = new THREE.Vector3(base.x, base.y - 1.15, base.z);
        if (direction.lengthSq() < 0.001) direction.set(0, 1, 0);
        direction.normalize();
        part.position.copy(base).addScaledVector(direction, spread);
      }
    },
  };

  root.userData = {
    sculptRuntime,
    bodyRig,
    pelvis,
    waist,
    torso,
    head,
    arms,
    legs,
    gaitPhase: 0,
    materials,
  };
  return root;
}

export function updateUnitreeG1Edu2Model(robot, delta, elapsed, motion = "idle") {
  const data = robot.userData;
  const active = motion === "moving" || motion === "turning";
  if (active) data.gaitPhase += delta * (motion === "turning" ? 4.2 : 6.5);
  const amplitude = active ? (motion === "turning" ? 0.16 : 0.42) : 0.012;
  data.legs.forEach((leg) => {
    const wave = Math.sin(data.gaitPhase + leg.phase);
    leg.hip.rotation.x = wave * amplitude;
    leg.knee.rotation.x = active ? 0.08 + Math.max(0, -wave) * 0.52 : 0.055;
    leg.ankle.rotation.x = active ? -wave * 0.08 : 0;
  });
  data.arms.forEach((arm) => {
    const wave = Math.sin(data.gaitPhase + arm.phase);
    arm.shoulder.rotation.x = active ? -wave * amplitude * 0.68 : Math.sin(elapsed * 1.4 + arm.phase) * 0.012;
    arm.shoulder.rotation.z = arm.baseZ;
    arm.elbow.rotation.x = active ? 0.08 + Math.max(0, wave) * 0.16 : 0.06;
  });
  data.bodyRig.position.y = Math.sin(elapsed * 1.8) * 0.008 + (active ? Math.abs(Math.sin(data.gaitPhase * 2)) * 0.025 : 0);
  data.waist.rotation.y = motion === "turning" ? Math.sin(data.gaitPhase) * 0.05 : 0;
  data.torso.rotation.y = -data.waist.rotation.y * 0.65;
  data.head.rotation.y = motion === "turning" ? -data.torso.rotation.y * 0.7 : Math.sin(elapsed * 0.6) * 0.018;
}
