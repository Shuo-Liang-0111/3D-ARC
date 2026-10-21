import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((buffer) => { this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`; this.onloadend?.(); }); }
};

const outputRoot = "./public/local-assets/cardinal/rf12-v2/models/runtime";
const material = (color, roughness = 0.7, metalness = 0.03) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = {
  floor: material(0xb6b9b5, 0.88, 0.02),
  wall: material(0xe7e1d7, 0.72, 0.01),
  grout: material(0xa9a59e, 0.92, 0.01),
  oak: material(0x8c6747, 0.58, 0.02),
  oakLight: material(0xb38a60, 0.62, 0.02),
  quartz: material(0xd7d1c6, 0.34, 0.03),
  steel: material(0x9ea9a8, 0.36, 0.45),
  darkSteel: material(0x2f3536, 0.46, 0.36),
  glass: material(0x8da9ad, 0.18, 0.08),
  rubber: material(0x1d2222, 0.84, 0.02),
  warmLight: material(0xf0ce95, 0.48, 0.02),
};

function box(parent, name, size, position, entryMaterial, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), entryMaterial);
  mesh.name = name; mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, name, radius, height, position, entryMaterial, rotation = [0, 0, 0], segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.96, height, segments), entryMaterial);
  mesh.name = name; mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cabinetRun(root, prefix, centerX, length, z) {
  box(root, `${prefix}_BODY`, [length, 0.82, 0.72], [centerX, 0.41, z], materials.oak);
  box(root, `${prefix}_TOP`, [length + 0.06, 0.08, 0.78], [centerX, 0.86, z], materials.quartz);
  const count = Math.max(3, Math.round(length / 0.86));
  const panelWidth = (length - 0.08 * (count - 1)) / count;
  for (let index = 0; index < count; index += 1) {
    const x = centerX - length / 2 + panelWidth / 2 + index * (panelWidth + 0.08);
    box(root, `${prefix}_DOOR_${index}`, [panelWidth - 0.03, 0.65, 0.035], [x, 0.45, z + 0.37], materials.oakLight);
    box(root, `${prefix}_HANDLE_${index}`, [0.14, 0.025, 0.025], [x, 0.53, z + 0.395], materials.steel);
  }
}
function upperRun(root, prefix, centerX, length, z) {
  box(root, `${prefix}_BODY`, [length, 0.78, 0.42], [centerX, 1.75, z], materials.oak);
  const count = Math.max(2, Math.round(length / 0.82));
  const panelWidth = length / count - 0.035;
  for (let index = 0; index < count; index += 1) {
    const x = centerX - length / 2 + (index + 0.5) * (length / count);
    box(root, `${prefix}_DOOR_${index}`, [panelWidth, 0.68, 0.035], [x, 1.75, z + 0.22], materials.oakLight);
    box(root, `${prefix}_HANDLE_${index}`, [0.13, 0.025, 0.025], [x, 1.65, z + 0.24], materials.steel);
  }
}

function createEnvironment() {
  const scene = new THREE.Scene();
  const root = new THREE.Group(); root.name = "RF12_V2_KITCHEN_ENVIRONMENT"; scene.add(root);
  box(root, "RF12_FLOOR_TILE_SURFACE", [8.4, 0.12, 6.8], [0, -0.06, 0], materials.floor);
  box(root, "RF12_FLOOR_BORDER_NORTH", [8.4, 0.035, 0.06], [0, 0.015, -3.26], materials.grout);
  box(root, "RF12_FLOOR_BORDER_SOUTH", [8.4, 0.035, 0.06], [0, 0.015, 3.26], materials.grout);

  box(root, "RF12_NORTH_WALL_TILE_LOW", [8.4, 1.15, 0.16], [0, 0.575, -3.32], materials.wall);
  box(root, "RF12_NORTH_WALL_TILE_HIGH", [8.4, 0.40, 0.16], [0, 2.60, -3.32], materials.wall);
  box(root, "RF12_NORTH_WALL_WINDOW_LEFT", [2.775, 1.25, 0.16], [-2.8125, 1.775, -3.32], materials.wall);
  box(root, "RF12_NORTH_WALL_WINDOW_RIGHT", [4.275, 1.25, 0.16], [2.0625, 1.775, -3.32], materials.wall);
  box(root, "RF12_WEST_WALL_REAR", [0.16, 2.8, 4.55], [-4.12, 1.4, -0.95], materials.wall);
  box(root, "RF12_WEST_WALL_FRONT", [0.16, 2.8, 0.72], [-4.12, 1.4, 3.04], materials.wall);
  box(root, "RF12_EAST_WALL_TILE", [0.16, 2.8, 6.8], [4.12, 1.4, 0], materials.wall);
  box(root, "RF12_SOUTH_WALL_WEST", [3.25, 2.8, 0.16], [-2.58, 1.4, 3.32], materials.wall);
  box(root, "RF12_SOUTH_WALL_EAST", [3.25, 2.8, 0.16], [2.58, 1.4, 3.32], materials.wall);

  box(root, "RF12_ENTRY_FRAME_LEFT", [0.10, 2.2, 0.16], [-1.02, 1.10, 3.20], materials.oakLight);
  box(root, "RF12_ENTRY_FRAME_RIGHT", [0.10, 2.2, 0.16], [1.02, 1.10, 3.20], materials.oakLight);
  box(root, "RF12_ENTRY_FRAME_TOP", [2.04, 0.10, 0.16], [0, 2.20, 3.20], materials.oakLight);
  const door = new THREE.Group(); door.name = "RF12_ENTRY_SLIDING_DOOR"; root.add(door);
  box(door, "RF12_ENTRY_GLASS_PANEL", [1.62, 1.92, 0.025], [1.94, 1.07, 3.08], materials.glass);
  for (const positionX of [1.09, 2.79]) box(door, `RF12_ENTRY_STILE_${positionX}`, [0.06, 2.04, 0.06], [positionX, 1.07, 3.08], materials.steel);
  for (const positionY of [0.08, 2.06]) box(door, `RF12_ENTRY_CROSSBAR_${positionY}`, [1.76, 0.06, 0.06], [1.94, positionY, 3.08], materials.steel);
  box(root, "RF12_ENTRY_GLASS_RAIL", [3.9, 0.06, 0.08], [0.93, 2.20, 3.06], materials.steel);

  box(root, "RF12_SERVICE_FRAME_REAR", [0.10, 2.18, 0.14], [-4.03, 1.09, 1.55], materials.oakLight);
  box(root, "RF12_SERVICE_FRAME_FRONT", [0.10, 2.18, 0.14], [-4.03, 1.09, 2.35], materials.oakLight);
  box(root, "RF12_SERVICE_FRAME_TOP", [0.10, 0.12, 0.94], [-4.03, 2.18, 1.95], materials.oakLight);

  const cabinets = new THREE.Group(); cabinets.name = "RF12_CABINETRY"; root.add(cabinets);
  cabinetRun(cabinets, "RF12_BASE_WEST", -2.0, 3.55, -2.58);
  cabinetRun(cabinets, "RF12_BASE_EAST", 1.605, 3.60, -2.58);
  upperRun(cabinets, "RF12_UPPER_WEST", -2.55, 2.45, -3.03);
  box(cabinets, "RF12_BACKSPLASH_UPSTAND", [7.25, 0.12, 0.035], [-0.2, 0.96, -3.20], materials.quartz);
  box(cabinets, "RF12_COUNTER_REAR_RETURN", [7.25, 0.08, 0.29], [-0.2, 0.86, -3.105], materials.quartz);

  const fixtures = new THREE.Group(); fixtures.name = "RF12_ARCHITECTURAL_FIXTURES"; root.add(fixtures);
  box(fixtures, "RF12_REFRIGERATOR_BAY_LEFT", [0.08, 2.18, 0.76], [-4.00, 1.09, -1.02], materials.oakLight);
  box(fixtures, "RF12_REFRIGERATOR_BAY_TOP", [0.95, 0.10, 0.76], [-3.55, 2.18, -1.02], materials.oakLight);
  box(fixtures, "RF12_ENTRY_TERMINAL_BACKBOARD", [1.25, 1.55, 0.06], [-3.35, 1.62, 2.96], materials.oak);

  const lights = new THREE.Group(); lights.name = "RF12_CEILING_FIXTURES"; root.add(lights);
  for (const [x, z] of [[-1.7, 0.15], [2.1, 0.15]]) {
    box(lights, `RF12_CEILING_LIGHT_${x}`, [1.15, 0.08, 0.18], [x, 2.74, z], materials.warmLight);
    box(lights, `RF12_CEILING_LIGHT_TRIM_${x}`, [1.22, 0.035, 0.24], [x, 2.79, z], materials.steel);
  }
  return scene;
}

function createWindow() {
  const scene = new THREE.Scene();
  const root = new THREE.Group(); root.name = "RF12_WINDOW_FRAME"; scene.add(root);
  const aluminum = material(0xd7dbd8, 0.3, 0.45);
  const glazing = new THREE.MeshPhysicalMaterial({ color: 0x9ebac1, roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.4, depthWrite: false });
  for (const positionX of [-0.645, 0.645]) box(root, `RF12_WINDOW_JAMB_${positionX}`, [0.06, 1.25, 0.14], [positionX, 0.625, 0], aluminum);
  for (const positionY of [0.03, 1.22]) box(root, `RF12_WINDOW_TRACK_${positionY}`, [1.23, 0.06, 0.14], [0, positionY, 0], aluminum);
  for (const [side, centerX, depth] of [["FIXED", -0.3025, -0.025], ["MOVING", 0.3025, 0.025]]) {
    const sash = new THREE.Group(); sash.name = `RF12_WINDOW_${side}_SASH`; root.add(sash);
    for (const edgeX of [centerX - 0.295, centerX + 0.295]) box(sash, `RF12_WINDOW_${side}_STILE_${edgeX}`, [0.035, 1.13, 0.03], [edgeX, 0.625, depth], aluminum);
    for (const edgeY of [0.0775, 1.1725]) box(sash, `RF12_WINDOW_${side}_RAIL_${edgeY}`, [0.59, 0.035, 0.03], [centerX, edgeY, depth], aluminum);
    box(sash, `RF12_WINDOW_${side}_GLASS`, [0.555, 1.06, 0.006], [centerX, 0.625, depth], glazing);
  }
  return scene;
}

function createCollision() {
  const scene = new THREE.Scene(); const root = new THREE.Group(); root.name = "RF12_V2_COLLISION"; scene.add(root);
  const parts = [
    ["COLLIDER_FLOOR", [8.4, 0.16, 6.8], [0, -0.08, 0]],
    ["COLLIDER_NORTH_WALL", [8.4, 2.8, 0.30], [0, 1.4, -3.4]],
    ["COLLIDER_WEST_WALL_REAR", [0.30, 2.8, 4.55], [-4.2, 1.4, -0.95]],
    ["COLLIDER_WEST_WALL_FRONT", [0.30, 2.8, 0.72], [-4.2, 1.4, 3.04]],
    ["COLLIDER_EAST_WALL", [0.30, 2.8, 6.8], [4.2, 1.4, 0]],
    ["COLLIDER_SOUTH_WALL_WEST", [3.25, 2.8, 0.30], [-2.58, 1.4, 3.4]],
    ["COLLIDER_SOUTH_WALL_EAST", [3.25, 2.8, 0.30], [2.58, 1.4, 3.4]],
    ["COLLIDER_COUNTER_WEST", [3.65, 0.92, 0.72], [-2.0, 0.46, -2.58]],
    ["COLLIDER_COUNTER_EAST", [3.60, 0.92, 0.72], [1.55, 0.46, -2.58]],
    ["COLLIDER_REFRIGERATOR", [0.92, 1.90, 0.68], [-3.55, 0.95, -1.0]],
    ["COLLIDER_ENTRY_CABINET", [1.35, 1.10, 0.60], [-3.1, 0.55, 1.85]],
  ];
  for (const [name, size, position] of parts) box(root, name, size, position, new THREE.MeshBasicMaterial());
  return scene;
}

async function exportScene(scene, output) {
  await mkdir(outputRoot, { recursive: true });
  await new Promise((resolve, reject) => new GLTFExporter().parse(scene, async (data) => { try { await writeFile(output, Buffer.from(data)); resolve(); } catch (error) { reject(error); } }, reject, { binary: true, onlyVisible: true }));
}

await exportScene(createEnvironment(), `${outputRoot}/kitchen_environment.glb`);
await exportScene(createCollision(), `${outputRoot}/kitchen_collision.glb`);
await exportScene(createWindow(), `${outputRoot}/kitchen_window_fitted.glb`);
console.log(JSON.stringify({ environment: `${outputRoot}/kitchen_environment.glb`, collision: `${outputRoot}/kitchen_collision.glb` }, null, 2));
