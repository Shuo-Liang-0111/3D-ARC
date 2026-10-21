import * as THREE from "three";
import { addKettleEffects, syncKettleEffects } from "./kettle-effects.js";
import { createKitchenScene, syncKitchenVisuals, loadAsset } from "./scene.js";
import { addKitchenViewLayers } from "./view-layers.js";
import { KITCHEN, ITEM_FILES, itemPose, REVISION } from "./interaction-layout.js";
const ROOT="/local-assets/levels/rf12/interaction-v2";
const vec=p=>new THREE.Vector3(p.x,p.y,p.z);
function mesh(parent,geometry,color,position,name,metalness=.2) {
 const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.42,metalness}));
 m.position.set(...position);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function labelTexture() {
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
 const c=canvas.getContext("2d");c.fillStyle="#18352b";c.fillRect(0,0,512,128);
 c.fillStyle="#f3e9bd";c.font="bold 38px sans-serif";c.textAlign="center";c.fillText("食用油 · 备餐位",256,56);
 c.font="20px sans-serif";c.fillText("COOKING OIL",256,95);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function glowTexture(smoke=false,spray=false) {
 const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
 const c=canvas.getContext("2d"),g=c.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,spray?"rgba(255,255,250,.8)":smoke?"rgba(92,86,80,.65)":"rgba(255,248,170,1)");
 g.addColorStop(.25,spray?"rgba(255,255,250,.5)":smoke?"rgba(67,61,58,.44)":"rgba(255,178,27,.9)");
 g.addColorStop(.65,spray?"rgba(255,255,250,.2)":smoke?"rgba(47,43,40,.18)":"rgba(235,67,10,.4)");
 g.addColorStop(1,"rgba(0,0,0,0)");c.fillStyle=g;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}
function effects(world) {
 world.flames=new THREE.Group();world.smoke=new THREE.Group();world.burnerFlames=new THREE.Group();
 world.scene.add(world.flames,world.smoke,world.burnerFlames);
 const flame=glowTexture(),smoke=glowTexture(true);
 for(let i=0;i<18;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flame,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));world.flames.add(s);}
 for(let i=0;i<9;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smoke,transparent:true,depthWrite:false}));world.smoke.add(s);}
 for(let i=0;i<24;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:flame,color:0x2387ff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  const a=i/24*Math.PI*2;s.position.set(KITCHEN.burner.x+Math.cos(a)*.10,1.017,KITCHEN.burner.z+Math.sin(a)*.10);s.scale.set(.025,.055,1);world.burnerFlames.add(s);
 }
 world.fireLight=new THREE.PointLight(0xff641f,0,3,2);world.fireLight.position.copy(vec(KITCHEN.burner)).y+=.3;world.scene.add(world.fireLight);
 const positions=new Float32Array(96*3),geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
 world.spray=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf6efd4,map:glowTexture(false,true),size:.06,transparent:true,opacity:.78,depthWrite:false}));
 world.spray.frustumCulled=false;world.spray.visible=false;world.scene.add(world.spray);
 world.sprayAmount=0;world.sprayOrigin=new THREE.Vector3();world.fireSuppression=0;
}
export function createSeriesKitchenScene(id="rf12") {
 const world=addKitchenViewLayers(createKitchenScene());world.levelId=id;world.revision=REVISION;
 const root=new THREE.Group();root.name="RF10_SHARED_KITCHEN_PROPS_V2";world.scene.add(root);world.variantRoot=root;
 world.props={cloth:world.clothRoot};
 const pending=Object.entries(ITEM_FILES).map(([item,file])=>{
  const slot=new THREE.Group();slot.name="RF10_PROP_"+item;root.add(slot);world.props[item]=slot;
  return loadAsset(ROOT+"/"+file).then(source=>{
   if(!source)return {loaded:false,name:item,url:ROOT+"/"+file};
   const model=source.clone(true);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   slot.add(model);return {loaded:true,name:item,url:ROOT+"/"+file,model};
  });
 });
 // The tray and bracket are precision installation geometry.
 mesh(root,new THREE.BoxGeometry(.32,.014,.18),0x67736c,[KITCHEN.prep.x,.908,KITCHEN.prep.z],"RF10_OIL_TRAY");
 const tag=new THREE.Mesh(new THREE.PlaneGeometry(.29,.073),new THREE.MeshStandardMaterial({map:labelTexture(),roughness:.6}));
 tag.position.set(KITCHEN.prep.x,.843,-2.17);root.add(tag);
 mesh(root,new THREE.BoxGeometry(.19,.025,.21),0x333936,[-3.8,.225,.9],"RF10_EXTINGUISHER_BASE");
 mesh(root,new THREE.BoxGeometry(.04,.40,.19),0x333936,[-3.975,.42,.9],"RF10_EXTINGUISHER_BRACKET");
 world.hoodLamp=new THREE.PointLight(0xffe6bb,0,2,2);world.hoodLamp.position.set(2.25,1.62,-2.6);world.scene.add(world.hoodLamp);
 effects(world);addKettleEffects(world);
 world.assetReady=Promise.all([world.assetReady,...pending]).then(([results,...props])=>[...results,...props]);
 world.assetRoots.interactables=world.props;
 return world;
}
export const createSimpleKitchenScene=()=>createSeriesKitchenScene("rf12-2");
export const createCookingKitchenScene=()=>createSeriesKitchenScene("rf12-3");
function setPose(root,p){root.position.set(p.x,p.y??.006,p.z);root.rotation.set(0,p.yaw??0,0);}
export function syncSeriesKitchenVisuals(world,state) {
 const base=state.hazards?state:{...state,cloth:{location:"counter",...KITCHEN.cloth},hazards:{gasKnob:!state.burnerOn,hood:!!state.hoodOn,cloth:false,window:false,gasValve:false}};
 syncKitchenVisuals(world,base);
 for(const item of ["oil","pan","extinguisher","kettle"]){
  const root=world.props[item];root.visible=state.carriedItem!==item;
  if(root.visible)setPose(root,itemPose(state,item));
 }
 if(!state.cloth)setPose(world.clothRoot,KITCHEN.cloth);
 syncKettleEffects(world,state);
 const hood=state.hoodOn??state.hazards?.hood??false;
 world.hoodLamp.intensity=hood?.6:0;
 const knob=world.fixed.gasKnob?.children[0];if(knob)knob.rotation.y=(state.burnerOn||state.hazards&&!state.hazards.gasKnob)?Math.PI*.45:0;
 const valve=world.fixed.gasValve?.children[0];if(valve)valve.rotation.z=state.hazards?.gasValve?Math.PI/2:0;
 const t=state.elapsed,fire=!!state.fireActive,amount=1-world.fireSuppression;
 world.flames.visible=world.smoke.visible=fire;world.burnerFlames.visible=!!state.burnerOn;
 world.fireLight.intensity=fire?(.65+Math.sin(t*19)*.12)*amount:state.burnerOn?.13:0;
 world.flames.children.forEach((s,i)=>{
  const a=i*2.4+t*.7,h=.10+((t*1.4+i*.18)%1)*.40;
  s.position.set(KITCHEN.burner.x+Math.cos(a)*.12,1.08+h,KITCHEN.burner.z+Math.sin(a)*.12);
  s.scale.set(.12+.06*Math.sin(i+t*7),(.20+.23*Math.sin(i+t*5)**2)*amount,1);
  s.material.opacity=amount*.24;
 });
 world.smoke.children.forEach((s,i)=>{const p=(t*.28+i/9)%1;s.position.set(KITCHEN.burner.x+Math.sin(i+t)*.10,1.45+p*1.1,KITCHEN.burner.z);s.scale.setScalar(.25+p*.65);s.material.opacity=(1-p)*amount*.45;});
 world.spray.visible=world.sprayAmount>0;
 if(world.spray.visible){
  const target=vec(KITCHEN.burner);target.y+=.08;
  const arr=world.spray.geometry.attributes.position.array;
  for(let i=0;i<96;i++){const p=(t*2+i/96)%1,v=world.sprayOrigin.clone().lerp(target,p),spread=.012+p*.13;
   v.x+=Math.sin(i*2.3+t*7)*spread;v.z+=Math.cos(i*3.7+t*9)*spread;v.y+=Math.sin(i*6.3)*spread-p*p*.05;v.toArray(arr,i*3);}
  world.spray.geometry.attributes.position.needsUpdate=true;
 }
}
export const syncSimpleKitchenVisuals=syncSeriesKitchenVisuals;
export const syncCookingKitchenVisuals=syncSeriesKitchenVisuals;
