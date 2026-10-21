import * as THREE from "three";
import { WINDOW } from "./series-wind.js";
const material=(color,roughness=.6,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(root,size,p,m,name){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),m);o.position.set(...p);o.name=name;o.receiveShadow=true;root.add(o);return o;}
function cloth(root,x,width){
 const g=new THREE.PlaneGeometry(width,2.12,28,50),m=new THREE.MeshStandardMaterial({color:0xf7f3e8,side:THREE.DoubleSide,transparent:true,opacity:.71,roughness:1,depthWrite:false});
 const o=new THREE.Mesh(g,m);o.position.set(x,1.5,-4.94);o.name="IndependentSheerCurtain";root.add(o);
 return {mesh:o,base:g.attributes.position.array.slice()};
}
export function createWindScene(world){
 world.assetRoots.static.curtainWindow.visible=false;
 const root=new THREE.Group();root.name="GuestroomWindTask";world.scene.add(root);
 const frame=material(0xe0dfd8,.44,.22),seal=material(0x545c5a,.85),metal=material(0xadb6b7,.25,.82);
 // Rebuilt frame sits inside the existing north-wall opening footprint.
 for(const x of [1.06,3.54])box(root,[.075,2.12,.11],[x,1.57,-5.09],frame,"WindowJamb");
 for(const y of [.55,2.59])box(root,[2.56,.075,.11],[2.30,y,-5.09],frame,"WindowFrame");
 box(root,[2.72,.055,.26],[2.30,.49,-5.00],material(0xc6c3b8,.65),"StoneWindowSill");
 box(root,[2.42,1.96,.016],[2.30,1.57,-5.15],new THREE.MeshBasicMaterial({color:0x9baeb6}),"DaylightBacking");
 const glass=new THREE.MeshStandardMaterial({color:0xb4ccd0,transparent:true,opacity:.24,roughness:.18,metalness:.25,side:THREE.DoubleSide});
 box(root,[1.38,1.96,.025],[1.80,1.57,-5.035],glass,"FixedWindowGlass");
 box(root,[.052,2.00,.08],[2.51,1.57,-5.045],frame,"WindowMullion");
 const sash=new THREE.Group();sash.position.set(WINDOW.hingeX,0,WINDOW.z);root.add(sash);sash.name="OperableWindowSash";
 for(const x of [-.91,0])box(sash,[.045,1.94,.055],[x,1.57,0],frame,"SashVertical");
 for(const y of [.62,2.52])box(sash,[.94,.045,.055],[-.455,y,0],frame,"SashHorizontal");
 box(sash,[.85,1.85,.018],[-.455,1.57,0],glass,"MovingWindowGlass");
 for(const y of [.84,2.22])box(root,[.026,.085,.037],[WINDOW.hingeX+.027,y,WINDOW.z+.04],metal,"WindowHinge");
 box(sash,[.027,.145,.015],[WINDOW.handleX,WINDOW.handleY,.036],seal,"HandlePlate");
 const latch=new THREE.Group();latch.position.set(WINDOW.handleX,WINDOW.handleY,WINDOW.handleZ);sash.add(latch);
 box(latch,[.023,.11,.027],[0,-.025,0],metal,"WindowLatchHandle");
 const curtains=[cloth(root,1.35,.58),cloth(root,3.48,.28)];
 box(root,[2.88,.045,.055],[2.30,2.61,-4.89],metal,"CurtainTrack");
 const velvet=material(0x777768,.95);
 for(const [x,sign]of [[.92,1],[3.72,-1]])for(let i=0;i<6;i++){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(.056,.068,2.40,12),velvet);o.position.set(x+sign*i*.057,1.38,-4.98+(i%2)*.03);root.add(o);
 }
 return {root,sash,latch,curtains};
}
export function syncWindScene(world,state){
 const w=world.windScene;if(!w)return;const b=state.wind;
 w.sash.rotation.y=b.opening*WINDOW.maxAngle;w.latch.rotation.z=(1-b.latch)*Math.PI/2;
 for(const {mesh,base} of w.curtains){const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1],lower=(1.06-y)/2.12;
   p.setXYZ(i,x,y,Math.sin((x+mesh.position.x)*40)*.019+b.wind*lower*lower*(.095+.075*Math.sin(b.clock*2.3+x*6+lower*3)));
  }p.needsUpdate=true;mesh.geometry.computeVertexNormals();
 }
}
