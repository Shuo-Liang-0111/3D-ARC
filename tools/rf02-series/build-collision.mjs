import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { LEVEL } from "../../game/levels/rf02/level.js";
import { ASSET_ROOT, CART } from "../../game/levels/rf02/series-layout.js";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); });
  }
};
const scene = new THREE.Scene();
for (const collider of LEVEL.staticColliders) {
  const height = collider.id.includes("wall") ? 3.6 : collider.id.includes("shelf") || collider.id.includes("stack") ? 1.8 : 1.1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(collider.maxX - collider.minX, height, collider.maxZ - collider.minZ), new THREE.MeshBasicMaterial());
  mesh.position.set((collider.minX + collider.maxX) / 2, height / 2, (collider.minZ + collider.maxZ) / 2);
  mesh.name = "COLLIDER_" + collider.id;
  mesh.userData = { collision: true, shape: "box", authoritative: "rf02/level.js" };
  scene.add(mesh);
}
const floor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 16), new THREE.MeshBasicMaterial());
floor.position.y = -0.05;
floor.name = "COLLIDER_floor";
floor.userData = { collision: true, shape: "box" };
scene.add(floor);
const result = await new GLTFExporter().parseAsync(scene, { binary: true });
const output = path.join("public", ASSET_ROOT, "library-collision.glb");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.from(result));
console.log(JSON.stringify({ output, nodes: scene.children.length, bytes: result.byteLength }));
const fixtures = new THREE.Scene();
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), new THREE.MeshStandardMaterial({ color: 0xe1dfd7, roughness: 0.95 }));
ceiling.name = "library-ceiling-interior-face";
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 3.599;
fixtures.add(ceiling);
for (const positionX of [-9, -3, 3, 9]) {
  for (const positionZ of [-4.8, 0.2, 5.2]) {
    for (const offset of [-0.86, 0.86]) {
      const suspension = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 8), new THREE.MeshStandardMaterial({ color: 0x6d7171, metalness: 0.65, roughness: 0.5 }));
      suspension.name = "luminaire-suspension-" + positionX + "-" + positionZ + "-" + offset;
      suspension.position.set(positionX + offset, 3.565, positionZ);
      fixtures.add(suspension);
    }
  }
}
const fixtureBytes = await new GLTFExporter().parseAsync(fixtures, { binary: true });
fs.writeFileSync(path.join("public", ASSET_ROOT, "ceiling-fixtures.glb"), Buffer.from(fixtureBytes));

const operations = new THREE.Scene();
const steel = new THREE.MeshStandardMaterial({ color: 0x6b7477, metalness: 0.7, roughness: 0.38 });
const latchMaterial = new THREE.MeshStandardMaterial({ color: 0xc77f36, metalness: 0.5, roughness: 0.4 });
function box(parent, name, size, position, material = steel) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.fromArray(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const parking = CART.parking;
const paint = new THREE.MeshStandardMaterial({ color: 0xf2ce36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
for (const side of [-1, 1]) {
  box(operations, "parking-side-" + side, [0.07, 0.003, parking.halfZ * 2], [parking.x + parking.halfX * side, 0.006, parking.z], paint);
  box(operations, "parking-end-" + side, [parking.halfX * 2, 0.003, 0.07], [parking.x, 0.006, parking.z + parking.halfZ * side], paint);
}
const operationBytes = await new GLTFExporter().parseAsync(operations, { binary: true });
fs.writeFileSync(path.join("public", ASSET_ROOT, "closing-fixtures.glb"), Buffer.from(operationBytes));
console.log(JSON.stringify({ revision: ASSET_ROOT, operationBytes: operationBytes.byteLength }));
