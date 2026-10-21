import assert from "node:assert/strict";
import { RF01_YARD_LAYOUT, RF01_CRATE_COLLIDERS, RF01_YARD_COLLIDERS } from "../game/rf01-yard-layout.js";
import { createInitialState, isWalkable } from "../game/levels/rf01-2/engine.js";
import { createInitialState as createParkState, updateMovement as movePark, interact as interactPark, getInteraction as parkInteraction } from "../game/engine.js";
import { LEVEL as PARK } from "../game/level.js";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { fitModelToSize, fitModelUniformlyToSize } from "../game/rf01-production-assets.js";
export async function readGeometry(path) {
  const source = readFileSync(path);
  const length = source.readUInt32LE(12);
  const description = JSON.parse(source.subarray(20, 20 + length));
  description.materials = (description.materials ?? []).map(() => ({ doubleSided: true }));
  delete description.images;
  delete description.textures;
  const encoded = Buffer.from(JSON.stringify(description));
  const json = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 32)]);
  const binary = source.subarray(20 + length);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const data = Buffer.concat([header, json, binary]);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "")).scene;
}
const boundsByKey = new Map();
const directory = "public/local-assets/cardinal/rf01/models/runtime/";
for (const [key, file, position, rotation, scale, fit, uniform] of [
  ["rack", "battery_storage_rack", [-6.8,0,-.35],0,1],
  ["cabinet", "control_cabinet", RF01_YARD_LAYOUT.cabinet,0,1],
  ["pump", "industrial_pump_unit", RF01_YARD_LAYOUT.pump,-Math.PI/2,1,[.85,1.05,1.75],true],
  ["pipe", "pipe_manifold", RF01_YARD_LAYOUT.manifold,-Math.PI/2,1,[2.6,1.7,.42],true],
  ...RF01_YARD_LAYOUT.crates.map((placement, index) => ["crate-" + index, "cargo_crate", placement.slice(0,3),placement[3],.62]),
  ...RF01_YARD_LAYOUT.hedges.map((position,index) => ["hedge-" + index,"hedge_planter",position,0,1,[1.6,1,.75]]),
  ["slot", "power_slot", [PARK.powerSlot.x,0,PARK.powerSlot.z],Math.PI,1],
]) {
  let model = await readGeometry(directory + "rf01_" + file + ".glb");
  if (fit) model = uniform ? fitModelUniformlyToSize(model,fit) : fitModelToSize(model,fit);
  model.position.set(...position); model.rotation.y = rotation; model.scale.setScalar(scale); model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  boundsByKey.set(key,bounds);
  console.log(JSON.stringify({key,min:bounds.min.toArray(),max:bounds.max.toArray()}));
}

function separated(first, second, clearance) {
  const left = boundsByKey.get(first);
  const right = boundsByKey.get(second);
  const gap = Math.max(right.min.x - left.max.x, left.min.x - right.max.x, right.min.z - left.max.z, left.min.z - right.max.z);
  assert.ok(gap >= clearance, first + " intersects " + second + ": " + gap);
  return gap;
}
const clearances = {
  hedgeRack: [separated("rack","hedge-0",.9), separated("rack","hedge-1",.9)],
  cabinetWall: boundsByKey.get("cabinet").min.x - 5.2,
  slotWall: boundsByKey.get("slot").min.x - 5.2,
  cabinetPump: separated("cabinet","pump",.3),
  slotEquipment: separated("slot","pump",1),
  crates: separated("crate-0","crate-1",.85),
};
assert.ok(clearances.cabinetWall > .2);
assert.ok(clearances.slotWall > .19);
const state = createInitialState();
for (const [index, collider] of RF01_CRATE_COLLIDERS.entries()) {
  const bounds = boundsByKey.get("crate-" + index);
  assert.ok(bounds.min.x > -4.55 && bounds.max.x < -.5);
  assert.ok(bounds.min.z > -6.45 && bounds.max.z < -2.1);
  assert.ok(Math.abs(bounds.min.y - .035) <= .006);
  assert.ok(bounds.min.x >= collider.minX && bounds.max.x <= collider.maxX);
  assert.ok(bounds.min.z >= collider.minZ && bounds.max.z <= collider.maxZ);
  assert.equal(isWalkable(state, (bounds.min.x + bounds.max.x)/2, (bounds.min.z + bounds.max.z)/2), false);
}
for (const collider of RF01_YARD_COLLIDERS) {
  assert.equal(isWalkable(state, (collider.minX+collider.maxX)/2, (collider.minZ+collider.maxZ)/2), false);
}
state.shutterLift = 2.36;
assert.equal(isWalkable(state, 1.6, -1.4), true);
assert.equal(isWalkable(state, 3.8, -5.5), true);
function walkPark(initial, x, z) {
  let state = initial;
  for (let frame=0; frame<3000; frame+=1) {
    const dx=x-state.player.x, dz=z-state.player.z;
    if (Math.hypot(dx,dz)<.035) return state;
    const distance=Math.hypot(dx,dz), yaw=state.player.yaw;
    state=movePark(state, {move:(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance, strafe:(dx*Math.cos(yaw)-dz*Math.sin(yaw))/distance}, Math.min(.02,distance/PARK.moveSpeed));
    assert.equal(state.failed,false);
  }
  assert.fail("RF-01 route blocked: "+JSON.stringify(state.player));
}
let park=createParkState();
park=walkPark(park,-6.8,1.1);
assert.equal(parkInteraction(park)?.type,"battery");
park=interactPark(park);
park=walkPark(park,-4.8,1.8);
park=walkPark(park,6.15,1.8);
assert.equal(parkInteraction(park)?.type,"slot");
park=interactPark(park);
assert.equal(park.powered,true);
for (const name of ["door-control","light-switch"]) {
  const path=directory+"workshop-v2-fit/"+name+".glb";
  const bytes=readFileSync(path);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(json.images.length>=2);
  assert.ok(json.images.every(image=>Number.isInteger(image.bufferView)));
  assert.ok(json.materials.some(material=>material.pbrMetallicRoughness?.baseColorTexture));
  const model=await readGeometry(path);
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-.24)<.002 && size.z<.15);
  console.log(JSON.stringify({control:name,dimensions:size.toArray(),images:json.images.length,bytes:bytes.length}));
}
console.log(JSON.stringify({revision:RF01_YARD_LAYOUT.revision,clearances,rf01PowerRestored:park.powered,reserve:park.progress}));
