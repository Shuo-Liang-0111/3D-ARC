import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {createLeakSeriesScene,syncLeakSeries,prepareLeakView} from "../rf06/series-scene.js";
export {prepareLeakView};
export function createPestScene(){
 const w=createLeakSeriesScene();w.roots=[];
 const url="/local-assets/levels/rf06/pest-v2/cockroach.glb";
 const load=new Promise(resolve=>new GLTFLoader().load(url,g=>{
  for(let i=0;i<2;i++){
   const root=g.scene.clone(true);root.name="RF06_Roach_"+i;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(/_leg_|_antenna/.test(o.name))o.userData.rest=o.quaternion.clone();});w.scene.add(root);w.roots.push(root);
  }resolve({loaded:true,url,model:g.scene});
 },undefined,e=>resolve({loaded:false,url,error:String(e)})));
 w.assetReady=Promise.all([w.assetReady,load]).then(v=>v.flat(Infinity));
 const positions=new Float32Array(96*3),geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
 const material=new THREE.PointsMaterial({color:0xe1eee5,size:.026,transparent:true,opacity:.5,depthWrite:false});
 const mist=new THREE.Points(geometry,material);mist.frustumCulled=false;mist.visible=false;w.scene.add(mist);w.mist=mist;
 return w;
}
export function syncPestScene(w,s,delta){
 syncLeakSeries(w,s);w.wet.visible=false;w.stream.visible=false;w.pesticide.visible=s.canLocation==="shelf";
 s.roaches.forEach((r,i)=>{
  const root=w.roots[i];if(!root)return;root.position.set(r.x,.036,r.z);root.rotation.set(0,r.yaw,r.alive?0:Math.PI);
  if(!r.alive)root.position.y=.055;
  root.traverse(o=>{
   if(!o.userData.rest)return;o.quaternion.copy(o.userData.rest);
   if(r.alive){const side=o.name.startsWith("left")?1:-1,leg=Number(o.name.match(/_leg_(\d)/)?.[1]??0);o.rotateY(Math.sin(r.elapsed*65+leg*Math.PI*.8+side*Math.PI/2)*(/antenna/.test(o.name)?.12:.42));}
  });
 });
 w.mist.visible=Boolean(s.burst);
 if(s.burst){
  const b=s.burst,origin=new THREE.Vector3(b.origin.x,b.origin.y,b.origin.z),direction=new THREE.Vector3(b.direction.x,b.direction.y,b.direction.z),right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,direction).normalize();
  const age=.18-b.remaining,arr=w.mist.geometry.attributes.position.array;
  for(let i=0;i<96;i++){
   const seed=(i*.61803398875)%1,d=Math.min(2.1,age*12+(seed-.5)*.45),angle=i*2.39996,radius=Math.max(0,d)*Math.tan(Math.PI/9)*Math.sqrt((i*.41421)%1);
   const p=origin.clone().addScaledVector(direction,Math.max(0,d)).addScaledVector(right,Math.cos(angle)*radius).addScaledVector(up,Math.sin(angle)*radius);
   arr.set([p.x,Math.max(.04,p.y),p.z],i*3);
  }
  w.mist.geometry.attributes.position.needsUpdate=true;w.mist.material.opacity=.6*Math.min(1,b.remaining/.05);
 }
}
