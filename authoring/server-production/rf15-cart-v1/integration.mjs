import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle } from '../../arc-game/game/unitree-g1-dex1-model.js';
import { applyMujocoState } from '../../arc-game/game/mujoco-client.js';
import { InteractionAnimation } from '../../arc-game/game/levels/rf15/interaction-animation.js';
import { createVariantEngine } from '../../arc-game/game/levels/rf15/variant-engine.js';
import { LEVEL } from '../../arc-game/game/levels/rf15-2/level.js';
import { FIELD } from '../../arc-game/game/levels/rf15/field-layout.js';
import { TOOL_ROOM } from '../../arc-game/game/levels/rf15/tool-room-layout.js';

globalThis.ProgressEvent = class { constructor(type, values) { Object.assign(this, values); } };
globalThis.location = { search: '' };
globalThis.document = { querySelector: () => ({ dataset: {} }) };
const root = './public/local-assets/levels/rf15/browser-physics-v1/';
const definitions = JSON.parse(fs.readFileSync(root + 'hands.json')).hands;
const geometries = new Map();
for (const parts of Object.values(definitions)) for (const part of parts) for (const geom of part.geoms) if (geom.visual && !geometries.has(geom.mesh)) {
  const bytes = fs.readFileSync(root + geom.mesh);
  geometries.set(geom.mesh, new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}
const model = await loadUnitreeG1Dex1Model({ url: 'http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb', groundY: 0 });
const robot = new THREE.Group(); robot.add(model); robot.userData.officialModel = model;
const profile = { id: 'g1', setJointAngle: setUnitreeG1Dex1JointAngle }; robot.userData.robotProfile = profile;
const standing = JSON.parse(fs.readFileSync('./authoring/server-production/rf15-browser-physics-v1/standing-state.json'));
const runtime = { ...createVariantEngine(LEVEL), LEVEL };
let state = runtime.createInitialState(); state.toolRoomOpen = true; state.toolDoorAngle = -Math.PI / 2;
state.player = { x: -5.95, z: -11.85, yaw: Math.PI };
const scene = new THREE.Scene();
const group = point => { const node = new THREE.Group(); node.position.set(point?.x || 0, point?.y || 0, point?.z || 0); node.rotation.y = point?.rotation || 0; scene.add(node); return node; };
const view = { scene, field: { crops: Object.fromEntries(Object.values(state.crops).map(crop => [crop.id, group(crop)])), produce: Object.fromEntries(Object.values(state.items).map(item => [item.id, group(item)])), basket: group(FIELD.basket), deposited: {} }, toolRoom: { tools: { 'harvest-knife': group(TOOL_ROOM.harvest), 'hand-trowel': group(TOOL_ROOM.trowel), sprayer: group(TOOL_ROOM.sprayer) } }, items: Object.fromEntries(Object.keys(state.items).map(id => [id, group()])) };
const animation = new InteractionAnimation(view, robot, definitions, geometries, { runtime, getState: () => state, setState: next => { state = next; }, stop() {}, message: console.log });
function frame(running = true) {
  if (running && animation.busy) state = runtime.updateMovement(state, animation.motionInput(state), 1 / 60);
  applyMujocoState(robot, standing, profile, { groundY: 0, projectWorldPose: false });
  robot.position.set(state.player.x, 0, state.player.z); robot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.player.yaw);
  animation.frame(1 / 60, running && !state.complete && !state.failed);
}

state.player={x:1.2,z:6.14,yaw:Math.PI};frame();animation.interact();
let phase;let maxError=0;
for(let i=0;i<7000 && animation.busy;i++) {
 frame();
 if(phase!==animation.action?.phase){phase=animation.action?.phase;console.log('PHASE',phase,animation.action?.elapsed,state.cart, Object.fromEntries(Object.entries(animation.arms).map(([side,arm])=>[side,{error:arm.error,pose:arm.graspPose().position}])));}
 if(phase==='push') for(const side of ['left','right']) maxError=Math.max(maxError,animation.arms[side].graspPose().position.distanceTo(animation.cartAnimation.targets()[side]));
}
console.log('RESULT',JSON.stringify({complete:state.complete,cart:state.cart,last:animation.lastResult,maxError,phase,progress:state.progress}));
assert.equal(state.complete,true);assert.equal(animation.lastResult.result,'parked');assert.ok(maxError<.09);
