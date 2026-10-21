import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DOOR, FIXTURES } from "./level.js";
import {
  createCardboardTexture,
  createDisplayTexture,
  createFloralTexture,
  createGrilleTexture,
  createLabelTexture,
  createMapleMaterial,
  createMeshFabricTexture,
  createMonitorBoxTexture,
  createWalnutMaterial,
  createWhiteboardTexture,
} from "./surfaces.js";

// Procedural furniture for the small office. Every builder returns a THREE.Group
// already positioned in world space; interactive parts are exposed on the group's
// userData so scene.js can animate them from presentation state.

export const material = (color, roughness = 0.7, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export function place(parent, geometry, entryMaterial, position = [0, 0, 0], { rotation = [0, 0, 0], name = "", cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geometry, entryMaterial);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

export const box = (parent, size, position, entryMaterial, options) => place(parent, new THREE.BoxGeometry(...size), entryMaterial, position, options);
export const roundedBox = (parent, size, radius, position, entryMaterial, options) => place(parent, new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius), entryMaterial, position, options);
export const cylinder = (parent, radiusTop, radiusBottom, height, position, entryMaterial, options = {}) => place(parent, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, options.segments ?? 24), entryMaterial, position, options);
export const sphere = (parent, radius, position, entryMaterial, options = {}) => {
  const mesh = place(parent, new THREE.SphereGeometry(radius, options.segments ?? 24, options.segments ?? 18), entryMaterial, position, options);
  if (options.scale) mesh.scale.set(...options.scale);
  return mesh;
};

function group(parent, name, position = [0, 0, 0], yaw = 0) {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(...position);
  root.rotation.y = yaw;
  parent.add(root);
  return root;
}

const BLACK_PLASTIC = () => material(0x141516, 0.55, 0.05);
const DARK_METAL = () => material(0x202224, 0.42, 0.6);
const WHITE_STEEL = () => material(0xf1f1ee, 0.42, 0.25);
const CHROME = () => material(0xe8e8e8, 0.16, 1);

function fiveStarBase(parent, radius, color = BLACK_PLASTIC()) {
  for (let arm = 0; arm < 5; arm += 1) {
    const angle = (arm / 5) * Math.PI * 2;
    const armMesh = box(parent, [radius, 0.03, 0.05], [Math.sin(angle) * radius * 0.5, 0.06, Math.cos(angle) * radius * 0.5], color);
    armMesh.rotation.y = angle;
    const caster = cylinder(parent, 0.03, 0.03, 0.028, [Math.sin(angle) * radius, 0.03, Math.cos(angle) * radius], color, { rotation: [0, angle, Math.PI / 2], segments: 14 });
    caster.castShadow = false;
  }
}

// ---------------------------------------------------------------------------
export function buildDesk(parent) {
  const { x, z, width, depth, height } = FIXTURES.desk;
  const root = group(parent, "desk", [x, 0, z]);
  const top = roundedBox(root, [width, 0.03, depth], 0.006, [0, height - 0.015, 0], createMapleMaterial(), { name: "desk-top" });
  top.material.map.repeat.set(2.4, 0.8);
  const steel = WHITE_STEEL();
  const legX = width / 2 - 0.04;
  const legZ = depth / 2 - 0.04;
  for (const lx of [-legX, legX]) for (const lz of [-legZ, legZ]) box(root, [0.04, height - 0.03, 0.04], [lx, (height - 0.03) / 2, lz], steel);
  for (const lz of [-legZ, legZ]) box(root, [width - 0.08, 0.04, 0.04], [0, height - 0.05, lz], steel);
  for (const lx of [-legX, legX]) box(root, [0.04, 0.04, depth - 0.08], [lx, height - 0.05, 0], steel);
  const grommet = material(0x4a3520, 0.5, 0.1);
  cylinder(root, 0.038, 0.038, 0.008, [-1.1, height + 0.004, -0.15], grommet, { segments: 20, cast: false });
  cylinder(root, 0.038, 0.038, 0.008, [1.0, height + 0.004, -0.17], grommet, { segments: 20, cast: false });
  return root;
}

export function buildMonitor(parent) {
  const { x, z } = FIXTURES.monitor;
  const root = group(parent, "monitor", [x, FIXTURES.desk.height, z], Math.PI); // screen faces north (-z)
  const plastic = material(0x111213, 0.5, 0.1);
  roundedBox(root, [0.3, 0.012, 0.2], 0.004, [0, 0.006, 0.02], plastic);
  box(root, [0.06, 0.24, 0.026], [0, 0.13, -0.03], plastic);
  const radius = 1.8;
  const width = 0.62;
  const height = 0.36;
  const theta = width / radius;
  const shellGeometry = new THREE.CylinderGeometry(radius + 0.018, radius + 0.018, height + 0.02, 48, 1, true, Math.PI - theta / 2, theta);
  shellGeometry.translate(0, 0, radius + 0.018);
  place(root, shellGeometry, material(0x151617, 0.58, 0.08), [0, 0.33, 0.0]);
  const screenGeometry = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, Math.PI - theta / 2, theta);
  screenGeometry.translate(0, 0, radius);
  const screen = place(root, screenGeometry, material(0x0a0b0c, 0.22, 0.25, { side: THREE.BackSide, emissive: 0x000000 }), [0, 0.33, 0.0], { name: "monitor-screen", cast: false });
  roundedBox(root, [0.32, 0.2, 0.03], 0.008, [0, 0.3, -0.03], plastic);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.012, 0.03), plastic);
  lid.position.set(0, 0.52, 0.0);
  root.add(lid);
  root.userData.screen = screen;
  return root;
}

export function buildExecutiveChair(parent) {
  const { x, z, yaw } = FIXTURES.executiveChair;
  const root = group(parent, "executive-chair", [x, 0, z], yaw);
  const red = material(0xc2202b, 0.92, 0);
  const shell = material(0xdedfdb, 0.5, 0.1);
  fiveStarBase(root, 0.3);
  cylinder(root, 0.03, 0.03, 0.34, [0, 0.23, 0], DARK_METAL(), { segments: 16 });
  box(root, [0.3, 0.06, 0.28], [0, 0.42, 0], BLACK_PLASTIC());
  roundedBox(root, [0.52, 0.11, 0.5], 0.04, [0, 0.5, 0.02], red);
  const back = group(root, "executive-chair-back", [0, 0.56, -0.2]);
  back.rotation.x = -0.14;
  roundedBox(back, [0.5, 0.62, 0.09], 0.04, [0, 0.31, 0], red);
  roundedBox(back, [0.46, 0.56, 0.02], 0.01, [0, 0.31, -0.055], shell);
  box(back, [0.03, 0.14, 0.02], [0, 0.66, -0.03], shell);
  roundedBox(back, [0.3, 0.16, 0.08], 0.03, [0, 0.76, 0.0], red);
  roundedBox(back, [0.28, 0.14, 0.02], 0.008, [0, 0.76, -0.05], shell);
  for (const side of [-1, 1]) {
    roundedBox(root, [0.06, 0.03, 0.28], 0.01, [side * 0.29, 0.72, 0.0], shell);
    box(root, [0.04, 0.2, 0.05], [side * 0.29, 0.6, -0.06], shell);
  }
  return root;
}

export function buildVisitorChair(parent, fixture) {
  const root = group(parent, fixture.id, [fixture.x, 0, fixture.z], fixture.yaw);
  const black = BLACK_PLASTIC();
  const seatFabric = material(0x5b5d60, 0.95, 0);
  const meshFabric = material(0x2e2f32, 0.9, 0, { map: createMeshFabricTexture(), transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  fiveStarBase(root, 0.29);
  cylinder(root, 0.028, 0.028, 0.3, [0, 0.21, 0], DARK_METAL(), { segments: 16 });
  box(root, [0.28, 0.05, 0.26], [0, 0.4, 0], black);
  roundedBox(root, [0.5, 0.09, 0.48], 0.035, [0, 0.46, 0.01], seatFabric);
  box(root, [0.07, 0.26, 0.025], [0, 0.56, -0.25], black);
  const back = group(root, `${fixture.id}-back`, [0, 0.62, -0.22]);
  back.rotation.x = -0.1;
  roundedBox(back, [0.46, 0.5, 0.03], 0.015, [0, 0.27, 0], meshFabric);
  for (const side of [-1, 1]) box(back, [0.025, 0.52, 0.03], [side * 0.235, 0.27, 0], black);
  box(back, [0.48, 0.03, 0.03], [0, 0.535, 0], black);
  box(back, [0.4, 0.05, 0.02], [0, 0.12, -0.02], black);
  for (const side of [-1, 1]) {
    roundedBox(root, [0.06, 0.03, 0.26], 0.01, [side * 0.27, 0.66, -0.02], black);
    box(root, [0.035, 0.2, 0.05], [side * 0.27, 0.55, -0.02], black);
  }
  return root;
}

export function buildCabinet(parent) {
  const { x, z, width, depth, height } = FIXTURES.cabinet;
  const root = group(parent, "cabinet", [x, 0, z]);
  const body = material(0xd6d6d1, 0.5, 0.15);
  const trim = material(0x8b8e91, 0.45, 0.3);
  box(root, [width, height - 0.05, depth], [0, (height - 0.05) / 2 + 0.03, 0], body);
  box(root, [width - 0.04, 0.06, depth - 0.03], [0, 0.03, 0], trim);
  box(root, [width + 0.02, 0.03, depth + 0.02], [0, height - 0.015, 0], trim);
  const door = material(0xdcdcd7, 0.45, 0.15);
  for (const side of [-1, 1]) roundedBox(root, [width / 2 - 0.015, height - 0.11, 0.02], 0.004, [side * (width / 4 - 0.002), height / 2 - 0.01, depth / 2 + 0.005], door);
  cylinder(root, 0.012, 0.012, 0.012, [0.03, 0.95, depth / 2 + 0.016], material(0x6f7174, 0.35, 0.7), { rotation: [Math.PI / 2, 0, 0], segments: 14, cast: false });
  return root;
}

export function buildPedestal(parent) {
  const { x, z, width, depth, height } = FIXTURES.pedestal;
  const root = group(parent, "pedestal", [x, 0, z]);
  const white = material(0xf3f3f0, 0.45, 0.1);
  const teal = material(0x2f8f8c, 0.4, 0.3);
  box(root, [width, height - 0.04, depth], [0, (height - 0.04) / 2 + 0.04, 0], white);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(root, 0.02, 0.02, 0.02, [sx * (width / 2 - 0.05), 0.02, sz * (depth / 2 - 0.06)], BLACK_PLASTIC(), { segments: 12, cast: false });
  [0.14, 0.32, 0.5].forEach((y) => {
    roundedBox(root, [width - 0.03, 0.165, 0.015], 0.003, [0, y, depth / 2 + 0.005], white);
    box(root, [0.2, 0.02, 0.012], [0, y + 0.06, depth / 2 + 0.015], teal, { cast: false });
  });
  cylinder(root, 0.01, 0.01, 0.01, [0.15, 0.55, depth / 2 + 0.017], material(0x8d8f92, 0.35, 0.7), { rotation: [Math.PI / 2, 0, 0], segments: 12, cast: false });
  return root;
}

export function buildSkull(parent) {
  const { x, z, height } = FIXTURES.pedestal;
  const root = group(parent, "t800-bust", [x, height, z]);
  const chrome = CHROME();
  const darkChrome = material(0x3a3b3e, 0.32, 0.85);
  const cavity = material(0x08090a, 0.8, 0.1);
  roundedBox(root, [0.16, 0.02, 0.16], 0.004, [0, 0.01, 0], material(0x111111, 0.6, 0.1));
  box(root, [0.08, 0.05, 0.08], [0, 0.045, 0], darkChrome);
  cylinder(root, 0.034, 0.03, 0.09, [0, 0.11, 0], chrome, { segments: 20 });
  for (const y of [0.085, 0.115, 0.145]) place(root, new THREE.TorusGeometry(0.037, 0.006, 8, 20), chrome, [0, y, 0], { rotation: [Math.PI / 2, 0, 0] });
  sphere(root, 0.1, [0, 0.265, -0.01], chrome, { scale: [0.92, 1.05, 1.1], segments: 32 });
  box(root, [0.17, 0.03, 0.06], [0, 0.25, 0.078], chrome, { rotation: [0.2, 0, 0] });
  for (const side of [-1, 1]) {
    sphere(root, 0.03, [side * 0.043, 0.245, 0.088], cavity, { segments: 16 });
    sphere(root, 0.013, [side * 0.043, 0.245, 0.1], material(0x3a0000, 0.4, 0, { emissive: 0xff2a1a, emissiveIntensity: 2.4 }), { segments: 12, cast: false });
    box(root, [0.045, 0.05, 0.05], [side * 0.064, 0.2, 0.06], chrome, { rotation: [0, side * 0.4, 0] });
    cylinder(root, 0.015, 0.015, 0.02, [side * 0.078, 0.185, 0.012], darkChrome, { rotation: [0, 0, Math.PI / 2], segments: 12 });
  }
  box(root, [0.03, 0.035, 0.02], [0, 0.205, 0.1], cavity);
  box(root, [0.11, 0.025, 0.04], [0, 0.17, 0.076], material(0xd9d9d1, 0.4, 0.2));
  roundedBox(root, [0.12, 0.035, 0.1], 0.01, [0, 0.145, 0.045], chrome);
  box(root, [0.1, 0.02, 0.035], [0, 0.156, 0.08], material(0xd9d9d1, 0.4, 0.2));
  return root;
}

export function buildTrashBin(parent) {
  const { x, z, radius, height } = FIXTURES.trashBin;
  const root = group(parent, "trash-bin", [x, 0, z]);
  cylinder(root, radius, radius * 0.82, height, [0, height / 2, 0], material(0x151515, 0.45, 0.05), { segments: 28 });
  place(root, new THREE.TorusGeometry(radius + 0.004, 0.018, 10, 28), material(0x0f0f10, 0.3, 0.05), [0, height, 0], { rotation: [Math.PI / 2, 0, 0] });
  cylinder(root, radius - 0.012, radius - 0.012, 0.004, [0, height - 0.03, 0], material(0x0a0a0b, 0.35, 0.05), { segments: 28, cast: false });
  return root;
}

export function buildWhiteboard(parent) {
  const { x, z, width, height, bottom } = FIXTURES.whiteboard;
  const root = group(parent, "whiteboard", [x, 0, z], Math.PI / 2); // board faces east (+x)
  const frame = material(0x1f2022, 0.4, 0.6);
  const centerY = bottom + height / 2;
  box(root, [width, height, 0.018], [0, centerY, 0], material(0xf4f4f2, 0.3, 0.05), { name: "whiteboard-panel" });
  place(root, new THREE.PlaneGeometry(width - 0.01, height - 0.01), material(0xffffff, 0.32, 0.04, { map: createWhiteboardTexture() }), [0, centerY, 0.0095], { name: "whiteboard-face", cast: false });
  box(root, [width + 0.04, 0.025, 0.03], [0, bottom + height + 0.0125, 0], frame);
  box(root, [width + 0.04, 0.025, 0.03], [0, bottom - 0.0125, 0], frame);
  for (const side of [-1, 1]) box(root, [0.025, height + 0.05, 0.03], [side * (width / 2 + 0.0075), centerY, 0], frame);
  for (const side of [-1, 1]) {
    cylinder(root, 0.016, 0.016, 1.92, [side * 0.66, 0.96, -0.03], frame, { segments: 14 });
    box(root, [0.05, 0.03, 0.56], [side * 0.66, 0.05, -0.03], frame);
    for (const end of [-1, 1]) cylinder(root, 0.03, 0.03, 0.025, [side * 0.66, 0.03, -0.03 + end * 0.25], BLACK_PLASTIC(), { rotation: [0, 0, Math.PI / 2], segments: 14, cast: false });
  }
  cylinder(root, 0.014, 0.014, 1.36, [0, 1.9, -0.03], frame, { rotation: [0, 0, Math.PI / 2], segments: 12 });
  box(root, [1.36, 0.03, 0.03], [0, 0.05, -0.03], frame);
  box(root, [0.6, 0.015, 0.05], [0, bottom - 0.02, 0.035], frame);
  box(root, [0.6, 0.022, 0.008], [0, bottom - 0.005, 0.058], frame);
  cylinder(root, 0.008, 0.008, 0.13, [-0.12, bottom + 0.0, 0.04], material(0x111111, 0.4, 0.1), { rotation: [0, 0, Math.PI / 2], segments: 10, cast: false });
  cylinder(root, 0.008, 0.008, 0.13, [0.1, bottom + 0.0, 0.04], material(0xf2f2f0, 0.4, 0.1), { rotation: [0, 0, Math.PI / 2], segments: 10, cast: false });
  cylinder(root, 0.012, 0.012, 0.006, [0.28, 1.28, 0.022], material(0x101010, 0.3, 0.2), { rotation: [Math.PI / 2, 0, 0], segments: 12, cast: false });
  cylinder(root, 0.012, 0.012, 0.006, [-0.5, 0.97, 0.022], material(0x101010, 0.3, 0.2), { rotation: [Math.PI / 2, 0, 0], segments: 12, cast: false });
  return root;
}

export function buildAirConditioner(parent) {
  const { x, z, width, depth, height } = FIXTURES.airConditioner;
  const root = group(parent, "air-conditioner", [x, 0, z], -Math.PI / 2); // front faces west (-x)
  const shell = material(0xf3f3f1, 0.32, 0.02);
  roundedBox(root, [width, height - 0.02, depth], 0.03, [0, height / 2 + 0.01, 0], shell);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(root, 0.02, 0.02, 0.02, [sx * (width / 2 - 0.05), 0.02, sz * (depth / 2 - 0.05)], BLACK_PLASTIC(), { segments: 12, cast: false });
  place(root, new THREE.PlaneGeometry(0.3, 0.2), material(0xffffff, 0.6, 0.05, { map: createGrilleTexture() }), [0, 0.2, depth / 2 + 0.001], { cast: false });
  roundedBox(root, [0.24, 0.07, 0.012], 0.004, [0, 0.64, depth / 2], material(0x141416, 0.25, 0.1));
  const displayOn = createDisplayTexture("24", true);
  const displayOff = createDisplayTexture("24", false);
  const display = place(root, new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: displayOff, toneMapped: false }), [-0.02, 0.645, depth / 2 + 0.008], { name: "aircon-display", cast: false, receive: false });
  for (let button = 0; button < 4; button += 1) cylinder(root, 0.006, 0.006, 0.004, [0.03 + button * 0.02, 0.63, depth / 2 + 0.008], material(0xd9d9d6, 0.4, 0.1), { rotation: [Math.PI / 2, 0, 0], segments: 10, cast: false });
  const led = sphere(root, 0.0045, [0.1, 0.665, depth / 2 + 0.008], material(0x102030, 0.4, 0, { emissive: 0x2a8cff, emissiveIntensity: 0 }), { segments: 8, cast: false });
  place(root, new THREE.PlaneGeometry(0.08, 0.02), new THREE.MeshBasicMaterial({ map: createLabelTexture("NEPO", { color: "#3f4144", font: "700 68px sans-serif" }), toneMapped: false }), [0, 0.5, depth / 2 + 0.001], { cast: false, receive: false });
  cylinder(root, 0.075, 0.075, 0.05, [0, 0.6, -depth / 2 - 0.015], material(0xcfcdc7, 0.5, 0.1), { rotation: [Math.PI / 2, 0, 0], segments: 20 });
  root.userData.display = display;
  root.userData.displayOn = displayOn;
  root.userData.displayOff = displayOff;
  root.userData.led = led;
  return root;
}

export function buildCot(parent) {
  const { x, z, length, width, height } = FIXTURES.cot;
  const root = group(parent, "folding-cot", [x, 0, z]);
  const tube = material(0x1b1b1c, 0.4, 0.55);
  const fabric = material(0x474a4f, 0.97, 0);
  const railY = height - 0.02;
  for (const side of [-1, 1]) cylinder(root, 0.012, 0.012, length * 0.7, [side * (width / 2 - 0.02), railY, -length * 0.15], tube, { rotation: [Math.PI / 2, 0, 0], segments: 12 });
  cylinder(root, 0.012, 0.012, width, [0, railY, -length / 2 + 0.01], tube, { rotation: [0, 0, Math.PI / 2], segments: 12 });
  for (const legZ of [-length * 0.36, -length * 0.02, length * 0.34]) {
    for (const lean of [-1, 1]) cylinder(root, 0.01, 0.01, 0.7, [0, (railY - 0.02) / 2 + 0.01, legZ], tube, { rotation: [0, 0, lean * 0.97], segments: 10 });
    for (const side of [-1, 1]) box(root, [0.05, 0.02, 0.04], [side * (width / 2 - 0.02), 0.01, legZ], BLACK_PLASTIC(), { cast: false });
  }
  roundedBox(root, [width - 0.04, 0.05, length * 0.7], 0.02, [0, height + 0.005, -length * 0.15], fabric);
  const head = group(root, "cot-head", [0, height + 0.005, length * 0.2]);
  head.rotation.x = -0.42;
  roundedBox(head, [width - 0.04, 0.05, length * 0.3], 0.02, [0, 0, length * 0.15], fabric);
  for (const side of [-1, 1]) cylinder(head, 0.012, 0.012, length * 0.3, [side * (width / 2 - 0.02), -0.025, length * 0.15], tube, { rotation: [Math.PI / 2, 0, 0], segments: 12 });
  cylinder(head, 0.012, 0.012, width, [0, -0.025, length * 0.3 - 0.01], tube, { rotation: [0, 0, Math.PI / 2], segments: 12 });
  const pillow = roundedBox(head, [0.5, 0.11, 0.36], 0.045, [0.02, 0.07, length * 0.15], material(0xffffff, 0.9, 0, { map: createFloralTexture() }));
  pillow.rotation.y = 0.14;
  return root;
}

export function buildStorageCorner(parent) {
  const root = group(parent, "storage-corner");
  const white = material(0xf2f2ee, 0.5, 0.02);
  const { minX, minZ, size } = FIXTURES.storageCubes;
  const cubeCenters = [[minX + size / 2, size / 2], [minX + size * 1.5, size / 2], [minX + size * 1.5, size * 1.5]];
  for (const [cx, cy] of cubeCenters) roundedBox(root, [size - 0.01, size - 0.01, size - 0.01], 0.008, [cx, cy, minZ + size / 2], white);
  const monitorBoxTexture = createMonitorBoxTexture();
  const red = material(0xc4262c, 0.6, 0);
  const printed = material(0xffffff, 0.6, 0, { map: monitorBoxTexture });
  const cartons = FIXTURES.monitorCartons;
  const flatBox = new THREE.Mesh(new THREE.BoxGeometry(cartons.width, cartons.height, cartons.depth), [red, red, printed, red, red, red]);
  flatBox.position.set(cartons.x, cartons.height / 2, cartons.z);
  flatBox.rotation.y = 0.04;
  flatBox.castShadow = true;
  flatBox.receiveShadow = true;
  root.add(flatBox);
  const standingBox = new THREE.Mesh(new THREE.BoxGeometry(cartons.width, cartons.depth, cartons.height), [red, red, red, red, red, printed]);
  standingBox.position.set(cartons.x, cartons.height + cartons.depth / 2 - 0.01, cartons.z + 0.1);
  standingBox.rotation.set(0.2, -0.03, 0);
  standingBox.castShadow = true;
  standingBox.receiveShadow = true;
  root.add(standingBox);
  roundedBox(root, [0.42, 0.11, 0.38], 0.045, [minX + size * 1.5, size * 2 + 0.055, minZ + 0.2], material(0x1d1e21, 0.95, 0));
  place(root, new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0xf4f4f2 }), [minX + size * 1.5 - 0.1, size * 2 + 0.03, minZ + 0.395], { cast: false, receive: false });
  roundedBox(root, [0.12, 0.028, 0.09], 0.006, [cartons.x - 0.08, cartons.height + 0.014, cartons.z - 0.13], material(0xf6f6f4, 0.4, 0.05));
  place(root, new THREE.TorusGeometry(0.05, 0.004, 8, 24), material(0xe9e9e6, 0.5, 0.05), [cartons.x - 0.06, cartons.height + 0.03, cartons.z - 0.13], { rotation: [Math.PI / 2, 0, 0], cast: false });

  const tall = FIXTURES.cartonTall;
  const cardboard = material(0xffffff, 0.92, 0, { map: createCardboardTexture("plain") });
  const printedCardboard = material(0xffffff, 0.92, 0, { map: createCardboardTexture("aircon") });
  const tallBox = new THREE.Mesh(new THREE.BoxGeometry(tall.width, tall.height, tall.depth), [cardboard, cardboard, cardboard, cardboard, printedCardboard, printedCardboard]);
  tallBox.position.set(tall.x, tall.height / 2, tall.z);
  tallBox.rotation.y = 0.04;
  tallBox.castShadow = true;
  tallBox.receiveShadow = true;
  root.add(tallBox);

  const open = FIXTURES.cartonOpen;
  const carton = group(root, "carton-open", [open.x, open.y ?? 0, open.z], -0.05);
  const wall = 0.008;
  box(carton, [open.width, wall, open.depth], [0, wall / 2, 0], cardboard);
  box(carton, [open.width, open.height, wall], [0, open.height / 2, -open.depth / 2 + wall / 2], cardboard);
  box(carton, [open.width, open.height, wall], [0, open.height / 2, open.depth / 2 - wall / 2], cardboard);
  box(carton, [wall, open.height, open.depth], [-open.width / 2 + wall / 2, open.height / 2, 0], cardboard);
  box(carton, [wall, open.height, open.depth], [open.width / 2 - wall / 2, open.height / 2, 0], cardboard);
  box(carton, [open.width - 0.03, 0.02, open.depth - 0.03], [0, 0.03, 0], material(0x6b4a2a, 0.95, 0), { cast: false });
  const flap = (size, position, rotation) => {
    const pivot = group(carton, "carton-flap", position);
    pivot.rotation.set(...rotation);
    box(pivot, size, [0, size[1] / 2, 0], cardboard);
  };
  flap([open.width, 0.2, wall], [0, open.height, -open.depth / 2], [-1.75, 0, 0]);
  flap([open.width, 0.2, wall], [0, open.height, open.depth / 2], [1.85, 0, 0]);
  flap([wall, 0.22, open.depth], [-open.width / 2, open.height, 0], [0, 0, 1.6]);
  flap([wall, 0.22, open.depth], [open.width / 2, open.height, 0], [0, 0, -1.7]);
  return root;
}

function tube(parent, points, radius, entryMaterial, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return place(parent, new THREE.TubeGeometry(curve, segments, radius, 10, false), entryMaterial);
}

export function buildDeskClutter(parent) {
  const root = group(parent, "desk-clutter");
  const top = FIXTURES.desk.height;
  const zipCase = roundedBox(root, [0.27, 0.13, 0.22], 0.05, [1.3, top + 0.065, -1.12], material(0x151515, 0.72, 0));
  zipCase.rotation.y = 0.25;
  place(root, new THREE.TorusGeometry(0.1, 0.004, 6, 32, Math.PI), material(0x3c3c3c, 0.4, 0.4), [1.3, top + 0.09, -1.12], { rotation: [0, 0.25, 0], cast: false });
  roundedBox(root, [0.16, 0.035, 0.1], 0.01, [0.95, top + 0.0175, -1.34], material(0xe4601c, 0.5, 0));
  for (let bit = 0; bit < 7; bit += 1) cylinder(root, 0.0028, 0.0028, 0.06, [0.895 + bit * 0.018, top + 0.06, -1.35], material(0xc3c6c8, 0.3, 0.8), { segments: 8, cast: false });
  roundedBox(root, [0.045, 0.03, 0.045], 0.006, [0.84, top + 0.015, -1.3], material(0xf4f4f2, 0.45, 0.05));
  const paper = material(0xf6f6f4, 0.9, 0);
  const sheetA = box(root, [0.3, 0.003, 0.21], [1.15, top + 0.0025, -1.42], paper, { cast: false });
  sheetA.rotation.y = 0.12;
  const sheetB = box(root, [0.3, 0.003, 0.21], [1.22, top + 0.0055, -1.4], paper, { cast: false });
  sheetB.rotation.y = -0.08;
  const cable = material(0x101010, 0.45, 0.05);
  tube(root, [[0.35, top + 0.1, -1.33], [0.55, top + 0.01, -1.4], [1.1, top + 0.006, -1.46], [1.5, top + 0.01, -1.37]], 0.004, cable);
  tube(root, [[0.22, top + 0.06, -1.3], [-0.05, top + 0.006, -1.05], [-0.3, top + 0.005, -0.88], [-0.33, top - 0.12, -0.86]], 0.004, cable);
  return root;
}

export function buildDoor(parent) {
  const root = group(parent, "office-door");
  const frameMaterial = material(0x5e4030, 0.55, 0.05);
  const centerX = DOOR.hingeX + DOOR.width / 2;
  box(root, [0.07, DOOR.height + 0.06, 0.14], [DOOR.hingeX - 0.035, (DOOR.height + 0.06) / 2, DOOR.z], frameMaterial);
  box(root, [0.07, DOOR.height + 0.06, 0.14], [DOOR.hingeX + DOOR.width + 0.035, (DOOR.height + 0.06) / 2, DOOR.z], frameMaterial);
  box(root, [DOOR.width + 0.14, 0.08, 0.14], [centerX, DOOR.height + 0.04, DOOR.z], frameMaterial);
  box(root, [DOOR.width + 0.1, 0.006, 0.12], [centerX, 0.003, DOOR.z], material(0x3a3a3a, 0.5, 0.2), { cast: false });
  const pivot = group(root, "office-door-pivot", [DOOR.hingeX, 0, DOOR.z]);
  const leaf = roundedBox(pivot, [DOOR.width - 0.02, DOOR.height - 0.02, 0.045], 0.004, [DOOR.width / 2, DOOR.height / 2, 0], createWalnutMaterial(), { name: "office-door-leaf" });
  leaf.material.map.repeat.set(1, 2);
  const chrome = CHROME();
  for (const side of [-1, 1]) {
    cylinder(pivot, 0.025, 0.025, 0.012, [DOOR.width - 0.1, 1.02, side * 0.03], chrome, { rotation: [Math.PI / 2, 0, 0], segments: 16, cast: false });
    cylinder(pivot, 0.01, 0.01, 0.13, [DOOR.width - 0.16, 1.02, side * 0.046], chrome, { rotation: [0, 0, Math.PI / 2], segments: 12 });
  }
  root.userData.pivot = pivot;
  return root;
}

export function buildWallFittings(parent) {
  const root = group(parent, "wall-fittings");
  roundedBox(root, [0.086, 0.086, 0.01], 0.006, [-0.04, 1.3, 2.194], material(0xf5f5f3, 0.4, 0.05), { cast: false });
  box(root, [0.03, 0.05, 0.006], [-0.04, 1.3, 2.186], material(0xe6e6e4, 0.4, 0.05), { cast: false });
  cylinder(root, 0.06, 0.06, 0.03, [-0.8, 2.735, 0.9], material(0xf4f4f2, 0.5, 0.05), { segments: 24, cast: false });
  sphere(root, 0.004, [-0.8, 2.718, 0.94], material(0x200000, 0.4, 0, { emissive: 0xff3030, emissiveIntensity: 1.5 }), { segments: 8, cast: false });
  roundedBox(root, [0.28, 0.04, 0.06], 0.01, [1.18, 0.02, -0.8], material(0xf4f4f2, 0.45, 0.05));
  box(root, [0.05, 0.03, 0.04], [1.1, 0.055, -0.8], material(0x161616, 0.5, 0.05));
  box(root, [0.05, 0.03, 0.04], [1.24, 0.055, -0.8], material(0x161616, 0.5, 0.05));
  return root;
}

export function buildCar(parent, color, position, yaw = 0) {
  const root = group(parent, "car", position, yaw);
  const paint = material(color, 0.32, 0.45);
  roundedBox(root, [4.3, 0.5, 1.8], 0.1, [0, 0.55, 0], paint);
  roundedBox(root, [2.3, 0.5, 1.62], 0.16, [-0.2, 1.02, 0], paint);
  box(root, [2.12, 0.3, 1.64], [-0.2, 1.03, 0], material(0x25303a, 0.2, 0.5));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(root, 0.32, 0.32, 0.22, [sx * 1.4, 0.32, sz * 0.8], material(0x1a1a1a, 0.8, 0.05), { rotation: [Math.PI / 2, 0, 0], segments: 18 });
  return root;
}

export function buildTree(parent, position) {
  const root = group(parent, "tree", position);
  cylinder(root, 0.12, 0.18, 2.4, [0, 1.2, 0], material(0x5a4433, 0.9, 0), { segments: 10 });
  sphere(root, 1.5, [0, 3.3, 0], material(0x4f7a3a, 0.95, 0), { scale: [1, 1.15, 1], segments: 14 });
  return root;
}
