// Focused lighting audit: real GLTF lights, cloned targets, unchanged fixture bounds.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LIBRARY_LAMP_ASSET, LIBRARY_LAMP_PLACEMENTS, activateLibraryFixtureLights } from '../../game/levels/rf02/lighting.js';
globalThis.ProgressEvent ??= class { constructor(type, fields) { Object.assign(this, {type}, fields); } };
const bytes=fs.readFileSync('public'+LIBRARY_LAMP_ASSET);
const size=bytes.readUInt32LE(12), doc=JSON.parse(bytes.subarray(20,20+size));
const emissive=doc.materials.find(m=>m.name==='RF02 warm white lamp diffuser');
assert.ok(emissive?.emissiveFactor?.every(v=>v>0));
assert.ok(doc.meshes.some(m=>m.primitives.some(p=>p.material===doc.materials.indexOf(emissive))));
// Keep actual mesh and light data; omit images for this headless geometry audit.
delete doc.images;delete doc.textures;delete doc.samplers;
doc.materials=doc.materials.map(()=>({pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));
doc.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+size).toString('base64');
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
const parent=new THREE.Group();
let count=0;
for(const [x,y,z,rotation] of LIBRARY_LAMP_PLACEMENTS) {
  const root=gltf.scene.clone(true);root.position.set(x,y,z);root.rotation.y=rotation;parent.add(root);
  root.traverse(o=>{if(o.isLight)o.visible=false});
  activateLibraryFixtureLights(root);root.updateMatrixWorld(true);
  const meshBounds=new THREE.Box3();root.traverse(o=>{if(o.isMesh)meshBounds.expandByObject(o)});
  root.traverse(o=>{
    if(!o.isLight)return;
    assert.ok(o.isSpotLight && o.visible && !o.castShadow);
    assert.equal(o.target.parent,o);
    const p=o.getWorldPosition(new THREE.Vector3()),t=o.target.getWorldPosition(new THREE.Vector3());
    const d=t.sub(p).normalize();assert.ok(d.y<-.99999);
    assert.ok(Math.abs(p.y-(y-.006))<1e-6);
    assert.ok(p.x>meshBounds.min.x&&p.x<meshBounds.max.x);
    assert.ok(p.z>meshBounds.min.z&&p.z<meshBounds.max.z);
    assert.ok(Math.abs(meshBounds.min.y-p.y)<.007);
    assert.ok(o.angle<Math.PI/2 && o.intensity>0);count++;
  });
}
assert.equal(count,24);
console.log(JSON.stringify({fixtures:12,downwardLights:count,emissiveDiffuser:true,allTargetsBoundToOwnFixture:true,emittersWithinLampFootprint:true,meshFloorGapMillimeters:6,noUpwardCone:true}));
