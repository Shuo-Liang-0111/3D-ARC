import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js";
import {LEVEL,HOME,ITEM_BASE_Y} from "./home-layout.js";
import {addHomeWater,syncHomeWater} from "./home-water.js";
export const gripHeight={spray:.11,wrench:.07,bucket:.43,mop:.82};
const ROOT="/local-assets/levels/rf06/home-v7/",OLD="/local-assets/embodiedgen/rf06/models/runtime/interactables/";
const urls={wrench:OLD+"wrench.glb",mop:"/local-assets/levels/rf06/tools-v1/mop.glb",bucket:"/local-assets/levels/rf06/series-v1/bucket.glb"};
const decoder=new DRACOLoader();decoder.setDecoderPath("/vendor/draco/");decoder.setWorkerLimit(2);const loader=new GLTFLoader();loader.setDRACOLoader(decoder);
function load(url,root){return new Promise(resolve=>loader.load(url,g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.name.startsWith("CEILING");o.receiveShadow=true;}});root.add(g.scene);resolve({loaded:true,url,model:g.scene});},undefined,error=>resolve({loaded:false,url,error:String(error)})));}
export function createLeakSeriesScene(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xb8c1c4);
 // Soft room-shaped reflection map supplies readable metal and clear-water highlights.
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=256;const ctx=canvas.getContext("2d");
 const gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,"#e8e4db");gradient.addColorStop(.48,"#898985");gradient.addColorStop(1,"#655c4c");ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
 for(const x of [56,284]){ctx.fillStyle="#f9fcff";ctx.fillRect(x,62,60,65);ctx.fillStyle="#b4bcc0";ctx.fillRect(x+28,62,3,65);}
 const env=new THREE.CanvasTexture(canvas);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;scene.environment=env;scene.environmentIntensity=.55;
 scene.add(new THREE.HemisphereLight(0xf8f3e7,0x555956,2.1));
 const sun=new THREE.DirectionalLight(0xffedcf,2.8);sun.position.set(-4,8,-6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.1,far:25});sun.shadow.normalBias=.018;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xe4edff,1.1);fill.position.set(0,5,8);scene.add(fill);
 const environment=new THREE.Group(),collision=new THREE.Group(),valve=new THREE.Group(),pesticide=new THREE.Group();scene.add(environment,collision,valve,pesticide);collision.visible=false;
 valve.position.set(HOME.valve.x,HOME.valve.y,HOME.valve.z);
 pesticide.position.set(HOME.can.x,HOME.can.y,HOME.can.z);
 const w={scene,ceiling:new THREE.Group(),assetRoots:{environment,collision,valve,items:{}},pesticide,home:HOME};
 const promises=[load(ROOT+"home.glb",environment),load(ROOT+"collision.glb",collision),load(ROOT+"valve.glb",valve),load("/local-assets/levels/rf06/pest-v2/insecticide.glb",pesticide)];
 for(const [type,url]of Object.entries(urls)){const root=new THREE.Group();w.assetRoots.items[type]=root;scene.add(root);promises.push(load(url,root));}
 w.assetReady=Promise.all(promises);w.collisionReady=promises[1];addHomeWater(w);return w;
}
export function syncLeakSeries(w,s,delta){
 for(const[type,root]of Object.entries(w.assetRoots.items)){
  if(type==="spray")continue;const item=s.items[type];root.visible=["room","floor","returned","placed","tool-rack"].includes(item.location);
  if(root.visible){root.position.set(item.x,ITEM_BASE_Y(type,item),item.z);root.rotation.set(0,0,0);}
 }
 w.assetRoots.valve.rotation.z=s.valveClosed?Math.PI/2:0;
 w.pesticide.visible=s.canLocation!=="held";
 syncHomeWater(w,s,delta);
}
export function prepareLeakView(w,{firstPerson}){
 w.ceiling.visible=firstPerson;
 w.assetRoots.environment.traverse(o=>{if(o.name.startsWith("CEILING"))o.visible=firstPerson;});
}
