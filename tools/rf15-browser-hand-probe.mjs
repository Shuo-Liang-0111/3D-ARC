import fs from 'node:fs';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { BrowserContactHand } from '../game/levels/rf15/browser-contact-hand.js';
await RAPIER.init({});
const root = 'public/local-assets/levels/rf15/browser-physics-v1/';
const definition = JSON.parse(fs.readFileSync(root + 'hands.json')).hands.right;
const geometries = new Map();
for (const part of definition) for (const geom of part.geoms) if (geom.mesh && !geometries.has(geom.mesh)) {
  const bytes = fs.readFileSync(root + geom.mesh);
  geometries.set(geom.mesh, new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 240;
world.numSolverIterations = 16;
world.createCollider(RAPIER.ColliderDesc.cuboid(2, .05, 2).setTranslation(0, -.05, 0));
const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const hand = new BrowserContactHand(world, null, definition, geometries, 'right', { position: [0, .8, 0], quaternion: rotation.toArray() });
const point = hand.graspPoint();
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...point).setRotation(rotation).setCcdEnabled(true));
const collider = world.createCollider(RAPIER.ColliderDesc.cylinder(.07, .016).setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)).setMass(.22).setFriction(.9).setCollisionGroups(0x00020007),body);
collider.userData = { object:'knife' };
const support = world.createCollider(RAPIER.ColliderDesc.cuboid(.08,.01,.09).setTranslation(point.x,point.y-.08,point.z).setCollisionGroups(0x00010003));
const objects = new Map([['knife',{body}]]);
hand.setGrip(true,.9);
for (let frame = 0; frame < 2400; frame++) {
  if(frame > 480) hand.setPose(new THREE.Vector3(0,.8+Math.min(.1,(frame-480)/240*.025),0),rotation);
  if(frame===1800) hand.setGrip(false,.9);
  hand.beforeStep(world.timestep);
  world.step();
  hand.afterStep(world.timestep,objects);
  if(frame%240===0) console.log(JSON.stringify({frame,object:body.translation(),held:hand.held,contacts:hand.contacts}));
}
