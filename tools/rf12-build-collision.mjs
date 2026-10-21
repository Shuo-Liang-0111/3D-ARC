import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((buffer) => { this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`; this.onloadend?.(); }); }
};

const root = "./public/local-assets/levels/rf12/models/runtime";
const parts = [
  ["COLLIDER_FLOOR", [8.4, 0.16, 6.8], [0, -0.08, 0]],
  ["COLLIDER_NORTH_WALL", [8.4, 2.8, 0.3], [0, 1.4, -3.4]],
  ["COLLIDER_WEST_WALL_REAR", [0.3, 2.8, 4.55], [-4.2, 1.4, -0.95]],
  ["COLLIDER_WEST_WALL_FRONT", [0.3, 2.8, 0.72], [-4.2, 1.4, 3.04]],
  ["COLLIDER_EAST_WALL", [0.3, 2.8, 6.8], [4.2, 1.4, 0]],
  ["COLLIDER_SOUTH_WALL_WEST", [3.25, 2.8, 0.3], [-2.58, 1.4, 3.4]],
  ["COLLIDER_SOUTH_WALL_EAST", [3.25, 2.8, 0.3], [2.58, 1.4, 3.4]],
  ["COLLIDER_COUNTER_WEST", [3.65, 0.92, 0.72], [-2.0, 0.46, -2.58]],
  ["COLLIDER_COUNTER_EAST", [3.6, 0.92, 0.72], [1.55, 0.46, -2.58]],
  ["COLLIDER_REFRIGERATOR", [0.92, 1.9, 0.68], [-3.55, 0.95, -1.0]],
  ["COLLIDER_ENTRY_CABINET", [1.35, 1.1, 0.6], [-3.1, 0.55, 1.85]],
];
const scene = new THREE.Scene();
const rootNode = new THREE.Group(); rootNode.name = "RF12_COLLISION"; scene.add(rootNode);
for (const [name, size, position] of parts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  mesh.name = name; mesh.position.set(...position); rootNode.add(mesh);
}
await mkdir(root, { recursive: true });
await new Promise((resolve, reject) => new GLTFExporter().parse(scene, async (data) => { await writeFile(`${root}/rf12_collision.glb`, Buffer.from(data)); resolve(); }, reject, { binary: true, onlyVisible: true }));
console.log(`${root}/rf12_collision.glb`);
