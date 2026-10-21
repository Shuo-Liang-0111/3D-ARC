import * as THREE from 'three';
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
 w.scene.traverse(o=>{if(o.isMesh&&Math.abs(o.position.x-2)<.001&&Math.abs(o.position.y-2.18)<.001){o.position.set(2,.68,1.973);o.rotation.set(0,0,0);}});w.seriesRoot=new THREE.Group();w.scene.add(w.seriesRoot);w.ceiling=new THREE.Group();w.ceiling.name='rf07-first-person-ceiling';w.seriesRoot.add(w.ceiling);
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
 w.power={};for(const [id,c]of Object.entries(w.assetRoots.cabinets)){
  const z=c.position.z;box(w.seriesRoot,[.06,.31,.71],[10.36,1.2,z],dark,'power-panel-'+id);
  const screen=text(w.seriesRoot,'power-display-'+id,[10.322,1.25,z],-Math.PI/2,.55,.16);
  const button=mesh(w.seriesRoot,new THREE.CylinderGeometry(.047,.047,.027,24),mat(0x75c28f),[10.306,1.12,z+.23],'power-switch-'+id);button.rotation.z=Math.PI/2;
  w.power[id]={screen,button};
 }
 w.alarms={};for(const d of [...DEVICES,{id:'container',...CONTAINER}]){
  const root=new THREE.Group();w.seriesRoot.add(root);root.position.set(d.x,d.y+.25,d.z);
  mesh(root,new THREE.CylinderGeometry(.08,.095,.05,24),dark,[0,0,0],'beacon-base');
  const lamp=mesh(root,new THREE.CylinderGeometry(.065,.065,.12,24),new THREE.MeshStandardMaterial({color:0x38201d,emissive:0x000000,roughness:.25}),[0,.085,0],'alarm-lens');
  const puddle=mesh(w.seriesRoot,new THREE.CircleGeometry(.30,40),new THREE.MeshStandardMaterial({color:0x87b6bc,transparent:true,opacity:.68,roughness:.13,metalness:.15}),[d.x,.012,d.z+.27],'leak-puddle-'+d.id);puddle.rotation.x=-Math.PI/2;puddle.visible=false;
  const stream=mesh(w.seriesRoot,new THREE.CylinderGeometry(.012,.018,.75,10),new THREE.MeshStandardMaterial({color:0xb1e5e8,transparent:true,opacity:.72}),[d.x,.40,d.z+.12],'leak-stream-'+d.id);stream.visible=false;
  if(d.id!=='container'){box(w.seriesRoot,[.20,.18,.09],[d.x,d.y,d.z],dark,'fault-device-power-'+d.id);mesh(w.seriesRoot,new THREE.CylinderGeometry(.042,.042,.022,24),mat(0x9bdcb1),[d.x,d.y,d.z+.056],'device-off-button').rotation.x=Math.PI/2;}
  w.alarms[d.id]={root,lamp,puddle,stream};
 }
 const ready=w.assetReady;w.assetReady=ready.then(results=>{
  const container=w.assetRoots.samples.sampleA.clone(true);container.name='rf07-leak-container';container.traverse(o=>{if(o.name.includes('label-'))o.visible=false;});container.scale.setScalar(1.65);w.seriesRoot.add(container);w.container=container;
  const caseHandle=mesh(w.assetRoots.case,new THREE.TorusGeometry(.065,.013,10,28),rail,[0,.205,.27],'transport-case-front-handle');caseHandle.scale.x=1.7;
  w.deliveredCase=w.assetRoots.case.clone(true);w.deliveredCase.visible=false;w.scene.add(w.deliveredCase);w.deliveryTime=0;
  w.assetRoots.items={...w.assetRoots.samples,'transport-case':w.assetRoots.case,'cooling-module':w.assetRoots.module,'leak-container':container};
  // Metal equipment needs a neutral reflection field; otherwise existing metal maps render black.
  const faces=Array.from({length:6},()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,32);g.addColorStop(0,'#eef4f0');g.addColorStop(.55,'#b5c6c9');g.addColorStop(1,'#637577');x.fillStyle=g;x.fillRect(0,0,32,32);return c;});
  const env=new THREE.CubeTexture(faces);env.needsUpdate=true;env.colorSpace=THREE.SRGBColorSpace;w.scene.environment=env;w.scene.environmentIntensity=.65;
  return results;
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
  const contents=w.deliveredCase.getObjectByName('rf07-case-samples');if(contents)contents.visible=false;
  const closed=w.deliveredCase.getObjectByName('rf07-case-lid-closed'),open=w.deliveredCase.getObjectByName('rf07-case-lid-open');if(closed)closed.visible=true;if(open)open.visible=false;
 }

 for(const [id,p]of Object.entries(w.power)){write(p.screen,s.cabinetPower[id]?'ON  4°C':'OFF',s.cabinetPower[id]?'#76ffb1':'#ffce76');p.button.material.color.set(s.cabinetPower[id]?0x49d680:0xc08435);}
 const place=(o,p)=>{if(o){o.position.set(p.x,p.y,p.z);o.rotation.y=p.yaw??0;}};
 place(w.assetRoots.case,s.casePoint);place(w.caseRoot,s.casePoint);place(w.assetRoots.module,s.modulePoint);
 for(const root of [w.assetRoots.case,w.caseRoot]){const contents=root.getObjectByName('rf07-case-samples');if(contents){contents.visible=!['sealed','active','floor','delivered'].includes(s.casePhase);contents.children.forEach(slot=>{slot.position.z=.15;});}}
 for(const [k,o]of Object.entries(w.assetRoots.samples)){const p=s.samples[k];if(p.location==='storage'||p.location==='floor')place(o,p);}
 if(w.container){w.container.visible=s.containerLocation!=='carried';place(w.container,s.containerPoint);}
 for(const [k,a]of Object.entries(w.alarms)){
  const active=s.alarm.status==='active'&&(s.alarm.type==='container'?k==='container':k===s.alarm.device);
  const flash=active&&Math.sin(s.clock*8)>0;
  a.lamp.material.color.set(active?0xf43325:0x38201d);a.lamp.material.emissive.set(flash?0xff1000:0);a.lamp.material.emissiveIntensity=flash?3:0;
  a.puddle.visible=a.stream.visible=active;
  if(k==='container'){const p=s.containerPoint;a.root.position.set(p.x,p.y+.32,p.z);a.root.visible=s.containerLocation!=='carried';a.puddle.position.set(p.x,.012,p.z+.14);a.stream.position.set(p.x,Math.max(.08,p.y*.5),p.z+.12);a.stream.scale.y=Math.max(.1,p.y/.75);if(s.containerLocation==='carried'){a.stream.visible=false;a.puddle.visible=false;}}
 }
 if(w.controller){for(const [k,o]of Object.entries(w.assetRoots.items))if(s.carriedItem===k)o.visible=false;w.sampleCarry.visible=w.coolingCarry.visible=w.cargo.visible=false;}
}
