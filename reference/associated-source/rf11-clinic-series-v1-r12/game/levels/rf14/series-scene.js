import "./series-hud.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { createCourtScene } from "./scene.js";
import { BINS,TYPES,SHELTER,EXTRA_STRUCTURES,REVISION,SERIES_BALLS } from "./series-layout.js";
const ROOT="/local-assets/levels/rf14/series-v1";
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath("/vendor/draco/");draco.setWorkerLimit(2);loader.setDRACOLoader(draco);
function load(name,url,parent){return loader.loadAsync(url).then(g=>{parent.add(g.scene);g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return {loaded:true,name,url,model:g.scene};}).catch(e=>({loaded:false,name,url,error:String(e)}));}
function sign(text,color,width=.55,height=.16){
 const c=document.createElement("canvas");c.width=768;c.height=224;const x=c.getContext("2d");x.fillStyle="#14251e";x.fillRect(0,0,768,224);x.strokeStyle=color;x.lineWidth=14;x.strokeRect(8,8,752,208);x.fillStyle=color;x.font="bold 61px sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText(text,384,116);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:t,roughness:.7,side:THREE.DoubleSide}));
}
export function createSeriesScene(renderer){
 document.querySelector("#game-shell")?.setAttribute("data-tennis-hud","minimal");
 const world=createCourtScene(renderer);world.revision=REVISION;
 const extras=new THREE.Group();extras.name="RF12_SERIES_SHARED";world.scene.add(extras);world.seriesRoot=extras;
 world.props=world.items;
 const orange=new THREE.Group();orange.position.set(8.2,0,10);orange.name="orange-cart";extras.add(orange);
 const collision=new THREE.Group();collision.visible=false;extras.add(collision);
 const jobs=[world.assetReady,fetch(ROOT+"/rain.mp3").then(async r=>{if(!r.ok)throw new Error("Rain audio unavailable");const bytes=await r.arrayBuffer();if(bytes.byteLength<1024)throw new Error("Empty rain audio");return {loaded:true,name:"rain-audio",url:ROOT+"/rain.mp3"};}).catch(e=>({loaded:false,name:"rain-audio",error:String(e)})),load("shelter",ROOT+"/shelter.glb",extras),load("series-collision",ROOT+"/collision.glb",collision).then(r=>{
  if(r.loaded){r.model.updateMatrixWorld(true);for(const b of EXTRA_STRUCTURES){
   const o=r.model.getObjectByName("COLLIDER_"+b.id);if(!o||!o.userData.collision)return {...r,loaded:false,error:"Missing collider "+b.id};
   const box=new THREE.Box3().setFromObject(o),min=b.position.map((v,i)=>v-b.size[i]/2),max=b.position.map((v,i)=>v+b.size[i]/2);
   if(box.min.toArray().some((v,i)=>Math.abs(v-min[i])>.005)||box.max.toArray().some((v,i)=>Math.abs(v-max[i])>.005))return {...r,loaded:false,error:"Collider mismatch "+b.id};
  }}return r;
 }),load("orange-cart","/local-assets/levels/rf14/realism-v0.4.8/cart.glb",orange)];
 for(const b of BINS){
  const panel=sign(TYPES[b.id].label,b.id==="yellow"?"#ffef48":"#ff963f");
  panel.position.set(b.x-.34,.83,b.z);panel.rotation.y=-Math.PI/2;extras.add(panel);
  const rimMaterial=new THREE.MeshStandardMaterial({color:TYPES[b.id].color,roughness:.62});
  for(const [dx,dz,w,d] of [[-.32,0,.024,.65],[.32,0,.024,.65],[0,-.32,.65,.024],[0,.32,.65,.024]]){
   const rim=new THREE.Mesh(new THREE.BoxGeometry(w,.035,d),rimMaterial);rim.position.set(b.x+dx,.91,b.z+dz);extras.add(rim);
  }
 }
 const s=sign("避雨区  SHELTER","#dbe9df",2.2,.29);s.position.set(6.62,2.5,-2);s.rotation.y=-Math.PI/2;extras.add(s);
 world.assetReady=Promise.all(jobs).then(([base,...extra])=>{
  const results=[...base,...extra];
  for(const ball of SERIES_BALLS)world.items[ball.id].traverse(o=>{if(o.isMesh){
   o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();if(ball.type==="orange")c.color.setRGB(1,.39,.085);return c;});
   if(o.material.length===1)o.material=o.material[0];
  }});
  world.scene.traverse(o=>{if(o.isLight){o.userData.dryIntensity=o.intensity;}if(o.isMesh&&/acrylic|paving/.test(o.name)){o.material=o.material.clone();o.userData.dryRoughness=o.material.roughness;}});
  world.dryBackground=world.scene.background;world.dryFog=world.scene.fog.color.clone();
  const shell=document.querySelector("#game-shell");if(shell){shell.dataset.levelRevision=REVISION;shell.dataset.worldAssetsTotal=results.length;shell.dataset.worldAssetsLoaded=results.filter(r=>r.loaded).length;shell.dataset.worldAssetErrors=JSON.stringify(results.filter(r=>!r.loaded));}
  return results;
 });
 world.collisionReady=world.assetReady.then(r=>({loaded:r.filter(x=>x.name.includes("collision")).every(x=>x.loaded)}));
 addRain(world);world.rainMix=0;
 return world;
}
function addRain(world){
 const count=1600,positions=new Float32Array(count*6);world.rainSeeds=Array.from({length:count},(_,i)=>({x:((i*73.17)%100)/100*22-11,z:((i*29.73)%100)/100*42-20,y:((i*19.17)%100)/100*7}));
 const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
 world.rain=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xc1d8e1,transparent:true,opacity:.6,depthWrite:false}));world.rain.frustumCulled=false;world.rain.visible=false;world.scene.add(world.rain);
 world.rainAudio=new Audio(ROOT+"/rain.mp3");world.rainAudio.loop=true;world.rainAudio.volume=0;world.audioAttempt=0;
}
export function syncSeriesVisuals(world,s){
 for(const [id,root] of Object.entries(world.items)){const b=s.items[id];root.visible=b.location!=="carried";root.position.set(b.x,b.y,b.z);}
 const w=s.weather,rain=w.enabled&&w.raining&&!s.complete&&!s.failed;world.rain.visible=rain;
 world.rainMix+=(Number(rain)-world.rainMix)*.045;
 const mix=world.rainMix;
 if(world.dryBackground&&mix>.02)world.scene.background=new THREE.Color().lerpColors(new THREE.Color("#9cacb7"),new THREE.Color("#687985"),mix);
 else if(world.dryBackground)world.scene.background=world.dryBackground;
 world.scene.fog.color.set(rain?"#82949e":"#c6d7d9");world.scene.environmentIntensity=.5*(1-.65*mix);
 world.scene.traverse(o=>{if(o.isLight&&o.userData.dryIntensity!==undefined)o.intensity=o.userData.dryIntensity*(1-.65*mix);if(o.userData.dryRoughness!==undefined)o.material.roughness=THREE.MathUtils.lerp(o.userData.dryRoughness,.31,mix);});
 if(rain){
  const a=world.rain.geometry.attributes.position.array;
  world.rainSeeds.forEach((p,i)=>{const y=7-((s.elapsed*7+p.y)%7),covered=p.x>SHELTER.minX&&p.x<SHELTER.maxX&&p.z>SHELTER.minZ&&p.z<SHELTER.maxZ,base=covered?SHELTER.roofY:0;
   const top=covered?base+y/7*(7-base):y;
   a.set([p.x,top,p.z,p.x+.045,Math.max(base,top-.23),p.z+.025],i*6);
  });world.rain.geometry.attributes.position.needsUpdate=true;
 }
 world.rainAudio.volume=rain?(w.sheltered?.20:.34):0;
 if(rain&&world.rainAudio.paused&&performance.now()-world.audioAttempt>1500){world.audioAttempt=performance.now();world.rainAudio.play().catch(()=>{});}
 if(!rain&&!world.rainAudio.paused)world.rainAudio.pause();
}
