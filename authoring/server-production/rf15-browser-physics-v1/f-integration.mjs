import fs from 'node:fs';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle } from '../../arc-game/game/unitree-g1-dex1-model.js';
import { applyMujocoState } from '../../arc-game/game/mujoco-client.js';
import { BrowserPhysics } from '../../arc-game/game/levels/rf15/browser-physics.js';
import { RF15PhysicsWorld } from '../../arc-game/game/levels/rf15/browser-physics-world.js';
import { createVariantEngine } from '../../arc-game/game/levels/rf15/variant-engine.js';
import { LEVEL } from '../../arc-game/game/levels/rf15-1/level.js';
globalThis.ProgressEvent = class ProgressEvent { constructor(type, values) { Object.assign(this, values); this.type = type; } };
globalThis.window = globalThis;
globalThis.location = { search: '' };
globalThis.document = { querySelector: () => ({ dataset: {} }) };
const sanity = new RF15PhysicsWorld(); sanity.advance(1/240); console.log('sanity-passed');sanity.world.free();
const root = './public/local-assets/levels/rf15/browser-physics-v1/';
const definitions = JSON.parse(fs.readFileSync(root + 'hands.json')).hands;
const geometries = new Map();
for (const parts of Object.values(definitions)) for (const part of parts) for (const geom of part.geoms) if (geom.mesh && !geometries.has(geom.mesh)) {
  const bytes = fs.readFileSync(root + geom.mesh);
  geometries.set(geom.mesh, new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}
const model = await loadUnitreeG1Dex1Model({ url:'http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb', groundY:0 });
const robot = new THREE.Group(); robot.add(model); robot.userData.officialModel = model;
const profile = { id:'g1', setJointAngle:setUnitreeG1Dex1JointAngle };
robot.userData.robotProfile = profile;
const standing = JSON.parse(fs.readFileSync('./authoring/server-production/rf15-browser-physics-v1/standing-state.json'));
robot.userData.collisionRig = { world:null, parts:[], sync() {} };
const scene = new THREE.Scene();
const group = () => { const node = new THREE.Group(); scene.add(node); return node; };
const runtime = { ...createVariantEngine(LEVEL), LEVEL };
let state = runtime.createInitialState(); state.toolRoomOpen=true; state.toolDoorAngle=-Math.PI/2;
state.player={x:-6.135,z:-12.20,yaw:Math.PI};
const crops = Object.fromEntries(Object.keys(state.crops).map(id=>[id,group()]));
const produce = Object.fromEntries(Object.keys(state.items).map(id=>[id,group()]));
const view = { scene, field:{crops,produce,basket:group(),deposited:{}}, toolRoom:{tools:Object.fromEntries(['harvest-knife','hand-trowel','sprayer'].map(id=>[id,group()])),hinge:group()}, assetRoots:{scale:group(),jack:group()}, tail:group(),items:Object.fromEntries(Object.keys(state.items).map(id=>[id,group()])) };
applyMujocoState(robot,standing,profile,{groundY:0,projectWorldPose:false});
robot.position.x=state.player.x;robot.position.z=state.player.z;robot.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),state.player.yaw);
const physics = new BrowserPhysics(view,robot,definitions,geometries,{runtime,controlMode:'velocity',getState:()=>state,setState:next=>{state=next;},stop(){},message:message=>console.log(message)});
console.log('poses',Object.values(physics.arms).map(arm=>arm.nativePose()));
for (const hand of Object.values(physics.hands)) for (const part of hand.parts) if (!Object.values(part.body.translation()).every(Number.isFinite) || !Object.values(part.body.rotation()).every(Number.isFinite))console.log('invalid',part.spec.name);
if (process.env.PROBE_SIDE) {
  for (const side of ['left','right']) if(side!==process.env.PROBE_SIDE)physics.hands[side].dispose();
  physics.physics.advance(1/240);
  console.log('first-step-ok');process.exit(0);
}
let previousKnifeHeld = null;
function frame() {
  if (physics.busy) state=runtime.updateMovement(state,physics.motionInput(state),1/60);
  applyMujocoState(robot,standing,profile,{groundY:0,projectWorldPose:false});
  robot.position.x=state.player.x; robot.position.z=state.player.z;
  robot.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),state.player.yaw);
  physics.frame(1/60,true);
  if(physics.hands.right.held!==previousKnifeHeld) {
    console.log('knife-contact-change',JSON.stringify({phase:physics.action?.phase,elapsed:physics.action?.phaseTime,held:physics.hands.right.held,position:physics.physics.objects.get('harvest-knife').body.translation(),contacts:physics.hands.right.contacts}));previousKnifeHeld=physics.hands.right.held;
  }
}
function action(label) {
  physics.interact(); let phase='';
  for (let frameIndex=0;frameIndex<3000 && physics.busy;frameIndex++) {
    frame();
    if (physics.action?.phase==='release' && frameIndex%300===0)console.log('release-debug',JSON.stringify({phaseTime:physics.action.phaseTime,angles:physics.arms.left.angles,target:physics.arms.left.targetAngles,error:physics.arms.left.error,grasp:physics.arms.left.graspPose(),crop:physics.physics.objects.get('lettuce-1').body.translation(),contacts:physics.hands.left.contacts}));
    if (physics.action?.phase!==phase) {phase=physics.action?.phase;console.log(label,phase,JSON.stringify({action:physics.snapshot().action,error:physics.arms[physics.action?.side??'right'].error}));}
  }
  console.log(label,JSON.stringify({result:physics.lastResult,held:Object.values(physics.hands).map(hand=>hand.held)}));
  if (physics.lastResult?.result === 'failed') { console.log('failure',JSON.stringify(physics.snapshot())); process.exit(1); }
}
console.log('initial',JSON.stringify(physics.snapshot()));
for(let count=0;count<240;count++){ if(count<2)console.log('frame',count);frame(); }
action('pickup');
if (!process.env.HARVEST_ONLY) { action('return'); action('pickup-again'); }
for (let count=0;count<120;count++) frame();
if (process.env.FAST_FIXTURE) {
 const delta=new THREE.Vector3(10.28-state.player.x,0,-3.37-state.player.z);
 for(const hand of Object.values(physics.hands))for(const part of hand.parts)part.body.setTranslation(new THREE.Vector3().copy(part.body.translation()).add(delta),true);
 const knife=physics.physics.objects.get('harvest-knife').body;knife.setTranslation(new THREE.Vector3().copy(knife.translation()).add(delta),true);
 state.player.x=10.28;state.player.z=-3.37;physics.resetHandPose=true;frame();
}
for (const [targetX,targetZ] of process.env.FAST_FIXTURE ? [] : [[-4,-11.65],[-4,-9.2],[-2.6,-9.2],[-2.6,-8.7],[2.8,-8.7],[9.6,-8.7],[10.28,-4.8],[10.28,-3.37]]) {
 const start={...state.player};const countMax=Math.ceil(Math.hypot(targetX-start.x,targetZ-start.z)/.3*60);
 for(let count=1;count<=countMax;count++) {
  const fraction=count/countMax;state.player={x:start.x+(targetX-start.x)*fraction,z:start.z+(targetZ-start.z)*fraction,yaw:Math.PI};frame();
 }
 console.log('route',targetX,targetZ,physics.hands.right.held);
}
action('harvest');
for(let count=0;count<300;count++)frame();
console.log('standing',JSON.stringify({held:Object.values(physics.hands).map(hand=>hand.held),crouch:physics.crouch}));
for(const [targetX,targetZ] of [[10.28,1.1],[9.5,1.1],[9.5,2]]) {
 const start={...state.player};const countMax=Math.ceil(Math.hypot(targetX-start.x,targetZ-start.z)/.3*60);
 for(let count=1;count<=countMax;count++){const fraction=count/countMax;state.player={x:start.x+(targetX-start.x)*fraction,z:start.z+(targetZ-start.z)*fraction,yaw:start.yaw};frame();}
}
action('deposit');
for(let count=0;count<300;count++)frame();
console.log('basket',JSON.stringify({harvested:state.harvested,inside:physics.physics.insideBasket('lettuce-1')}));
if(process.env.ALL_CROPS) for(const crop of Object.values(state.crops).slice(1)) {
 const nextX=crop.x-.57,nextZ=crop.z;
 const delta=new THREE.Vector3(nextX-state.player.x,0,nextZ-state.player.z);
 for(const hand of Object.values(physics.hands))for(const part of hand.parts)part.body.setTranslation(new THREE.Vector3().copy(part.body.translation()).add(delta),true);
 for(const hand of Object.values(physics.hands))if(hand.held){const body=physics.physics.objects.get(hand.held).body;body.setTranslation(new THREE.Vector3().copy(body.translation()).add(delta),true);}
 state.player.x=nextX;state.player.z=nextZ;physics.resetHandPose=true;frame();
 action('harvest-'+crop.id);for(let count=0;count<300;count++)frame();
 const basket=physics.physics.objects.get('harvest-basket').body.translation();
 const toBasket=new THREE.Vector3(basket.x-.7-state.player.x,0,basket.z-state.player.z);
 for(const hand of Object.values(physics.hands))for(const part of hand.parts)part.body.setTranslation(new THREE.Vector3().copy(part.body.translation()).add(toBasket),true);
 for(const hand of Object.values(physics.hands))if(hand.held){const body=physics.physics.objects.get(hand.held).body;body.setTranslation(new THREE.Vector3().copy(body.translation()).add(toBasket),true);}
 state.player.x+=toBasket.x;state.player.z+=toBasket.z;physics.resetHandPose=true;frame();
 action('deposit-'+crop.id);for(let count=0;count<300;count++)frame();
 console.log('basket-count',state.harvested.length);
}
console.log('final',JSON.stringify(physics.snapshot()));
