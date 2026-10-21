import * as THREE from "three";
import { KITCHEN } from "./interaction-layout.js";
import { isBoiling } from "../rf12-3/engine.js";

function steamTexture() {
 const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
 const c=canvas.getContext("2d"),g=c.createRadialGradient(64,64,2,64,64,64);
 g.addColorStop(0,"rgba(245,250,255,.72)");g.addColorStop(.4,"rgba(230,240,248,.4)");g.addColorStop(1,"rgba(220,235,245,0)");
 c.fillStyle=g;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}
export function addKettleEffects(world) {
 world.filling=false;world.fillAmount=0;
 const water=new THREE.Mesh(new THREE.CircleGeometry(.032,48),new THREE.MeshPhysicalMaterial({color:0x72b6ce,roughness:.17,metalness:.15,transparent:true,opacity:.82,side:THREE.DoubleSide}));
 water.rotation.x=-Math.PI/2;water.name="RF10_KETTLE_WATER";world.props.kettle.add(water);world.kettleWater=water;
 const bubbles=new THREE.Group();world.props.kettle.add(bubbles);world.kettleBubbles=bubbles;
 for(let i=0;i<16;i++){
  const b=new THREE.Mesh(new THREE.SphereGeometry(.006,8,6),new THREE.MeshPhysicalMaterial({color:0xeaf9ff,transparent:true,opacity:.65,roughness:.06}));
  bubbles.add(b);
 }
 const steam=new THREE.Group();steam.name="RF10_KETTLE_BOILING_STEAM";world.scene.add(steam);world.kettleSteam=steam;
 const map=steamTexture();
 for(let i=0;i<22;i++)steam.add(new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,color:0xaabfcf})));
 const stream=new THREE.Mesh(new THREE.CylinderGeometry(.004,.005,1,12),new THREE.MeshPhysicalMaterial({color:0x9bd6e7,metalness:.1,roughness:.12,transparent:true,opacity:.7}));
 stream.name="RF10_FILL_WATER_STREAM";world.scene.add(stream);world.kettleStream=stream;
 const splash=new THREE.Group();world.scene.add(splash);world.kettleSplash=splash;
 for(let i=0;i<12;i++)splash.add(new THREE.Mesh(new THREE.SphereGeometry(.003,6,4),new THREE.MeshBasicMaterial({color:0xcfeeff,transparent:true,opacity:.75})));
}
export function syncKettleEffects(world,state) {
 const root=world.props.kettle,t=state.elapsed??0,filled=!!state.waterFilled;
 const boiling=!!isBoiling(state),filling=!!world.filling,amount=filling?world.fillAmount:filled?1:0;
 world.kettleWater.visible=amount>0;world.kettleWater.position.y=.164+amount*.009;
 world.kettleBubbles.visible=boiling;
 world.kettleBubbles.children.forEach((b,i)=>{
  const a=i*2.4+t*.5,p=(t*2+i/16)%1;
  b.position.set(Math.sin(a)*(.009+i%3*.008),.17+p*.006,Math.cos(a)*(.009+i%3*.008));
  b.scale.setScalar(.45+p*.8);
 });
 world.kettleSteam.visible=boiling;
 root.updateMatrixWorld(true);
 const mouth=root.localToWorld(new THREE.Vector3(0,.185,0));
 world.kettleSteam.children.forEach((p,i)=>{
  const life=(t*.65+i/22)%1,angle=i*2.399+t*.3;
  const origin=i%2?root.localToWorld(new THREE.Vector3(0,.14,.172)):mouth;
  p.position.copy(origin).add(new THREE.Vector3(Math.sin(angle)*(.016+life*.09),.01+life*.48,Math.cos(angle)*(.016+life*.05)));
  p.scale.setScalar(.075+life*.21);
  p.material.opacity=Math.sin(life*Math.PI)*.92;
  p.material.rotation=Math.sin(t+i)*.3;
 });
 world.kettleStream.visible=world.kettleSplash.visible=filling;
 if(filling){
  const from=new THREE.Vector3(KITCHEN.faucet.x,KITCHEN.faucet.y,KITCHEN.faucet.z);
  const to=root.localToWorld(new THREE.Vector3(.025,.164+amount*.009,0)),dir=from.clone().sub(to);
  world.kettleStream.position.copy(from).add(to).multiplyScalar(.5);
  world.kettleStream.scale.set(1+Math.sin(t*23)*.07,dir.length(),1);
  world.kettleStream.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  world.kettleSplash.children.forEach((d,i)=>{
   const p=(t*3+i/12)%1,a=i*2.4;
   d.position.copy(to).add(new THREE.Vector3(Math.cos(a)*p*.028,Math.sin(p*Math.PI)*.019,Math.sin(a)*p*.028));
  });
 }
}
