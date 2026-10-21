import * as THREE from "three";
import {createWaterLeakScene,syncWaterLeakVisuals} from "./shared-scene.js";
import {LEVEL} from "./level.js";
import {DRAIN,CAPACITY} from "./series-engine.js";
export const gripHeight={wrench:.07,bucket:.43,mop:.82};
export function createLeakSeriesScene(){
 const w=createWaterLeakScene();
 const roof=new THREE.Mesh(new THREE.BoxGeometry(10.56,.10,7.76),new THREE.MeshStandardMaterial({color:0xe6e2da,roughness:.95}));
 roof.name="RF06_Shared_Ceiling";roof.position.y=2.8;roof.castShadow=false;w.scene.add(roof);

 w.ceiling=roof;
 const drain=new THREE.Group();drain.position.set(DRAIN.x,.018,DRAIN.z);
 const metal=new THREE.MeshStandardMaterial({color:0xa6b0b5,metalness:.85,roughness:.35});
 const rim=new THREE.Mesh(new THREE.BoxGeometry(.28,.012,.28),metal);drain.add(rim);
 const dark=new THREE.MeshStandardMaterial({color:0x142126,roughness:.9});
 for(let i=-3;i<=3;i++){const slot=new THREE.Mesh(new THREE.BoxGeometry(.21,.002,.009),dark);slot.position.set(0,.008,i*.028);drain.add(slot);}
 w.scene.add(drain);w.drain=drain;
 const waterMat=new THREE.MeshPhysicalMaterial({color:0x65b0bd,transparent:true,opacity:.58,roughness:.17,metalness:.1,depthWrite:false,clearcoat:1});
 const wetUniform={value:1};
 waterMat.onBeforeCompile=shader=>{
  shader.uniforms.wetRadius=wetUniform;
  shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec2 wetPosition;").replace("#include <begin_vertex>","#include <begin_vertex>\nwetPosition=position.xy;");
  shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nvarying vec2 wetPosition; uniform float wetRadius;").replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\nvec2 p=wetPosition-vec2(.5,.25);float a=atan(p.y,p.x);float edge=wetRadius*(1.0+.065*sin(a*5.0)+.04*cos(a*9.0));if(length(p*vec2(.85,1.1))>edge) discard;");
 };
 const wet=new THREE.Mesh(new THREE.PlaneGeometry(2.77,1.95),waterMat);
 wet.name="RF06_WetFloor";wet.rotation.x=-Math.PI/2;wet.position.set(-3.18,.052,2.15);w.scene.add(wet);
 w.wet=wet;w.wetUniform=wetUniform;
 const level=new THREE.Mesh(new THREE.CircleGeometry(.135,40),new THREE.MeshPhysicalMaterial({color:0x65b0bd,transparent:true,opacity:.72,roughness:.17,metalness:.1}));level.rotation.x=-Math.PI/2;level.name="RF06_Bucket_Water";w.scene.add(level);w.bucketWater=level;
 const stream=new THREE.Mesh(new THREE.CylinderGeometry(.009,.016,.52,12),waterMat.clone());stream.position.set(LEVEL.leak.x,.30,LEVEL.bucketDrop.z);w.scene.add(stream);w.stream=stream;
 const pour=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,1,12),waterMat.clone());pour.visible=false;w.scene.add(pour);w.pour= pour;
 const labelCanvas=document.createElement("canvas");labelCanvas.width=256;labelCanvas.height=80;
 const texture=new THREE.CanvasTexture(labelCanvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));label.scale.set(.6,.1875,1);w.scene.add(label);
 w.waterLabel={canvas:labelCanvas,texture,sprite:label,text:null};
 return w;
}
export function syncLeakSeries(w,s){
 const visibleState={...s,items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,v.location==="returned"?{...v,location:"floor"}:v]))};
 syncWaterLeakVisuals(w,visibleState);
 w.leakVisual.visible=false;w.assetRoots.leak.visible=false;
 const area=s.mode===1?(s.puddleClean?0:3):s.water;
 w.wet.visible=area>.001;w.wetUniform.value=.60*Math.sqrt(area/3);
 w.stream.visible=!s.valveClosed;
 const root=w.controller?.heldRoot?.visible&&s.carriedItem==="bucket"?w.controller.heldRoot:w.assetRoots.items.bucket;
 const action=w.controller?.action;
 const pouring=action?.selected.type==="empty"&&action.phase==="operate";
 const displayWater=s.bucketWater*(pouring?1-THREE.MathUtils.smoothstep(action.time,.3,1.6):1);
 w.pour.visible=Boolean(pouring&&action.time>.3&&action.time<1.6&&root?.visible);
 if(w.pour.visible){const top=root.localToWorld(new THREE.Vector3(.14,.28,0)),bottom=new THREE.Vector3(DRAIN.x,.03,DRAIN.z),direction=top.clone().sub(bottom);w.pour.position.copy(top).add(bottom).multiplyScalar(.5);w.pour.scale.y=direction.length();w.pour.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}
 w.bucketWater.visible=s.mode===3&&displayWater>.001&&Boolean(root?.visible);
 if(w.bucketWater.visible){root.updateWorldMatrix(true,false);w.bucketWater.position.copy(root.localToWorld(new THREE.Vector3(0,.045+.22*displayWater/CAPACITY,0)));w.bucketWater.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));}
 w.waterLabel.sprite.visible=s.mode===3&&Boolean(root?.visible);
 if(w.waterLabel.sprite.visible){
  w.waterLabel.sprite.position.copy(root.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,.65,0));
  const text=s.bucketWater.toFixed(1)+" / "+CAPACITY+" L";
  if(w.waterLabel.text!==text){const c=w.waterLabel.canvas.getContext("2d");c.clearRect(0,0,256,80);c.fillStyle="#13252dde";c.fillRect(0,0,256,80);c.fillStyle=s.bucketWater>=CAPACITY-.01?"#ffd386":"white";c.font="bold 38px sans-serif";c.textAlign="center";c.fillText(text,128,54);w.waterLabel.texture.needsUpdate=true;w.waterLabel.text=text;}
 }
}

export function prepareLeakView(w,{firstPerson}){
 w.ceiling.visible=firstPerson;
 w.assetRoots.environment.traverse(o=>{if(/Ceiling_Light/.test(o.name))o.visible=firstPerson;});
}
