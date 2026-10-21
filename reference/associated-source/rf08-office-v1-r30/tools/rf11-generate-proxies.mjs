import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdir, writeFile } from "node:fs/promises";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const exporter = new GLTFExporter();
function makeRoot(name, parts) { const root = new THREE.Group(); root.name = name; for (const part of parts) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), new THREE.MeshBasicMaterial()); mesh.name = part.name; mesh.position.set(...part.position); root.add(mesh); } return root; }
function exportGlb(root, output) { return new Promise((resolve, reject) => exporter.parse(root, async (result) => { try { await writeFile(output, Buffer.from(result)); resolve(); } catch (error) { reject(error); } }, reject, { binary: true, trs: false, onlyVisible: true })); }
const root = "./public/local-assets/levels/rf11/models/runtime";
await mkdir(`${root}/interactables`, { recursive: true });
await exportGlb(makeRoot("RF11_COLLISION", [
  { name: "COLLIDER_RF11_FLOOR", size: [24, .16, 16], position: [0, -.08, 0] },
  { name: "COLLIDER_RF11_NORTH_WALL", size: [24, 4.2, .3], position: [0, 2.1, 8] },
  { name: "COLLIDER_RF11_WEST_WALL", size: [.3, 4.2, 16], position: [-12, 2.1, 0] },
  { name: "COLLIDER_RF11_EAST_WALL", size: [.3, 4.2, 16], position: [12, 2.1, 0] },
  { name: "COLLIDER_RF11_SOUTH_WALL_WEST", size: [10.3, 4.2, .3], position: [-6.85, 2.1, -8] },
  { name: "COLLIDER_RF11_SOUTH_WALL_EAST", size: [10.3, 4.2, .3], position: [6.85, 2.1, -8] },
  { name: "COLLIDER_RF11_WORKCELL_WEST", size: [3.7, 2.3, 3.5], position: [-8.35, 1.15, -.55] },
  { name: "COLLIDER_RF11_WORKCELL_EAST", size: [3.7, 2.3, 3.5], position: [8.35, 1.15, -.55] },
  { name: "COLLIDER_RF11_NORTH_RACK", size: [7.6, 2.2, 1.25], position: [0, 1.1, 5.72] },
  { name: "COLLIDER_RF11_TARGET_BASE", size: [3.6, .2, 1.8], position: [0, .1, -5.15] },
]), `${root}/rf11_collision.glb`);
await exportGlb(makeRoot("servo-pump-case", [{ name: "servo-pump-case-body", size: [.9, .48, .64], position: [0, .24, 0] }]), `${root}/interactables/servo_pump_case_fallback.glb`);
await exportGlb(makeRoot("cooperative-dolly", [{ name: "cooperative-dolly-deck", size: [1.8, .16, 1.1], position: [0, .08, 0] }]), `${root}/interactables/cooperative_dolly_fallback.glb`);
await exportGlb(makeRoot("assembly-base", [{ name: "assembly-base-deck", size: [3.4, .18, 1.8], position: [0, .09, 0] }]), `${root}/interactables/assembly_base_fallback.glb`);
