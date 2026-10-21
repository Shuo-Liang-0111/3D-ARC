import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DOOR, FIXTURES, ROOM } from "./level.js";
import {
  box,
  buildAirConditioner,
  buildCabinet,
  buildCar,
  buildCot,
  buildDesk,
  buildDeskClutter,
  buildDoor,
  buildExecutiveChair,
  buildMonitor,
  buildPedestal,
  buildSkull,
  buildStorageCorner,
  buildTrashBin,
  buildTree,
  buildVisitorChair,
  buildWallFittings,
  buildWhiteboard,
  cylinder,
  material,
  place,
} from "./props.js";
import {
  createBlindMaterial,
  createCarpetMaterial,
  createFacadeTexture,
  createParkingLotTexture,
  createPlasterMaterial,
  createRibbedTexture,
  createWoodFloorMaterial,
  FLOOR_TILE_METERS,
} from "./surfaces.js";

// The room shell is single sided and faces inward, so the fixed overhead camera
// looks straight into the office (doll-house style) while the D435 first-person
// view still sees closed walls and a ceiling.

const WIDTH = ROOM.maxX - ROOM.minX;
const DEPTH = ROOM.maxZ - ROOM.minZ;
const HEIGHT = ROOM.height;
const CENTER_X = (ROOM.minX + ROOM.maxX) / 2;
const CENTER_Z = (ROOM.minZ + ROOM.maxZ) / 2;
const VESTIBULE_DEPTH = ROOM.vestibuleMaxZ - ROOM.maxZ;
const CORRIDOR_WIDTH = 1.8;
const GLASS_START_Z = -1.15;

export const SCENE_ROOT_NAME = "test_zpf2-graybox_baseline";

// app.js requires at least one loaded world asset before it enables the start
// button. This level has no external files: its "assets" are the procedural
// surface and furniture builds, which are complete as soon as createScene returns.
export const PROCEDURAL_ASSETS = Object.freeze([
  Object.freeze({ loaded: true, name: "procedural-surfaces", url: "procedural://test_zpf2/surfaces" }),
  Object.freeze({ loaded: true, name: "procedural-furniture", url: "procedural://test_zpf2/props" }),
  Object.freeze({ loaded: true, name: "procedural-shell", url: "procedural://test_zpf2/scene" }),
]);

function plane(parent, width, height, entryMaterial, position, rotation, name = "") {
  return place(parent, new THREE.PlaneGeometry(width, height), entryMaterial, position, { rotation, name, cast: false, receive: true });
}

function frameMaterial() { return material(0x2b2d30, 0.45, 0.55); }
function clearGlass() {
  return new THREE.MeshPhysicalMaterial({ color: 0xdbe6e8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
}
function frostedGlass() {
  return new THREE.MeshPhysicalMaterial({ color: 0xd6dbdb, roughness: 0.86, metalness: 0, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
}
function downlight(parent, position, radius = 0.07) {
  return place(parent, new THREE.CircleGeometry(radius, 24), material(0xffffff, 0.6, 0, { emissive: 0xfff1dc, emissiveIntensity: 2 }), position, { rotation: [Math.PI / 2, 0, 0], cast: false, receive: false });
}

function buildShell(root) {
  const floorMaterial = createWoodFloorMaterial();
  floorMaterial.map.repeat.set(WIDTH / FLOOR_TILE_METERS, DEPTH / FLOOR_TILE_METERS);
  floorMaterial.roughnessMap.repeat.copy(floorMaterial.map.repeat);
  plane(root, WIDTH, DEPTH, floorMaterial, [CENTER_X, 0, CENTER_Z], [-Math.PI / 2, 0, 0], "office-floor");
  plane(root, WIDTH, DEPTH, createPlasterMaterial(WIDTH, DEPTH, 0xecece8), [CENTER_X, HEIGHT, CENTER_Z], [Math.PI / 2, 0, 0], "office-ceiling");
  plane(root, WIDTH, HEIGHT, createPlasterMaterial(WIDTH, HEIGHT), [CENTER_X, HEIGHT / 2, ROOM.minZ], [0, 0, 0], "north-wall");
  const doorRight = DOOR.hingeX + DOOR.width;
  const westWidth = DOOR.hingeX - ROOM.minX;
  const eastWidth = ROOM.maxX - doorRight;
  const headerHeight = HEIGHT - DOOR.height - 0.06;
  plane(root, westWidth, HEIGHT, createPlasterMaterial(westWidth, HEIGHT), [ROOM.minX + westWidth / 2, HEIGHT / 2, ROOM.maxZ], [0, Math.PI, 0], "south-wall-west");
  plane(root, eastWidth, HEIGHT, createPlasterMaterial(eastWidth, HEIGHT), [doorRight + eastWidth / 2, HEIGHT / 2, ROOM.maxZ], [0, Math.PI, 0], "south-wall-east");
  plane(root, DOOR.width, headerHeight, createPlasterMaterial(DOOR.width, headerHeight), [DOOR.hingeX + DOOR.width / 2, HEIGHT - headerHeight / 2, ROOM.maxZ], [0, Math.PI, 0], "south-wall-header");
  const solidWestLength = GLASS_START_Z - ROOM.minZ;
  plane(root, solidWestLength, HEIGHT, createPlasterMaterial(solidWestLength, HEIGHT, 0xd6d3cb), [ROOM.minX, HEIGHT / 2, ROOM.minZ + solidWestLength / 2], [0, Math.PI / 2, 0], "west-wall-solid");
  const skirting = material(0x1c1c1c, 0.5, 0.05);
  box(root, [WIDTH, 0.08, 0.012], [CENTER_X, 0.04, ROOM.minZ + 0.006], skirting, { cast: false });
  box(root, [westWidth, 0.08, 0.012], [ROOM.minX + westWidth / 2, 0.04, ROOM.maxZ - 0.006], skirting, { cast: false });
  box(root, [eastWidth, 0.08, 0.012], [doorRight + eastWidth / 2, 0.04, ROOM.maxZ - 0.006], skirting, { cast: false });
  box(root, [0.012, 0.08, solidWestLength], [ROOM.minX + 0.006, 0.04, ROOM.minZ + solidWestLength / 2], skirting, { cast: false });
  place(root, new THREE.PlaneGeometry(0.6, 0.6), material(0xffffff, 0.6, 0, { emissive: 0xfff4e4, emissiveIntensity: 1.6 }), [0.1, HEIGHT - 0.008, -0.1], { rotation: [Math.PI / 2, 0, 0], cast: false, receive: false, name: "ceiling-panel" });
}

function buildPartition(root) {
  const frame = frameMaterial();
  const glassLength = ROOM.maxZ - GLASS_START_Z;
  const glassCenterZ = GLASS_START_Z + glassLength / 2;
  const bayLength = glassLength / 2;
  for (const z of [GLASS_START_Z, GLASS_START_Z + bayLength, ROOM.maxZ]) box(root, [0.05, HEIGHT, 0.05], [ROOM.minX, HEIGHT / 2, z], frame);
  for (const y of [0.025, 1.25, 2.15, HEIGHT - 0.025]) box(root, [0.05, 0.05, glassLength], [ROOM.minX, y, glassCenterZ], frame);
  const frosted = frostedGlass();
  const clear = clearGlass();
  for (let bay = 0; bay < 2; bay += 1) {
    const zc = GLASS_START_Z + bayLength * (bay + 0.5);
    plane(root, bayLength - 0.05, 1.2, frosted, [ROOM.minX + 0.01, 0.65, zc], [0, Math.PI / 2, 0], "partition-frosted");
    plane(root, bayLength - 0.05, HEIGHT - 1.25, clear, [ROOM.minX + 0.01, 1.25 + (HEIGHT - 1.25) / 2, zc], [0, Math.PI / 2, 0], "partition-glass");
  }

  // Corridor behind the partition (visual only).
  const corridorCenterX = ROOM.minX - CORRIDOR_WIDTH / 2;
  const corridorLength = ROOM.vestibuleMaxZ - ROOM.minZ;
  const corridorCenterZ = ROOM.minZ + corridorLength / 2;
  plane(root, CORRIDOR_WIDTH, corridorLength, createCarpetMaterial(CORRIDOR_WIDTH, corridorLength), [corridorCenterX, 0, corridorCenterZ], [-Math.PI / 2, 0, 0], "corridor-floor");
  plane(root, CORRIDOR_WIDTH, corridorLength, createPlasterMaterial(CORRIDOR_WIDTH, corridorLength, 0xf4f4f1), [corridorCenterX, HEIGHT, corridorCenterZ], [Math.PI / 2, 0, 0], "corridor-ceiling");
  plane(root, corridorLength, HEIGHT, createPlasterMaterial(corridorLength, HEIGHT, 0xe6e5e0), [ROOM.minX - CORRIDOR_WIDTH, HEIGHT / 2, corridorCenterZ], [0, Math.PI / 2, 0], "corridor-far-wall");
  plane(root, CORRIDOR_WIDTH, HEIGHT, createPlasterMaterial(CORRIDOR_WIDTH, HEIGHT, 0xe6e5e0), [corridorCenterX, HEIGHT / 2, ROOM.minZ], [0, 0, 0], "corridor-north-wall");
  plane(root, CORRIDOR_WIDTH, HEIGHT, createPlasterMaterial(CORRIDOR_WIDTH, HEIGHT, 0xe6e5e0), [corridorCenterX, HEIGHT / 2, ROOM.vestibuleMaxZ], [0, Math.PI, 0], "corridor-south-wall");
  const walnut = material(0x6b4a34, 0.55, 0.05);
  box(root, [0.9, 2.06, 0.04], [ROOM.minX - CORRIDOR_WIDTH + 0.03, 1.03, 1.4], walnut);
  box(root, [1.02, 0.06, 0.1], [ROOM.minX - CORRIDOR_WIDTH + 0.05, 2.09, 1.4], walnut);
  box(root, [0.22, 0.02, corridorLength - 0.3], [ROOM.minX - CORRIDOR_WIDTH + 0.14, HEIGHT - 0.02, corridorCenterZ], material(0xffe4bd, 0.6, 0, { emissive: 0xffd2a0, emissiveIntensity: 1.7 }), { cast: false, receive: false });
  for (const z of [-1.2, 0.6, 2.4]) downlight(root, [corridorCenterX, HEIGHT - 0.004, z], 0.06);
  const corridorLight = new THREE.PointLight(0xffd9ad, 6, 7, 2);
  corridorLight.position.set(corridorCenterX, 2.45, 0.6);
  root.add(corridorLight);
}

function buildVestibule(root) {
  const centerZ = ROOM.maxZ + VESTIBULE_DEPTH / 2;
  plane(root, WIDTH, VESTIBULE_DEPTH, createCarpetMaterial(WIDTH, VESTIBULE_DEPTH), [CENTER_X, 0, centerZ], [-Math.PI / 2, 0, 0], "vestibule-floor");
  plane(root, WIDTH, VESTIBULE_DEPTH, createPlasterMaterial(WIDTH, VESTIBULE_DEPTH, 0xf4f4f1), [CENTER_X, HEIGHT, centerZ], [Math.PI / 2, 0, 0], "vestibule-ceiling");
  plane(root, WIDTH, HEIGHT, createPlasterMaterial(WIDTH, HEIGHT, 0xe8e7e2), [CENTER_X, HEIGHT / 2, ROOM.vestibuleMaxZ], [0, Math.PI, 0], "vestibule-far-wall");
  plane(root, VESTIBULE_DEPTH, HEIGHT, createPlasterMaterial(VESTIBULE_DEPTH, HEIGHT, 0xe8e7e2), [ROOM.minX, HEIGHT / 2, centerZ], [0, Math.PI / 2, 0], "vestibule-west-wall");
  plane(root, VESTIBULE_DEPTH, HEIGHT, createPlasterMaterial(VESTIBULE_DEPTH, HEIGHT, 0xe8e7e2), [ROOM.maxX, HEIGHT / 2, centerZ], [0, -Math.PI / 2, 0], "vestibule-east-wall");
  plane(root, WIDTH, HEIGHT, createPlasterMaterial(WIDTH, HEIGHT, 0xe8e7e2), [CENTER_X, HEIGHT / 2, ROOM.maxZ + 0.001], [0, 0, 0], "vestibule-office-wall");
  const walnut = material(0x6b4a34, 0.55, 0.05);
  box(root, [0.9, 2.06, 0.04], [0.9, 1.03, ROOM.vestibuleMaxZ - 0.03], walnut);
  box(root, [1.02, 0.06, 0.1], [0.9, 2.09, ROOM.vestibuleMaxZ - 0.05], walnut);
  downlight(root, [CENTER_X, HEIGHT - 0.004, centerZ], 0.08);
  const light = new THREE.PointLight(0xfff0de, 5, 6, 2);
  light.position.set(CENTER_X, 2.5, centerZ);
  root.add(light);
}

function buildWindowWall(root) {
  const frame = material(0x35373a, 0.45, 0.5);
  const mullionZ = -0.55;
  for (const z of [ROOM.minZ, mullionZ, ROOM.maxZ]) box(root, [0.06, HEIGHT, 0.06], [ROOM.maxX, HEIGHT / 2, z], frame);
  box(root, [0.06, 0.1, DEPTH], [ROOM.maxX, 0.05, CENTER_Z], frame);
  box(root, [0.06, 0.06, DEPTH], [ROOM.maxX, HEIGHT - 0.03, CENTER_Z], frame);
  const glass = clearGlass();
  const blind = createBlindMaterial();
  const panes = [
    { z0: ROOM.minZ + 0.03, z1: mullionZ - 0.03 },
    { z0: mullionZ + 0.03, z1: ROOM.maxZ - 0.03 },
  ];
  for (const pane of panes) {
    const width = pane.z1 - pane.z0;
    const zc = (pane.z0 + pane.z1) / 2;
    plane(root, width, HEIGHT - 0.16, glass, [ROOM.maxX - 0.01, 0.1 + (HEIGHT - 0.16) / 2, zc], [0, -Math.PI / 2, 0], "window-glass");
    const blindWidth = width - 0.04;
    plane(root, blindWidth, 2.46, blind, [ROOM.maxX - 0.08, 1.37, zc], [0, -Math.PI / 2, 0], "window-blind");
    cylinder(root, 0.035, 0.035, blindWidth, [ROOM.maxX - 0.08, 2.64, zc], material(0xb7b5b0, 0.5, 0.2), { rotation: [Math.PI / 2, 0, 0], segments: 16 });
    box(root, [0.02, 0.025, blindWidth], [ROOM.maxX - 0.08, 0.14, zc], material(0xa9a7a2, 0.5, 0.2), { cast: false });
    cylinder(root, 0.003, 0.003, 2.3, [ROOM.maxX - 0.06, 1.3, pane.z1 - 0.05], material(0xd2d2ce, 0.4, 0.6), { segments: 6, cast: false });
  }
  box(root, [0.05, 0.16, 0.24], [ROOM.maxX - 0.05, 1.55, mullionZ], material(0x4a4c4f, 0.5, 0.3));
  cylinder(root, 0.075, 0.075, 0.06, [ROOM.maxX - 0.1, 1.55, mullionZ], material(0xcfcdc7, 0.5, 0.1), { rotation: [0, 0, Math.PI / 2], segments: 20 });
  const ribbed = createRibbedTexture();
  const hosePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(FIXTURES.airConditioner.x + 0.2, 0.6, FIXTURES.airConditioner.z),
    new THREE.Vector3(1.9, 0.82, FIXTURES.airConditioner.z - 0.04),
    new THREE.Vector3(1.85, 1.12, FIXTURES.airConditioner.z - 0.08),
    new THREE.Vector3(1.92, 1.42, mullionZ - 0.03),
    new THREE.Vector3(ROOM.maxX - 0.1, 1.55, mullionZ),
  ]);
  place(root, new THREE.TubeGeometry(hosePath, 48, 0.07, 14, false), material(0xffffff, 0.75, 0.05, { map: ribbed, bumpMap: ribbed, bumpScale: 0.004 }), [0, 0, 0], { name: "aircon-hose" });
}

function buildExterior(root) {
  const groundY = -4.5;
  const lot = place(root, new THREE.PlaneGeometry(32, 32), material(0xffffff, 0.95, 0, { map: createParkingLotTexture() }), [8, groundY, 0], { rotation: [-Math.PI / 2, 0, 0], cast: false, name: "parking-lot" });
  lot.receiveShadow = false;
  const facade = place(root, new THREE.PlaneGeometry(40, 22), material(0xffffff, 0.85, 0, { map: createFacadeTexture() }), [16, groundY + 11, 0], { rotation: [0, -Math.PI / 2, 0], cast: false, receive: false, name: "facade" });
  facade.frustumCulled = true;
  const colors = [0xf0f0ee, 0xbfc2c5, 0xf2f2f0, 0x2f4a7a, 0x1b1b1d, 0xf0f0ee, 0x8b8f93];
  colors.forEach((color, index) => buildCar(root, color, [11, groundY, -9.1 + index * 2.6], 0));
  buildTree(root, [14.5, groundY, -13]);
  buildTree(root, [14.5, groundY, 12]);
  box(root, [WIDTH + CORRIDOR_WIDTH, 4.5, DEPTH + VESTIBULE_DEPTH], [CENTER_X - CORRIDOR_WIDTH / 2, groundY + 2.25, CENTER_Z + VESTIBULE_DEPTH / 2], material(0xd6d2ca, 0.85, 0), { cast: false, receive: false, name: "building-mass" });
}

function buildLights(scene, renderer) {
  scene.background = new THREE.Color(0xd5d9dd);
  scene.fog = new THREE.Fog(0xd5d9dd, 26, 80);
  if (renderer?.capabilities) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;
    pmrem.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xeef2f6, 0x4f4a45, 0.36));
  const daylight = new THREE.DirectionalLight(0xeef2f6, 0.75);
  daylight.position.set(9, 7, -0.5);
  daylight.target.position.set(0.5, 0, 0);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.camera.left = -5;
  daylight.shadow.camera.right = 5;
  daylight.shadow.camera.top = 5;
  daylight.shadow.camera.bottom = -5;
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 30;
  daylight.shadow.bias = -0.00025;
  daylight.shadow.normalBias = 0.03;
  daylight.shadow.radius = 3;
  scene.add(daylight);
  scene.add(daylight.target);
  const panel = new THREE.PointLight(0xfff1dc, 4.5, 9, 2);
  panel.position.set(0.1, 2.5, -0.1);
  scene.add(panel);
}

export function createSmallOfficeScene(renderer) {
  const scene = new THREE.Scene();
  buildLights(scene, renderer);
  const root = new THREE.Group();
  root.name = SCENE_ROOT_NAME;
  scene.add(root);
  buildShell(root);
  buildPartition(root);
  buildVestibule(root);
  buildWindowWall(root);
  buildExterior(root);
  buildDesk(root);
  const monitor = buildMonitor(root);
  buildExecutiveChair(root);
  FIXTURES.visitorChairs.forEach((fixture) => buildVisitorChair(root, fixture));
  buildCabinet(root);
  buildPedestal(root);
  buildSkull(root);
  buildTrashBin(root);
  buildWhiteboard(root);
  const airConditioner = buildAirConditioner(root);
  buildCot(root);
  buildStorageCorner(root);
  buildDeskClutter(root);
  const door = buildDoor(root);
  buildWallFittings(root);
  return {
    scene,
    root,
    doorPivot: door.userData.pivot,
    airConditioner,
    monitor,
    airconVisual: null,
    screenVisual: null,
    assetReady: Promise.resolve(PROCEDURAL_ASSETS.map((asset) => ({ ...asset }))),
  };
}

export function syncSmallOfficeVisuals(world, state, delta = 0.016) {
  const targetAngle = state.doorOpen ? DOOR.openAngle : 0;
  world.doorPivot.rotation.y += (targetAngle - world.doorPivot.rotation.y) * (1 - Math.exp(-Math.max(delta, 0) * 4.5));
  if (world.airconVisual !== state.airconOn) {
    world.airconVisual = state.airconOn;
    const { display, displayOn, displayOff, led } = world.airConditioner.userData;
    display.material.map = state.airconOn ? displayOn : displayOff;
    display.material.needsUpdate = true;
    led.material.emissiveIntensity = state.airconOn ? 2.5 : 0;
  }
  if (world.screenVisual !== state.workstationChecked) {
    world.screenVisual = state.workstationChecked;
    const screen = world.monitor.userData.screen;
    screen.material.color.setHex(state.workstationChecked ? 0x16202e : 0x0a0b0c);
    screen.material.emissive.setHex(state.workstationChecked ? 0x1c3252 : 0x000000);
    screen.material.emissiveIntensity = state.workstationChecked ? 0.9 : 0;
  }
}
