import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MOUNTS} from './fixture-layout.js';
import {createLaboratoryScene,syncLaboratoryVisuals} from './scene.js';
import {CASE,MODULE,CONTAINER,SINK,DEVICES,gripHeight} from './series-engine.js';
export {gripHeight};
const mat=(color,metalness=.15)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.5});
function mesh(root,g,m,p,name){const o=new THREE.Mesh(g,m);o.position.set(...p);o.name=name;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
function box(root,size,p,m,name){return mesh(root,new THREE.BoxGeometry(...size),m,p,name);}
function text(root,name,p,yaw,w=.62,h=.23){const c=document.createElement('canvas');c.width=512;c.height=192;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=mesh(root,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,toneMapped:false}),p,name);o.rotation.y=yaw;o.userData={canvas:c,texture:t,value:''};return o;}
function write(o,value,color){if(o.userData.value===value)return;const {canvas,texture}=o.userData,c=canvas.getContext('2d');c.fillStyle='#101e24';c.fillRect(0,0,512,192);c.fillStyle=color;c.textAlign='center';c.font='bold 66px sans-serif';c.fillText(value,256,117);texture.needsUpdate=true;o.userData.value=value;}
export function createSeriesScene(){
 const w=createLaboratoryScene();
 w.scene.traverse(o=>{if(o.isMesh&&Math.abs(o.position.x-2)<.001&&Math.abs(o.position.y-2.18)<.001)o.visible=false;});w.seriesRoot=new THREE.Group();w.scene.add(w.seriesRoot);w.ceiling=new THREE.Group();w.ceiling.name='rf07-first-person-ceiling';w.seriesRoot.add(w.ceiling);
 const trayX=SINK.x-.16;
 const white=mat(0xd9dedb),rail=mat(0x929e9e,.5),dark=mat(0x27373c,.25);
 box(w.ceiling,[24,.12,16],[0,3.36,0],white,'ceiling-panels');
 for(let x=-12;x<=12;x+=2)box(w.ceiling,[.035,.035,16],[x,3.285,0],rail,'ceiling-grid-x');
 for(let z=-8;z<=8;z+=2)box(w.ceiling,[24,.035,.035],[0,3.285,z],rail,'ceiling-grid-z');
 for(let x=-8;x<=8;x+=4)for(let z=-4;z<=4;z+=4){box(w.ceiling,[1.25,.07,.55],[x,3.25,z],rail,'ceiling-light-frame');box(w.ceiling,[1.16,.015,.46],[x,3.207,z],new THREE.MeshStandardMaterial({color:0xf6fff9,emissive:0xe7f7eb,emissiveIntensity:1.1}),'ceiling-diffuser');}
 w.ceiling.visible=false;
 // A supported containment tray beside the existing handwash basin, shared by all three levels.
 box(w.seriesRoot,[.70,.06,.80],[trayX,.9,SINK.z],rail,'containment-table');
 for(const dx of [-.29,.29])for(const dz of [-.34,.34])box(w.seriesRoot,[.035,.88,.035],[trayX+dx,.44,SINK.z+dz],rail,'containment-leg');
 box(w.seriesRoot,[.64,.025,.71],[trayX,.9475,SINK.z],white,'tray-base');
 for(const dz of [-.35,.35])box(w.seriesRoot,[.66,.075,.025],[trayX,.99,SINK.z+dz],rail,'tray-rim');
 for(const dx of [-.32,.32])box(w.seriesRoot,[.025,.075,.7],[trayX+dx,.99,SINK.z],rail,'tray-rim');
 w.power={};w.alarms={};
 const liquid=(id)=>{
  const shape=new THREE.Shape();for(let i=0;i<=48;i++){const t=i/48*Math.PI*2,r=.22*(1+.10*Math.sin(t*5)+.07*Math.cos(t*7));const x=Math.cos(t)*r,y=Math.sin(t)*r*.78;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}
  const puddle=mesh(w.seriesRoot,new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:0x95acaa,transparent:true,opacity:.26,roughness:.17,metalness:.12,depthWrite:false}),[0,.006,0],'leak-puddle-'+id);puddle.rotation.x=-Math.PI/2;puddle.visible=false;
  const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(.0045,8,6),new THREE.MeshPhysicalMaterial({color:0xb9d9d6,transparent:true,opacity:.60,roughness:.08,metalness:0}),14);drops.name='leak-droplets-'+id;drops.visible=false;w.seriesRoot.add(drops);return {puddle,drops};
 };
 const ready=w.assetReady;
 const containerReady=new GLTFLoader().loadAsync('/local-assets/levels/rf07/realism-v2/specimen_container.glb').then(g=>({loaded:true,name:'leak-container',model:g.scene}));
w.assetReady=Promise.all([ready,containerReady]).then(([results,containerResult])=>{
  w.assetRoots.environment.traverse(o=>{if(o.name.startsWith('Specimen_Position_'))o.visible=false;});
  const container=containerResult.model;container.name='rf07-leak-container';container.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});w.seriesRoot.add(container);w.container=container;
  for(const fallback of Object.values(w.cabinets))fallback.visible=false;
  for(const [id,c]of Object.entries(w.assetRoots.cabinets)){
   c.traverse(o=>{if(o.name.startsWith('rf07-status-')||o.name.startsWith('rf07-label-cold-'))o.visible=false;});
   const lens=c.getObjectByName('RF07_POWER_LENS');lens.material=lens.material.clone();w.power[id]={lens};
   // A thin identifier decal follows the raycast fascia normal, 0.5 mm above its surface.
   const label=text(c,'cabinet-id-'+id,[.0000094,1.850030,.351044],0,.08,.038);label.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(.0188343,.0599805,.9980218).normalize());write(label,id.slice(-2),'#e9f1ec');
  }
  for(const d of DEVICES){
   const owner=d.id==='container'?container:w.assetRoots.fixtures.getObjectByName('rf07-cardinal-'+d.id);
   const lamp=owner.getObjectByName('RF07_ALARM_LENS');lamp.material=lamp.material.clone();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,70,35,1)');gradient.addColorStop(.22,'rgba(255,25,8,.8)');gradient.addColorStop(1,'rgba(255,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
   const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),color:0xff4525,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,toneMapped:false}));halo.name='rf07-alarm-optical-glow';halo.scale.set(.11,.11,1);const mount=MOUNTS.bsc.alarm;halo.position.fromArray(mount.point).addScaledVector(new THREE.Vector3(...mount.normal),.009);owner.add(halo);
   const spill=new THREE.PointLight(0xff1604,0,.42,2);spill.position.copy(halo.position).addScaledVector(new THREE.Vector3(...mount.normal),.035);owner.add(spill);
   w.alarms[d.id]={owner,lamp,halo,spill,outlet:owner.getObjectByName('RF07_LEAK_OUTLET'),...liquid(d.id)};
  }
  const installed=w.assetRoots.module.clone(true);installed.position.set(0,.044,.135);installed.name='RF07_INSTALLED_MODULE';w.assetRoots.case.add(installed);
  w.deliveredCase=w.assetRoots.case.clone(true);w.deliveredCase.visible=false;w.scene.add(w.deliveredCase);w.deliveryTime=0;
  w.assetRoots.items={...w.assetRoots.samples,'transport-case':w.assetRoots.case,'cooling-module':w.assetRoots.module,'leak-container':container};
  // Metal equipment needs a neutral reflection field; otherwise existing metal maps render black.
  const faces=Array.from({length:6},()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,32);g.addColorStop(0,'#eef4f0');g.addColorStop(.55,'#b5c6c9');g.addColorStop(1,'#637577');x.fillStyle=g;x.fillRect(0,0,32,32);return c;});
  const env=new THREE.CubeTexture(faces);env.needsUpdate=true;env.colorSpace=THREE.SRGBColorSpace;w.scene.environment=env;w.scene.environmentIntensity=.65;
  return [...results,containerResult];
 });return w;
}
export function prepareSeriesView(w,{firstPerson}){w.ceiling.visible=firstPerson;}
export function syncSeriesVisuals(w,s,delta=0){
 syncLaboratoryVisuals(w,s);
 const deliveryAction=w.controller?.action?.selected?.type==='cabinet'&&w.controller?.action?.selected?.cabinet==='cold-02';
 w.deliveryTime=s.delivered?(w.deliveryTime??0)+delta:0;
 const door=w.assetRoots.cabinets['cold-02'].getObjectByName('RF07_CABINET_DOOR');
 if(door){const target=deliveryAction&&(!s.delivered||w.deliveryTime<1.25)?-Math.PI*.57:0;door.rotation.y+=THREE.MathUtils.clamp(target-door.rotation.y,-delta*2.8,delta*2.8);}
 if(w.deliveredCase){w.deliveredCase.visible=s.delivered;w.deliveredCase.position.set(10.58+Math.min(1,w.deliveryTime/.85)*.24,.755,0);w.deliveredCase.rotation.y=-Math.PI/2;
  syncCaseAsset(w.deliveredCase,s,true);
 }

 for(const [id,p]of Object.entries(w.power)){const on=s.cabinetPower[id];p.lens.material.color.set(on?0x247847:0x422c18);p.lens.material.emissive.set(on?0x28b15a:0);p.lens.material.emissiveIntensity=on?.65:0;}
 const place=(o,p)=>{if(o){o.position.set(p.x,p.y,p.z);o.rotation.y=p.yaw??0;}};
 place(w.assetRoots.case,s.casePoint);place(w.caseRoot,s.casePoint);place(w.assetRoots.module,s.modulePoint);
 for(const root of [w.assetRoots.case,w.caseRoot])syncCaseAsset(root,s);
 for(const [k,o]of Object.entries(w.assetRoots.samples)){const p=s.samples[k];if(p.location==='storage'||p.location==='floor')place(o,p);}
 if(w.container){w.container.visible=s.containerLocation!=='carried';place(w.container,s.containerPoint);}
 for(const [k,a]of Object.entries(w.alarms)){
  const active=s.alarm.status==='active'&&k===s.alarm.device,phase=((s.clock-(s.alarm.startedAt??0))%1.2+1.2)%1.2,flash=active&&(phase<.22||(phase>=.36&&phase<.58));
  a.lamp.material.color.set(flash?0xff3118:0x471610);a.lamp.material.emissive.set(flash?0xff1504:0);a.lamp.material.emissiveIntensity=flash?8:0;
  a.halo.visible=flash;a.spill.intensity=flash?.22:0;
  a.puddle.visible=a.drops.visible=active;
  if(active){let outlet=a.outlet;if(k==='container'&&s.containerLocation==='carried')outlet=w.controller?.templates['leak-container']?.getObjectByName('RF07_LEAK_OUTLET')??outlet;
   outlet.updateWorldMatrix(true,false);const pos=outlet.getWorldPosition(new THREE.Vector3());pos.z+=.008;a.puddle.position.set(pos.x,.006,pos.z);a.puddle.scale.setScalar(Math.min(1,.35+(s.clock-s.alarm.startedAt)*.02));
   const dummy=new THREE.Object3D();for(let i=0;i<14;i++){const t=(s.clock*1.7+i/14)%1;dummy.position.set(pos.x+Math.sin(i*2)*.003,Math.max(.012,pos.y*(1-t*t)),pos.z);dummy.scale.set(.65,1.6,.65);dummy.updateMatrix();a.drops.setMatrixAt(i,dummy.matrix);}a.drops.instanceMatrix.needsUpdate=true;
  }
 }
 if(w.controller){for(const [k,o]of Object.entries(w.assetRoots.items))if(s.carriedItem===k)o.visible=false;w.sampleCarry.visible=w.coolingCarry.visible=w.cargo.visible=false;}
}

export function syncCaseAsset(root,s,forceClosed){
 if(!root)return;const closed=forceClosed??['sealed','active','floor','delivered'].includes(s.casePhase);
 for(const name of ['rf07-case-lid-open','rf07-case-lid-closed','rf07-case-installed-cooling','rf07-case-active-indicator']){const o=root.getObjectByName(name);if(o)o.visible=false;}
 const lid=root.getObjectByName('RF07_CASE_LID');if(lid)lid.rotation.x=closed?0:-1.08;
 const contents=root.getObjectByName('rf07-case-samples');if(contents){contents.visible=!closed;contents.children.forEach(slot=>{slot.position.y=.044;slot.position.z=-.025;slot.position.x=Math.sign(slot.position.x)*.18;});}
 const module=root.getObjectByName('RF07_INSTALLED_MODULE');if(module)module.visible=!closed&&s.coolingModuleLocation==='case';
}
