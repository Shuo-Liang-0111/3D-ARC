import * as THREE from "three";
import {createClinicScene,syncClinicVisuals} from "./scene.js";
import {STATIONS} from "./level.js";
export function createSeriesScene(renderer){
 const w=createClinicScene(renderer);w.ceiling={visible:true};w.lamps={};w.carryTemplates={};
 w.assetReady=w.assetReady.then(results=>{
  w.assetRoots.environment.traverse(o=>{if(o.userData.cutawayCeiling||/ceiling|roof|ceiling-light/i.test(o.name)){o.userData.clinicCeiling=true;}});
  for(const [id,root] of Object.entries(w.items)){const model=root.clone(true);model.position.set(0,0,0);w.carryTemplates[id.startsWith("empty-")?"empty-box":id]=model;}
  return results;
 });
 for(const station of STATIONS){
  const g=new THREE.Group();g.name="call-indicator-"+station.id;
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.34,.13,.06),new THREE.MeshStandardMaterial({color:0xe6e7e3,roughness:.5}));
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.045,16,8),new THREE.MeshStandardMaterial({color:0x54685e,emissive:0x000000,roughness:.3}));
  lamp.scale.set(2.8,1,.55);lamp.position.z=.05;g.add(housing,lamp);
  g.position.set(station.id==="front-desk"?station.x:station.x+.3,station.id==="front-desk"?1.4:2.3,station.id==="front-desk"?station.z: -.90);
  if(station.id==="front-desk"){
   // Tabletop at y=.90; the base and stem physically support the indicator.
   g.position.x=station.x-.70;g.position.z=station.z-.19;
   const metal=new THREE.MeshStandardMaterial({color:0x85908b,metalness:.65,roughness:.38});
   const base=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.024,32),metal);
   base.name="front-desk-indicator-base";base.position.y=-.488;
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.016,.02,.44,16),metal);
   stem.name="front-desk-indicator-stem";stem.position.y=-.268;
   g.add(base,stem);
  }
  w.scene.add(g);w.lamps[station.id]=lamp;
 }
 return w;
}
export function prepareClinicView(w,{firstPerson}){
 w.ceiling.visible=firstPerson;
 w.assetRoots.environment.traverse(o=>{if(o.userData.clinicCeiling)o.visible=firstPerson;});
}
export function syncSeriesVisuals(w,s){
 syncClinicVisuals(w,s);
 for(const [id,p] of Object.entries(s.furniturePositions??{})){
   w.preparations[id].position.set(p.x,0,p.z);
   if(id==="chair")w.preparations[id].rotation.y=.3*(1-THREE.MathUtils.clamp(Math.abs(p.x+3.7)/.95,0,1));
  }
 for(const [id,lamp] of Object.entries(w.lamps)){
  const calls=s.requests.filter(r=>r.station===id&&r.status==="active"),urgent=calls.some(r=>r.urgent);
  lamp.material.color.setHex(calls.length?(urgent?0xd64a33:0xe4b844):0x54685e);
  lamp.material.emissive.setHex(calls.length?(urgent?0x9c2415:0x75551a):0);lamp.material.emissiveIntensity=urgent?.8+.4*Math.sin(s.clock*5):.6;
 }
}
