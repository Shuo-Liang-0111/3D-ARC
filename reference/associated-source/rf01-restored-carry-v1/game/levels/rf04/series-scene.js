import { PORTALS } from "./architecture-layout.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createHomeLaundryScene, syncLaundryVisuals } from "./scene.js";
import { ASSET_ROOT, BAYS, DOCK, STORAGE, REVISION } from "./series-layout.js";
const load = async (scene,url,name) => {
 const gltf=await new GLTFLoader().loadAsync(url);const root=gltf.scene;root.name=name;
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene?.add(root);
 return {loaded:true,name,url,model:root};
};
function label(scene,text,x,y,z,width=.48) {
 const c=document.createElement("canvas");c.width=512;c.height=160;const ctx=c.getContext("2d");
 ctx.fillStyle="#ded4bd";ctx.fillRect(0,0,512,160);ctx.strokeStyle="#665743";ctx.lineWidth=8;ctx.strokeRect(5,5,502,150);
 ctx.fillStyle="#2c332f";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 65px sans-serif";ctx.fillText(text,256,80);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*160/512),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));
 mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;scene.add(mesh);return mesh;
}
export function createSeriesScene() {
 const w=createHomeLaundryScene({homeUrl:"/local-assets/levels/rf04/architecture-v4/home.glb",assetRoot:"/local-assets/levels/rf04/architecture-v3/props"});w.revision=REVISION;w.stored={};w.carryTemplates={};
 // Solid, flush threshold bridges the floor gap between the two room shells.
 const thresholdMaterial=new THREE.MeshStandardMaterial({color:0xc5bba4,roughness:.86});
 for(const p of PORTALS){
  const alongX=p.w>p.d;
  const threshold=new THREE.Mesh(new THREE.BoxGeometry(alongX?p.w+.17:.44,.055,alongX?.44:p.d+.17),thresholdMaterial);
  threshold.name="rf04-door-threshold-"+p.id;threshold.position.set(p.x,-.0225,p.z);threshold.receiveShadow=true;w.scene.add(threshold);
 }
 const old=w.assetReady;
 w.collisionReady=load(null,"/local-assets/levels/rf04/architecture-v4/collision.glb","rf04-series-collision").then(r=>{w.collisionRoot=r.model;return r;});
 w.assetReady=Promise.all([old,load(w.scene,ASSET_ROOT+"/furnishings.glb","rf04-series-furnishings"),load(w.scene,ASSET_ROOT+"/vacuum.glb","rf04-series-vacuum"),w.collisionReady]).then(([base,f,v,c])=>{
  const home=base.find(entry=>entry.name==="rf04-final-home")?.model;
  const discarded=[];
  home?.traverse(o=>{
   if(o.name==="entrance")discarded.push(o);
   if(o.name.startsWith("rf04-interior-ceiling")){
    o.visible=true;o.castShadow=false;o.receiveShadow=false;
    if(o.isMesh){o.position.y-=.025;o.material=new THREE.MeshStandardMaterial({color:0xdedbd2,emissive:0xc8c2b6,emissiveIntensity:.45,roughness:.95,side:THREE.FrontSide});}
   }
   if(o.isMesh&&/plant|trinket|lamp/i.test(o.name))o.castShadow=false;
   o.updateMatrix();o.matrixAutoUpdate=false;
  });
  for(const o of discarded)o.removeFromParent();
  w.scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow)o.shadow.mapSize.set(1024,1024);});
  w.vacuum=v.model;
  w.vacuum.position.set(DOCK.x,DOCK.y,DOCK.z);w.vacuum.rotation.y=DOCK.yaw;
  w.carryTemplates.vacuum=w.vacuum.clone(true);w.carryTemplates.vacuum.position.set(0,0,0);w.carryTemplates.vacuum.rotation.set(0,0,0);
  for(const [type,asset]of Object.entries(w.clothingAssets)){
   const clone=asset.clone(true);clone.position.set(0,0,0);w.carryTemplates[type]=clone;
   const stored=clone.clone(true);stored.updateMatrixWorld(true);
   let storedBox=new THREE.Box3().setFromObject(stored),storedSize=storedBox.getSize(new THREE.Vector3());
   stored.scale.multiplyScalar(Math.min(.43/storedSize.x,.30/storedSize.z));stored.updateMatrixWorld(true);
   storedBox=new THREE.Box3().setFromObject(stored);const storedCenter=storedBox.getCenter(new THREE.Vector3());
   stored.position.set(BAYS[type].x-.12-storedCenter.x,BAYS[type].y-storedBox.min.y,STORAGE.z-.12-storedCenter.z);
   stored.visible=false;w.scene.add(stored);w.stored[type]=stored;
   // Permanent reference garments identify each bay without text.
   // Put examples inside the right side of each bay, leaving the left side for task items.
   for(let i=0;i<(type==="towel"?2:1);i++){
    const sample=clone.clone(true);sample.name="rf04-storage-example-"+type+"-"+i;sample.visible=true;
    sample.rotation.y=i*.10;sample.position.set(0,0,0);sample.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(sample),size=box.getSize(new THREE.Vector3());
    sample.scale.multiplyScalar(Math.min(.30/size.x,.30/size.z));sample.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(sample);const center=box.getCenter(new THREE.Vector3());
    sample.position.set(BAYS[type].x+.22-center.x+i*.012,BAYS[type].y-box.min.y+i*(box.max.y-box.min.y+.001),STORAGE.z+.05-center.z);
    w.scene.add(sample);
   }
   // Consistent reachable hanging positions for all series levels.
   const h=w.hangers[type];h.position.set((["shirt","pants","towel"].indexOf(type)-1)*.76,1.40,.22);
  }
  w.carryTemplates["wet-batch"]=w.wetBatchAsset.clone(true);w.carryTemplates["wet-batch"].position.set(0,0,0);
  label(w.scene,"充电区",DOCK.x,.33,DOCK.z+.095,.35);
  w.scene.userData.revision=REVISION;
  return [...base,f,v,c];
 });
 return w;
}
export function syncSeriesVisuals(w,s) {
 syncLaundryVisuals(w,s);
 for(const [t,m]of Object.entries(w.stored))m.visible=s.clothes[t].location==="stored";
 if(w.vacuum){
  w.vacuum.visible=s.vacuum.mode!=="carried";
  w.vacuum.position.set(s.vacuum.x,s.vacuum.mode==="docked"?DOCK.y:0,s.vacuum.z);
  w.vacuum.rotation.y=s.vacuum.yaw;
 }
}
