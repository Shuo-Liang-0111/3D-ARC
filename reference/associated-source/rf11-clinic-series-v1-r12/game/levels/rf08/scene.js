import * as THREE from "three";
import { RF08_LAYOUT } from "./level.js";

function material(color, roughness = 0.72, metalness = 0.04, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
}

function box(parent, name, size, position, entryMaterial, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radius, height, position, entryMaterial, rotation = [0, 0, 0], segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), entryMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createRoom(root, materials) {
  const { length, width, height } = RF08_LAYOUT.room;
  box(root, "rf08-wood-floor", [length, 0.08, width], [0, -0.04, 0], materials.floor);
  for (let index = 0; index < 19; index += 1) {
    const z = -width / 2 + 0.1 + index * 0.2;
    box(root, `rf08-floor-plank-${index + 1}`, [length - 0.12, 0.012, 0.185], [0, 0.006, z], materials[index % 3 === 0 ? "floorLight" : "floorDark"]);
  }
  box(root, "rf08-north-wall", [length, height, 0.12], [0, height / 2, -width / 2], materials.wall);
  box(root, "rf08-south-wall", [length, height, 0.12], [0, height / 2, width / 2], materials.wall);
  box(root, "rf08-east-wall", [0.12, height, width], [length / 2, height / 2, 0], materials.wall);

  const glassWidth = 2.62;
  const glassCenterZ = -0.54;
  box(root, "rf08-west-glass", [0.035, 2.55, glassWidth], [-length / 2, 1.34, glassCenterZ], materials.glass);
  [-1.84, -0.98, -0.1, 0.78].forEach((z, index) => {
    box(root, `rf08-glass-mullion-${index + 1}`, [0.07, 2.72, 0.055], [-length / 2 + 0.01, 1.36, z], materials.frame);
  });
  box(root, "rf08-glass-header", [0.08, 0.08, glassWidth], [-length / 2 + 0.01, 2.72, glassCenterZ], materials.frame);
  box(root, "rf08-door-header", [0.12, 0.18, 1.08], [-length / 2, 2.81, 1.28], materials.wall);
  box(root, "rf08-door-jamb-inner", [0.1, 2.8, 0.1], [-length / 2, 1.4, 0.77], materials.frame);
  box(root, "rf08-door-jamb-outer", [0.1, 2.8, 0.1], [-length / 2, 1.4, 1.78], materials.frame);
  box(root, "rf08-open-wood-door", [0.88, 2.28, 0.055], [-2.83, 1.14, 1.77], materials.door);
  box(root, "rf08-black-skirting-north", [length - 0.12, 0.08, 0.03], [0, 0.08, -width / 2 + 0.07], materials.frame);
  box(root, "rf08-black-skirting-south", [length - 0.12, 0.08, 0.03], [0, 0.08, width / 2 - 0.07], materials.frame);

  [-1.75, 0, 1.75].forEach((x, index) => {
    const light = box(root, `rf08-ceiling-light-${index + 1}`, [1.15, 0.045, 0.34], [x, 2.78, 0], materials.light);
    light.castShadow = false;
  });
}

function createWorkstation(root, entry, index, materials) {
  const group = new THREE.Group();
  group.name = `rf08-desk-${index + 1}`;
  group.position.set(entry.x, 0, entry.z);
  root.add(group);
  const side = Math.sign(entry.z) || 1;
  box(group, "desk-top", [1.25, 0.06, 0.7], [0, 0.74, 0], materials.desk);
  [-0.55, 0.55].forEach((x) => {
    box(group, "desk-leg", [0.055, 0.72, 0.055], [x, 0.36, side * 0.25], materials.leg);
    box(group, "desk-leg", [0.055, 0.72, 0.055], [x, 0.36, -side * 0.25], materials.leg);
  });
  box(group, "privacy-divider", [1.18, 0.42, 0.035], [0, 0.98, -side * 0.34], materials.divider);

  const laptopStation = [1, 5].includes(index);
  if (laptopStation) {
    box(group, "laptop-base", [0.38, 0.025, 0.27], [0.08, 0.79, side * 0.08], materials.device);
    box(group, "laptop-screen", [0.38, 0.25, 0.025], [0.08, 0.92, -side * 0.04], materials.screen, [side * -0.18, 0, 0]);
  } else {
    box(group, "monitor-screen", [0.49, 0.31, 0.045], [0, 1.02, -side * 0.1], materials.screen);
    box(group, "monitor-stand", [0.055, 0.2, 0.055], [0, 0.84, -side * 0.1], materials.frame);
    box(group, "keyboard", [0.42, 0.025, 0.14], [0, 0.79, side * 0.18], materials.device);
  }
  if ([2, 4, 7].includes(index)) {
    box(group, "desktop-tower", [0.25, 0.52, 0.48], [0.43, 0.48, side * 0.04], materials.tower);
  } else {
    box(group, "drawer-unit", [0.33, 0.55, 0.5], [-0.42, 0.3, side * 0.02], materials.drawer);
  }
  cylinder(group, "drink-bottle", 0.035, 0.22, [0.43, 0.89, side * 0.18], materials.bottle);
  box(group, "mouse", [0.08, 0.025, 0.12], [0.35, 0.79, side * 0.18], materials.device);
}

function createChair(root, entry, index, materials) {
  const group = new THREE.Group();
  group.name = `rf08-chair-${index + 1}`;
  group.position.set(entry.x, 0, entry.z);
  group.rotation.y = entry.yaw;
  root.add(group);
  box(group, "chair-seat", [0.48, 0.08, 0.46], [0, 0.48, 0], materials.chair);
  box(group, "chair-back", [0.48, 0.56, 0.065], [0, 0.78, 0.22], materials.chair);
  cylinder(group, "chair-column", 0.045, 0.43, [0, 0.25, 0], materials.frame);
  for (let spoke = 0; spoke < 5; spoke += 1) {
    const angle = spoke * Math.PI * 2 / 5;
    box(group, "chair-base-spoke", [0.035, 0.035, 0.34], [Math.sin(angle) * 0.13, 0.07, Math.cos(angle) * 0.13], materials.frame, [0, angle, 0]);
  }
}

function createPedestalFan(root, entry, index, materials) {
  const group = new THREE.Group();
  group.name = `rf08-fan-${index + 1}`;
  group.position.set(entry.x, 0, entry.z);
  group.rotation.y = entry.yaw;
  root.add(group);
  cylinder(group, "fan-base", 0.22, 0.055, [0, 0.03, 0], materials.fan);
  cylinder(group, "fan-pole", 0.035, 0.9, [0, 0.48, 0], materials.fan);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 36), materials.fan);
  cage.name = "fan-cage";
  cage.position.set(0, 1.16, 0);
  cage.rotation.x = Math.PI / 2;
  group.add(cage);
  cylinder(group, "fan-hub", 0.055, 0.11, [0, 1.16, 0], materials.frame, [Math.PI / 2, 0, 0]);
  for (let blade = 0; blade < 3; blade += 1) {
    box(group, "fan-blade", [0.07, 0.23, 0.018], [0, 1.16, 0], materials.blade, [0, 0, blade * Math.PI * 2 / 3]);
  }
}

function createAccessories(root, materials) {
  RF08_LAYOUT.bins.forEach((entry, index) => {
    cylinder(root, `rf08-trash-bin-${index + 1}`, 0.16, 0.34, [entry.x, 0.17, entry.z], materials.bin);
  });
  box(root, "rf08-east-storage-cabinet", [0.46, 0.72, 0.75], [2.96, 0.36, -1.32], materials.drawer);
  box(root, "rf08-cardboard-box-1", [0.5, 0.34, 0.44], [-2.91, 0.17, -1.46], materials.cardboard);
  box(root, "rf08-cardboard-box-2", [0.34, 0.25, 0.32], [-2.76, 0.47, -1.42], materials.cardboardDark);
  box(root, "rf08-water-dispenser", [0.34, 0.82, 0.34], [3.01, 0.41, 0.9], materials.drawer);
  cylinder(root, "rf08-water-jug", 0.14, 0.38, [3.01, 1.01, 0.9], materials.jug);
}

export function createRF08Scene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc8cfce);
  scene.fog = new THREE.Fog(0xc8cfce, 12, 24);
  scene.add(new THREE.HemisphereLight(0xf7f4ea, 0x4d5553, 1.8));
  scene.add(new THREE.AmbientLight(0xfff8eb, 0.3));
  const sun = new THREE.DirectionalLight(0xfff0d5, 2.2);
  sun.position.set(-4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  scene.add(sun);

  const materials = {
    wall: material(0xe9e8e2, 0.9),
    floor: material(0x8a6748, 0.78),
    floorLight: material(0xa77b53, 0.82),
    floorDark: material(0x936b49, 0.84),
    glass: material(0x78949a, 0.18, 0.05, { transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
    frame: material(0x252b2c, 0.38, 0.58),
    door: material(0x8b633f, 0.7),
    light: material(0xf8f4df, 0.3, 0, { emissive: 0xfff5cf, emissiveIntensity: 1.4 }),
    desk: material(0xeeeae0, 0.62),
    leg: material(0xd1d3ce, 0.4, 0.44),
    divider: material(0x555b5d, 0.72),
    screen: material(0x182123, 0.25, 0.1),
    device: material(0x34393a, 0.44, 0.22),
    tower: material(0x1e2527, 0.36, 0.32),
    drawer: material(0xd7d7d0, 0.58, 0.12),
    bottle: material(0x86b8c7, 0.32, 0, { transparent: true, opacity: 0.72 }),
    chair: material(0x292f30, 0.74),
    fan: material(0xe2e2da, 0.52, 0.1),
    blade: material(0xb8c5c6, 0.46, 0.04),
    bin: material(0x252a2a, 0.8),
    cardboard: material(0xb48755, 0.86),
    cardboardDark: material(0x8e653e, 0.9),
    jug: material(0x7aa7bd, 0.25, 0, { transparent: true, opacity: 0.62 }),
  };

  const grayboxRoot = new THREE.Group();
  grayboxRoot.name = "rf08-procedural-office-graybox";
  scene.add(grayboxRoot);
  createRoom(grayboxRoot, materials);
  RF08_LAYOUT.desks.forEach((entry, index) => createWorkstation(grayboxRoot, entry, index, materials));
  RF08_LAYOUT.chairs.forEach((entry, index) => createChair(grayboxRoot, entry, index, materials));
  RF08_LAYOUT.fans.forEach((entry, index) => createPedestalFan(grayboxRoot, entry, index, materials));
  createAccessories(grayboxRoot, materials);

  const assetReady = Promise.resolve([{ loaded: true, name: "rf08-procedural-office-graybox", procedural: true }]);
  const collisionReady = Promise.resolve({ loaded: true, source: "level.staticColliders", procedural: true });
  return { scene, grayboxRoot, assetReady, collisionReady };
}

export function syncRF08Visuals(world) { return world; }
