import * as THREE from "three";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {createOfficePhone,createPhoneRinger} from "./office-phone.js";
import {detailArchitecture} from "./office-architecture.js";
import {createOfficeScene as createExistingOffice} from "./scene.js";
import {POINTS,TYPES,HOME,SEATS,CHAIRS,CONFERENCE_LAYOUT,REVISION} from "./office-layout.js";
const mat=(color,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export function box(parent,size,position,material,name=""){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...position);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function textPanel(parent,lines,position,width=.6,height=.18,rotation=[0,0,0],dark=false){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext("2d"),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
 mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);
 mesh.userData.update=()=>{ctx.fillStyle=dark?"#1c3336":"#ece8dc";ctx.fillRect(0,0,1024,512);texture.needsUpdate=true;};
 mesh.userData.update(lines);return mesh;
}
function rounded(parent,size,p,m,r=.003){const o=new THREE.Mesh(new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v/4))),m);o.position.set(...p);parent.add(o);return o;}
function cylinder(parent,r1,r2,h,p,m,segments=24){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),m);o.position.set(...p);parent.add(o);return o;}
const paperMat=mat(0xece9df,.95),darkInk=mat(0x31434a,.9);
export function makeItem(type){
 const t=TYPES[type],root=new THREE.Group();root.name="office-"+type;
 const [w,h,d]=t.size;
 if(type==="water"){
  const points=[[.019,0],[.028,.009],[.032,.025],[.033,.045],[.032,.16],[.027,.185],[.018,.20],[.017,.22]].map(p=>new THREE.Vector2(...p));
  const shell=new THREE.Mesh(new THREE.LatheGeometry(points,32),new THREE.MeshPhysicalMaterial({color:0xd1e2df,roughness:.15,transparent:true,opacity:.56,depthWrite:false,clearcoat:.9,metalness:0,side:THREE.DoubleSide}));root.add(shell);
  cylinder(root,.027,.029,.15,[0,.088,0],new THREE.MeshPhysicalMaterial({color:0xa5cad0,roughness:.1,transparent:true,opacity:.40,depthWrite:false}));
  for(const y of [.032,.047,.061,.175]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.032,.0012,5,32),mat(0xd0dcd9,.22));ring.rotation.x=Math.PI/2;ring.position.y=y;root.add(ring);}
  cylinder(root,.019,.020,.020,[0,.218,0],mat(0x285669,.43));
  for(let i=0;i<20;i++){const theta=i*Math.PI/10;box(root,[.0018,.017,.0018],[Math.sin(theta)*.02,.218,Math.cos(theta)*.02],mat(0x3a6879,.58));}
  cylinder(root,.0333,.0333,.055,[0,.119,0],mat(0xdce4dc,.86));
  cylinder(root,.0335,.0335,.006,[0,.095,0],mat(0x466d78,.6));
 }else if(type==="tray"){
  const m=mat(0x344348,.38,.62);rounded(root,[w,.009,d],[0,.0045,0],m);
  for(const side of [-1,1]){rounded(root,[.008,h,d],[side*w/2,h/2,0],m);for(let j=0;j<11;j++)box(root,[.001,.034,.004],[side*(w/2+.0045),h*.55,-d*.4+j*d*.08],mat(0x17282d,.8));}
  rounded(root,[w,h,.009],[0,h/2,-d/2],m);rounded(root,[w,.020,.009],[0,.010,d/2],m);
  for(const x of [-.14,.14])for(const z of [-.10,.10])cylinder(root,.012,.012,.006,[x,-.001,z],mat(0x202526,.94));
 }else if(type==="remote"){
  rounded(root,[w,h,d],[0,h/2,0],mat(t.color,.40),.009);
  rounded(root,[w*.80,.002,d*.88],[0,h+.0005,0],mat(0x1c2327,.55),.003);
  for(const z of [-.04,.014,.055])cylinder(root,z===-.04?.015:.009,z===-.04?.015:.009,.004,[0,h+.003,z],mat(z===-.04?0x678b92:0x60686a,.50));
  box(root,[.008,.004,.013],[0,.014,-d/2+.002],mat(0x8a3531,.22));
 }else{
  if(type==="folder"){
   rounded(root,[w,.005,d],[0,.0025,0],mat(t.color,.78));rounded(root,[.017,h,d],[w/2-.008,h/2,0],mat(t.color,.74));rounded(root,[.075,.004,.03],[-.085,.005,-d/2-.01],mat(t.color,.68));
  }
  const sheets=type==="paper"?9:6;
  for(let i=0;i<sheets;i++){const yy=(type==="folder"?.009:.002)+i*(h-.01)/sheets;box(root,[w*.94,.0014,d*.92],[i%2*.0007,yy,0],i%2?paperMat:mat(0xd2d0c7,.96));}
  if(type==="folder")rounded(root,[w,.004,d],[0,h-.002,0],mat(t.color,.75));
  else rounded(root,[w,.003,d],[0,h-.0015,0],paperMat,.001);
  const y=h+.002;
  if(type==="paper"){
   box(root,[w*.72,.002,d*.55],[0,y,0],mat(0xadc0bb,.93));textPanel(root,["A4","80 g/m²"],[0,y+.001,0],w*.65,d*.47,[-Math.PI/2,0,0]);
  }else{
   box(root,[w*.70,.001,d*.10],[0,y,-d*.25],type==="folder"?paperMat:darkInk);
   for(let i=0;i<5;i++)box(root,[w*(i===4?.40:.66),.0005,.003],[0,y+.001,-d*.08+i*d*.065],type==="folder"?mat(0x9eb4bb,.9):mat(0xabb0aa,.96));
   if(type!=="folder")for(let i=0;i<4;i++)box(root,[.018,.0005,.018+i*.009],[-.057+i*.037,y+.001,d*.29-i*.003],mat(i%2?0x899f9a:0xb9b39c,.9));
  }
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;
}
export function createOfficeSeriesScene(){
 const world=createExistingOffice();
 world.revision=REVISION;world.items={};world.carryTemplates={};world.chairs={};world.markers=[];
 for(const root of [...Object.values(world.deviceRoots),...Object.values(world.cardinalDevices)])root.visible=false;
 world.terminalScreen.visible=false;
 const furniture=new THREE.Group();furniture.name="office-service-fixtures";world.scene.add(furniture);
 const metal=mat(0x45545a,.4,.55),wood=mat(0xc5ad83),white=mat(0xd6d8d3);
 const counter=(x,z,w,d,y)=>{rounded(furniture,[w,.055,d],[x,y-.0275,z],wood,.006);box(furniture,[w-.18,.08,.035],[x,y-.20,z+d/2-.035],metal);for(const dx of [-w/2+.07,w/2-.07])for(const dz of [-d/2+.07,d/2-.07])box(furniture,[.055,y-.055,.055],[x+dx,(y-.055)/2,z+dz],metal);};
 counter(-9.7,4.68,2.8,.7,.965);counter(8.8,4.29,2.65,.6,.965);
 counter(6.5,5.35,1.3,1,.72);counter(-1.65,5.3,2.8,.6,.965);
 const printer=new THREE.Group();printer.name="office-printer";printer.position.set(6.5,.72,5.35);furniture.add(printer);world.printerRoot=printer;
 box(printer,[.62,.28,.46],[0,.14,0],white);box(printer,[.57,.035,.4],[0,.295,0],metal);
 box(printer,[.45,.04,.16],[0,.11,-.30],metal);
 world.printerScreen=textPanel(printer,["缺纸","装入 A4 纸"],[-.2,.305,-.18],.18,.10,[-Math.PI/2,0,0],true);
 world.telephone=createOfficePhone(furniture);world.phoneRinger=createPhoneRinger();
 world.ceiling=new THREE.Group();world.ceiling.name="office-first-person-ceiling";world.scene.add(world.ceiling);
 box(world.ceiling,[26,.12,18],[0,3.4,0],mat(0xe1e0d9));
 for(const x of [-12,-9,-6,-3,0,3,6,9,12])box(world.ceiling,[.018,.008,18],[x,3.336,0],mat(0x999d99));
 for(const z of [-9,-6,-3,0,3,6,9])box(world.ceiling,[26,.008,.018],[0,3.336,z],mat(0x999d99));
 // Markers share the exact gameplay targets; no text or filled overlays.
 const outline=(name,p,w,d)=>{
  const root=new THREE.Group();root.name=name;root.position.set(p.x,p.y+.012,p.z);world.scene.add(root);
  const yellow=new THREE.MeshBasicMaterial({color:0xffd52a,toneMapped:false}),t=.025;
  for(const z of [-d/2,d/2])box(root,[w+t,.004,t],[0,0,z],yellow).castShadow=false;
  for(const x of [-w/2,w/2])box(root,[t,.004,d],[x,0,0],yellow).castShadow=false;
  world.markers.push(root);return root;
 };
 outline("office-target-document",SEATS[0].doc,.34,.41);
 outline("office-target-water",SEATS[0].water,.20,.20);
 world.chairMarker=outline("office-target-chair",{...CHAIRS["chair-a"].target,y:0},.84,.84);


 detailArchitecture(world);
 const loader=new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("/vendor/draco/").setWorkerLimit(2)),assetRoot="/local-assets/levels/rf09/office-v1";
 const extraReady=new Promise(resolve=>loader.load(assetRoot+"/office-printer.glb",gltf=>{
  for(const child of [...printer.children])if(child!==world.printerScreen)printer.remove(child);
  gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});printer.add(gltf.scene);
  world.printerScreen.position.set(-.22,.316,-.389);world.printerScreen.scale.set(.66,.64,1);
  resolve({loaded:true,name:"detailed-office-printer",url:assetRoot+"/office-printer.glb"});
 },undefined,error=>resolve({loaded:false,name:"detailed-office-printer",error})));
 const plantReady=new Promise(resolve=>loader.load("/local-assets/cardinal/rf02/models/runtime/indoor-planter.glb",gltf=>{
  const source=gltf.scene,b=new THREE.Box3().setFromObject(source),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
  source.scale.set(.64/size.x,1.48/size.y,.64/size.z);source.position.set(-center.x*source.scale.x,-b.min.y*source.scale.y,-center.z*source.scale.z);source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  for(const x of [-7.6,7.6]){const holder=new THREE.Group();holder.position.set(x,0,-8.25);holder.add(source.clone(true));world.scene.add(holder);}
  resolve({loaded:true,name:"reused-cardinal-planter"});
 },undefined,error=>resolve({loaded:false,name:"reused-cardinal-planter",error})));
 const baseReady=world.assetReady;
 world.assetReady=Promise.all([baseReady,extraReady,plantReady]).then(([results,extra,plant])=>{
  for(const root of [...Object.values(world.deviceRoots),...Object.values(world.cardinalDevices)])root.visible=false;
  for(const name of ["podium","terminal"]){world.fixtureRoots[name].visible=false;world.fallbackGroups[name].visible=false;}
  const {chairXs,northZ,southZ}=CONFERENCE_LAYOUT;
  for(let i=1;i<=4;i++){
   for(const groups of [world.fixtureRoots,world.fallbackGroups]){
    groups["chair-north-"+i].position.set(chairXs[i-1],0,northZ);
    groups["chair-south-"+i].position.set(chairXs[i-1],0,southZ);
   }
  }
  world.chairs["chair-a"]=world.fixtureRoots["chair-south-1"];world.chairs["chair-b"]=world.fixtureRoots["chair-south-4"];
  for(const type of Object.keys(TYPES))world.carryTemplates[type]=makeItem(type);
  return [...results,extra,plant];
 });
 return world;
}
export function syncOfficeSeries(world,s){
 world.chairMarker.visible=s.level!=="rf09";
 for(const [id,item]of Object.entries(s.items)){
  let root=world.items[id];
  if(!root){root=makeItem(item.type);root.name="office-item-"+id;world.scene.add(root);world.items[id]=root;}
  root.visible=item.available!==false&&["surface","floor","delivered"].includes(item.location);
  root.position.set(item.x,item.y,item.z);root.rotation.y=item.yaw??0;
 }
 for(const [id,c]of Object.entries(s.chairs)){const r=world.chairs[id];if(r){r.position.set(c.x,0,c.z);r.rotation.y=c.yaw;}}
 world.telephone.userData.sync(s.phone,s.clock);world.phoneRinger.update(s.phone.status==="ringing"&&!s.failed,s.clock);
 const chair=s.chairs["chair-a"],parked=Math.hypot(chair.x-chair.target.x,chair.z-chair.target.z)<.14;
 const key=[s.level,s.phone.status,Math.ceil(s.phone.remaining),s.seats[0].doc,s.seats[0].water,parked].join("|");
 if(world.displayKey!==key){
  world.displayKey=key;world.printerScreen.userData.update(["办公打印机","待机"]);
 }

}
export function prepareOfficeView(world,{firstPerson}){
 world.ceiling.visible=firstPerson;
 for(const [key,root]of Object.entries(world.fixtureRoots))if(key.startsWith("ceiling-light-"))root.visible=false;
}
