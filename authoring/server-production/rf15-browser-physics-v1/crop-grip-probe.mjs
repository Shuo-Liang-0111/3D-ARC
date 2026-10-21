import fs from 'node:fs';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RF15PhysicsWorld } from '../../arc-game/game/levels/rf15/browser-physics-world.js';
import { BrowserContactHand } from '../../arc-game/game/levels/rf15/browser-contact-hand.js';
const root = './public/local-assets/levels/rf15/browser-physics-v1/';
const definitions = JSON.parse(fs.readFileSync(root + 'hands.json')).hands;
const geometries = new Map();
for (const parts of Object.values(definitions)) for (const part of parts) for (const geom of part.geoms) if (geom.mesh && !geometries.has(geom.mesh)) {
  const bytes = fs.readFileSync(root + geom.mesh);
  geometries.set(geom.mesh, new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}
for (const sideways of [false, true]) {
  const physics = new RF15PhysicsWorld();
  const crop = physics.objects.get('lettuce-1');
  crop.colliders[1].setCollisionGroups(0x0002000b);
  const forward = new THREE.Vector3(1,0,0);
  const secondary = sideways ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,-1,0);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, secondary, new THREE.Vector3().crossVectors(forward,secondary)));
  const point = physics.graspPoint('lettuce-1');
  const palm = point.clone().sub(new THREE.Vector3(.14,-.04,0).applyQuaternion(rotation));
  const hand = new BrowserContactHand(physics.world,null,definitions.left,geometries,'left',{position:palm.toArray(),quaternion:rotation.toArray()});
  hand.setGrip(true);
  let contact = false;
  for (let frame = 0; frame < 1440; frame++) {
    if (frame === 480) { contact = hand.held === 'lettuce-1'; physics.cut('lettuce-1'); }
    physics.advance(1/240, step=> { hand.setPose(palm.clone().add(new THREE.Vector3(0,Math.max(0,Math.min(.15,(frame-480)/240*.04)),0)),rotation); hand.beforeStep(step); }, step=>hand.afterStep(step,physics.objects));
  }
  console.log(JSON.stringify({sideways,contact,held:hand.held,position:crop.body.translation(),contacts:hand.contacts}));
  hand.dispose(); physics.world.free();
}
