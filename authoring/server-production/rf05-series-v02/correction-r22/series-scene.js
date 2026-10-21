import * as THREE from "three";
import { ASSETS, createHotelRoomScene } from "./scene.js";
import { REVISION, STOCK, SLOTS, TARGETS, BASIN, EXIT, FURNITURE, itemPose } from "./series-layout.js";
const mat=(color,roughness=.6,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geo,material,position,name){const m=new THREE.Mesh(geo,material);m.position.set(...position);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(p,size,pos,m,name){return mesh(p,new THREE.BoxGeometry(...size),m,pos,name);}
function tube(p,a,b,r,m,name){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start),o=mesh(p,new THREE.CylinderGeometry(r,r,v.length(),20),m,start.clone().add(end).multiplyScalar(.5).toArray(),name);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;}
function label(parent,text,pos,width=.45){
 const c=document.createElement("canvas");c.width=512;c.height=128;const ctx=c.getContext("2d");ctx.fillStyle="#e6ded0";ctx.fillRect(0,0,512,128);ctx.fillStyle="#302d28";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 48px sans-serif";ctx.fillText(text,256,64);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const m=mesh(parent,new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),pos,text);return m;
}
function buildBasin(scene,woodMap){
 const group=new THREE.Group();group.name="rf05-service-vanity";scene.add(group);
 const ceramic=mat(0xe7e4dc,.21),chrome=mat(0xadb9be,.2,.85),wood=mat(0x594031,.68),dark=mat(0x333b3c,.5);
 if(woodMap){wood.map=woodMap.clone();wood.map.repeat.set(.22,.22);wood.map.needsUpdate=true;}
 const x=BASIN.x,z=BASIN.z;
 box(group,[.65,.61,1.2],[x-.11,.395,z],wood,"vanity-cabinet");
 for(const dz of [-.305,.305]){box(group,[.035,.48,.58],[x+.222,.41,z+dz],wood,"cabinet-door");tube(group,[x+.254,.52,z+dz-.10],[x+.254,.52,z+dz+.10],.012,chrome,"cabinet-handle");}
 for(const dx of [-.29,.20])for(const dz of [-.52,.52])box(group,[.035,.10,.035],[x+dx,.05,z+dz],chrome,"vanity-foot");
 // Open oval ceramic basin: continuous bowl profile, no solid slab across its cavity.
 const profile=[[0,-.018],[.22,-.018],[.265,.012],[.335,.205],[.358,.244],[.358,.25],[.339,.25],[.319,.213],[.247,.024],[.218,0],[0,0]].map(([r,y])=>new THREE.Vector2(r,y));
 const bowl=mesh(group,new THREE.LatheGeometry(profile,80),ceramic,[x,BASIN.bottom,z],"open-ceramic-bowl");bowl.scale.set(.81,1,1.43);
 mesh(group,new THREE.CylinderGeometry(.025,.025,.004,24),chrome,[x,BASIN.bottom+.003,z],"basin-waste");
 // Side-mounted faucet and separate drain control remain individually reachable.
 const t=BASIN.tap;
 tube(group,[t.x-.03,.94,t.z],[t.x-.03,1.14,t.z],.023,chrome,"faucet-riser");
 tube(group,[t.x-.03,1.14,t.z],[x,1.14,z-.10],.02,chrome,"faucet-spout");
 const lever=tube(group,[t.x-.03,1.105,t.z],[t.x+.065,1.105,t.z],.012,chrome,"faucet-lever");
 box(group,[.14,.05,.18],[t.x-.03,.96,t.z],ceramic,"faucet-support");
 const d=BASIN.drain;
 tube(group,[d.x-.04,.84,d.z],[d.x-.04,.96,d.z],.012,chrome,"drain-control-stem");
 mesh(group,new THREE.CylinderGeometry(.04,.04,.015,24),chrome,[d.x-.04,.96,d.z],"drain-knob");
 const water=mesh(group,new THREE.CircleGeometry(.315,64),new THREE.MeshPhysicalMaterial({color:0x69b9c5,roughness:.12,metalness:.1,transparent:true,opacity:.67,side:THREE.DoubleSide}),[x,.76,z],"dynamic-basin-water");water.rotation.x=-Math.PI/2;water.scale.set(.81,1.43,1);water.castShadow=false;
 const stream=tube(group,[x,1.12,z-.10],[x,.76,z-.10],.009,new THREE.MeshPhysicalMaterial({color:0xb8e8ed,roughness:.1,transparent:true,opacity:.8}),"running-water");stream.castShadow=false;
 const ripples=[];for(let i=0;i<3;i++){const ring=mesh(group,new THREE.RingGeometry(.04,.043,48),new THREE.MeshBasicMaterial({color:0xd9ffff,transparent:true,opacity:.25,side:THREE.DoubleSide}),[x,.8,z-.10],"water-ripple-"+i);ring.rotation.x=-Math.PI/2;ripples.push(ring);}
 const foam=mesh(group,new THREE.CircleGeometry(.055,28),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,side:THREE.DoubleSide}),[BASIN.cup.x,.88,BASIN.cup.z],"washing-foam");foam.rotation.x=-Math.PI/2;
 const tapLabel=label(group,"进水",[t.x+.018,1.02,t.z-.09],.16);tapLabel.rotation.y=Math.PI/2;
 const drainLabel=label(group,"排水",[d.x+.025,.97,d.z+.07],.16);drainLabel.rotation.y=Math.PI/2;
 for(const fraction of [.4,.7]){tube(group,[x+.235,BASIN.bottom+fraction*.22,z-.2],[x+.235,BASIN.bottom+fraction*.22,z+.12],.003,mat(0x438473),"safe-water-line");}
 const mirror=box(group,[.02,.8,1.0],[-4.045,1.55,z],new THREE.MeshStandardMaterial({color:0xabc5c7,metalness:.7,roughness:.11}),"vanity-mirror");
 return {group,water,stream,ripples,lever,foam,mirror};
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
  world.assetRoots.static.bathroomVanity.visible=false;
  world.assetRoots.static.toilet.position.set(-2.10,0,3.42);
  for(const light of world.assetRoots.static.ceilingLights)light.visible=false;
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
   tube(root,[-f.handleHalfWidth,f.handleY,-f.handleBack],[f.handleHalfWidth,f.handleY,-f.handleBack],.014,chrome,key+"-grasp-bar");
   for(const dx of [-f.handleHalfWidth,f.handleHalfWidth])tube(root,[dx,f.handleY,-f.handleBack],[dx,f.handleY-.16,-f.handleBack+.08],.013,chrome,key+"-handle-support");
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
  world.basin=buildBasin(world.scene,world.assetRoots.shell.getObjectByName("GuestroomWoodFloor").material.map);
  const terminal=new THREE.Group();terminal.position.set(0,0,EXIT.z);world.scene.add(terminal);
  // A slim freestanding door-side card avoids adding an invisible solid across the entrance.
  box(terminal,[.12,.95,.10],[.47,.475,0],mat(0x424b4c,.4,.4),"handover-post");
  box(terminal,[.30,.22,.04],[.40,1.10,0],mat(0x31484a,.5),"handover-plate");
  label(terminal,"交房确认",[.40,1.10,-.025],.28).rotation.y=Math.PI;
  world.assetRoots.series=world.basin.group;return flat;
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
  const p=itemPose(id,state);if(root.visible){root.position.set(p.x,p.y,p.z);root.rotation.set(0,item.type==="towel"?.12:0,0);}
 }
 for(const[key,root]of Object.entries(world.furnitureRoots)){const f=state.furniture[key];root.position.set(f.x,0,f.z);root.rotation.y=f.yaw;}
 const b=world.basin,w=state.sink.water,level=BASIN.bottom+.01+w*.22;
 b.water.visible=w>.002;b.water.position.y=level;b.water.scale.set(.81*(.72+.28*w),1.43*(.72+.28*w),1);
 b.stream.visible=state.sink.faucet;b.lever.rotation.z=state.sink.faucet?-.45:0;
 b.ripples.forEach((r,i)=>{const phase=(state.sink.clock*.8+i/3)%1;r.visible=w>.002&&state.sink.faucet;r.position.y=level+.002;r.scale.setScalar(1+phase*3);r.material.opacity=(1-phase)*.35;});
 b.foam.visible=state.actionTarget==="wash";b.foam.position.y=level+.005;
}
