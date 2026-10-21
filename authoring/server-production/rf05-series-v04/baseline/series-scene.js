import { createLeakScene, syncLeakScene } from "./series-leak-scene.js";
import * as THREE from "three";
import { ASSETS, createHotelRoomScene } from "./scene.js";
import { REVISION, STOCK, SLOTS, TARGETS, EXIT, FURNITURE, ROOM_FIXTURES, itemPose } from "./series-layout.js";
const mat=(color,roughness=.6,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geo,material,position,name){const m=new THREE.Mesh(geo,material);m.position.set(...position);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(p,size,pos,m,name){return mesh(p,new THREE.BoxGeometry(...size),m,pos,name);}
function tube(p,a,b,r,m,name){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start),o=mesh(p,new THREE.CylinderGeometry(r,r,v.length(),20),m,start.clone().add(end).multiplyScalar(.5).toArray(),name);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;}
function label(parent,text,pos,width=.45){
 const c=document.createElement("canvas");c.width=512;c.height=128;const ctx=c.getContext("2d");ctx.fillStyle="#e6ded0";ctx.fillRect(0,0,512,128);ctx.fillStyle="#302d28";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 48px sans-serif";ctx.fillText(text,256,64);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const m=mesh(parent,new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),pos,text);return m;
}
// Render the interior ceiling and attached fittings below roof height only.
// This is evaluated for each camera draw, including both panes of split view.
function interiorOnly(root){
 root.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=false;node.geometry=node.geometry.clone();
  const range={...node.geometry.drawRange};
  node.onBeforeRender=(_renderer,_scene,camera)=>node.geometry.setDrawRange(range.start,camera.getWorldPosition(new THREE.Vector3()).y<ROOM_FIXTURES.ceilingY?range.count:0);
  node.onAfterRender=()=>node.geometry.setDrawRange(range.start,range.count);
 });
}
function buildCeiling(world){
 const roof=box(world.scene,[8.18,.08,10.58],[0,ROOM_FIXTURES.ceilingY+.04,0],mat(0xe2ddd2,.92),"GuestroomCeiling");
 roof.userData.cutawayCeiling=true;interiorOnly(roof);world.ceiling=roof;
 for(const light of world.assetRoots.static.ceilingLights){
  light.visible=true;light.position.y=ROOM_FIXTURES.ceilingY-.10;interiorOnly(light);
 }
}
function parking(scene,f,key){
 const yellow=mat(0xd3ac3c,.86),t=f.target,w=f.width+.30,d=f.depth+.30,group=new THREE.Group();group.position.set(t.x,.036,t.z);group.rotation.y=t.yaw;group.name=key+"-parking";scene.add(group);
 for(const x of [-w/2,w/2])box(group,[.025,.003,d],[x,0,0],yellow,key+"-parking-side");
 for(const z of [-d/2,d/2])box(group,[w,.003,.025],[0,0,z],yellow,key+"-parking-end");
 if(key==="cart"){const l=label(group,"清洁车",[0,.008,0],.5);l.rotation.x=-Math.PI/2;}
}
export function createHotelSeriesScene(){
 const assets=Object.fromEntries(Object.entries(ASSETS).map(([key,url])=>[key,url.replace("/models/runtime/","/models/series-v02-opt2/")]));
 const world=createHotelRoomScene({assets});world.revision=REVISION;
 world.assetReady=world.assetReady.then(results=>{
  const flat=results.flat(Infinity);if(flat.some(r=>!r.loaded))return flat;
  for(const r of Object.values(world.itemRoots))r.visible=false;
  // Thin shower glazing uses alpha transparency; full-scene refraction doubles rendering cost.
  const showerGlass=world.assetRoots.shell.getObjectByName("ShowerGlassPanel");
  showerGlass.material=showerGlass.material.clone();showerGlass.material.transmission=0;showerGlass.material.needsUpdate=true;
  world.assetRoots.static.bathroomVanity.visible=true;
  showerGlass.scale.z=1.05/1.42;showerGlass.position.z=4.645;
  world.assetRoots.shell.getObjectByName("ShowerGlassTopRail").position.z=4.12;
  world.assetRoots.shell.getObjectByName("ShowerGlassPost").position.z=4.12;
  for(const key of ["bedLeft","bedRight"]){const p=ROOM_FIXTURES[key];world.assetRoots.static[key].position.set(p.x,0,p.z);}
  const table=ROOM_FIXTURES.bedside;world.assetRoots.static.bedsideTable.position.set(table.x,0,table.z);
  const wc=ROOM_FIXTURES.toilet;world.assetRoots.static.toilet.position.set(wc.x,wc.y,wc.z);world.assetRoots.static.toilet.rotation.y=wc.yaw;
  // Source chair faces +X. Normalize its existing backrest to local -Z.
  for(const child of world.assetRoots.static.deskChair.children)child.rotation.y-=Math.PI/2;
  buildCeiling(world);
  world.assetRoots.targets.bin.position.set(TARGETS.bin.x,0,TARGETS.bin.z);
  world.serviceItems={};world.carryTemplates={};
  for(const [id,type]of [["towel","towel"],["cup","cup"],["trash","trash"],...Object.entries(STOCK).map(([id,v])=>[id,v.type])]){
   const root=id in world.assetRoots.items?world.assetRoots.items[id]:world.assetRoots.items[type].clone(true);
   root.name="hotel-item-"+id;world.scene.add(root);world.serviceItems[id]=root;
   world.carryTemplates[id]=root.clone(true);
  }
  world.furnitureRoots={cart:world.assetRoots.targets.cart,chair:world.assetRoots.static.deskChair};
  const chrome=mat(0xb9c3c4,.26,.8);
  for(const[key,f]of Object.entries(FURNITURE)){
   const root=world.furnitureRoots[key];root.rotation.y=f.yaw;
   if(key==="cart"){tube(root,[-f.handleHalfWidth,f.handleY,-f.handleBack],[f.handleHalfWidth,f.handleY,-f.handleBack],.014,chrome,key+"-grasp-bar");
   for(const dx of [-f.handleHalfWidth,f.handleHalfWidth])tube(root,[dx,f.handleY,-f.handleBack],[dx,f.handleY-.16,-f.handleBack+.08],.013,chrome,key+"-handle-support");}
   parking(world.scene,f,key);
  }
  world.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  world.supportMetrics={};
  for(const key of ["cart","chair"]){
   const root=world.furnitureRoots[key];
   world.supportMetrics[key]=[];
   for(const x of [-.3,0,.3])for(const z of [-.18,0,.18]){
    const local=new THREE.Vector3(x,3,z),origin=root.localToWorld(local);
    ray.set(origin,new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObject(root,true);
    world.supportMetrics[key].push({x,z,hits:hits.slice(0,3).map(h=>Number(h.point.y.toFixed(4)))});
   }
  }
  box(world.furnitureRoots.cart,[.87,.02,.48],[0,.995,0],mat(0xa8b1b1,.34,.75),"service-tray-insert");
  // Keep detailed visible meshes; simple invisible casters avoid rendering all high-poly furniture twice.
  const shadowMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  for(const[key,root]of Object.entries(world.assetRoots.static)){
   if(!root.isObject3D||!root.visible)continue;
   root.updateWorldMatrix(true,true);
   const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   root.traverse(node=>{if(node.isMesh)node.castShadow=false;});
   if(key==="deskChair"){
    const f=FURNITURE.chair;box(root,[f.width*.85,.47,f.depth*.85],[0,.235,0],shadowMaterial,"chair-shadow-proxy");
   }else box(world.scene,[size.x*.97,size.y*.94,size.z*.97],center.toArray(),shadowMaterial,key+"-shadow-proxy");
  }
  const cart=world.furnitureRoots.cart;cart.traverse(node=>{if(node.isMesh)node.castShadow=false;});
  box(cart,[.88,.89,.5],[0,.445,0],shadowMaterial,"cart-shadow-proxy");
  world.shadowLights=world.scene.children.filter(node=>node.isDirectionalLight);
  for(const light of world.shadowLights){light.shadow.mapSize.set(1024,1024);light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;}
  world.leakScene=createLeakScene(world);
  const terminal=new THREE.Group();terminal.position.set(0,0,EXIT.z);world.scene.add(terminal);
  // A slim freestanding door-side card avoids adding an invisible solid across the entrance.
  box(terminal,[.12,.95,.10],[.47,.475,0],mat(0x424b4c,.4,.4),"handover-post");
  box(terminal,[.30,.22,.04],[.40,1.10,0],mat(0x31484a,.5),"handover-plate");
  label(terminal,"交房确认",[.40,1.10,-.025],.28).rotation.y=Math.PI;
  world.assetRoots.series=world.leakScene.root;return flat;
 });
 return world;
}
export function syncHotelSeries(world,state){
 if(!world.serviceItems)return;
 // Refresh shadows only for scene motion; the hotel geometry is otherwise static.
 const shadowKey=JSON.stringify([state.player.x.toFixed(2),state.player.z.toFixed(2),state.player.yaw.toFixed(2),state.carriedItem,state.attachment,state.furniture,state.slots,Object.values(state.items).map(i=>i.location)]);
 const now=performance.now();
 if((shadowKey!==world.shadowKey||state.actionTarget)&&now-(world.shadowTime??-1000)>100){
  for(const light of world.shadowLights??[])light.shadow.needsUpdate=true;
  world.shadowKey=shadowKey;world.shadowTime=now;
 }
 for(const[id,root]of Object.entries(world.serviceItems)){
  const item=state.items[id];root.visible=item.location!=="carried";
  const p=itemPose(id,state);if(root.visible){root.position.set(p.x,p.y,p.z);root.rotation.set(item.type==="towel"&&["room","slot"].includes(item.location)?.065:0,item.type==="towel"?.12:0,0);}
 }
 for(const[key,root]of Object.entries(world.furnitureRoots)){const f=state.furniture[key];root.position.set(f.x,0,f.z);root.rotation.y=f.yaw;}
 syncLeakScene(world,state);
}
