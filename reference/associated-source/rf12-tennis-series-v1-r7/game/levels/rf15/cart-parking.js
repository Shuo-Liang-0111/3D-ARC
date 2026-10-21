import * as THREE from 'three';
import { CART } from './cart-layout.js';

// Thin paint on the concrete, sharing the exact bounds used by the task engine.
export function installCartParking(world) {
  const root = new THREE.Group(); root.name = 'cart-parking-bay';
  root.position.set(CART.parking.x, .025, CART.parking.z); root.rotation.y = CART.parking.yaw;
  const material = new THREE.MeshStandardMaterial({color: '#edbf39', roughness: .92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
  const {halfWidth:w, halfLength:l, lineWidth:t} = CART.bay;
  function stripe(x,z,width,length,angle=0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,length),material);
    mesh.rotation.set(-Math.PI/2,0,angle); mesh.position.set(x,0,z); mesh.receiveShadow=true; root.add(mesh);
  }
  stripe(-w,0,t,2*l+t);stripe(w,0,t,2*l+t);stripe(0,-l,2*w,t);stripe(0,l,2*w,t);
  // Forward chevron makes the required cart direction visible from the entrance.
  stripe(0,.16,.055,.36);stripe(-.09,.27,.055,.25,-Math.PI/4);stripe(.09,.27,.055,.25,Math.PI/4);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#edbf39';ctx.font='bold 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('手推车停放区',256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.32),new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  label.rotation.x=-Math.PI/2;label.position.z=-1.23;root.add(label);
  world.scene.add(root);world.cartParking={root,material};
}
