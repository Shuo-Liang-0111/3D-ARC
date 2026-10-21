import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js";
export const CAN_HOME={x:4.86,y:.83,z:1.43};
export function addPesticide(w){
 const mat=new THREE.MeshStandardMaterial({color:0x7c6650,roughness:.7});
 const shelf=new THREE.Mesh(new THREE.BoxGeometry(.54,.035,.26),mat);shelf.position.set(4.98,.8075,1.43);shelf.castShadow=true;w.scene.add(shelf);
 for(const z of [1.34,1.52]){const bracket=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.018),new THREE.MeshStandardMaterial({color:0x666a69,metalness:.7,roughness:.4}));bracket.position.set(5.14,.73,z);w.scene.add(bracket);}
 const root=new THREE.Group();root.name="RF06_Pesticide";root.position.set(CAN_HOME.x,CAN_HOME.y,CAN_HOME.z);w.scene.add(root);w.pesticide=root;
 const draco=new DRACOLoader().setDecoderPath("/vendor/draco/");draco.setWorkerLimit(2);const loader=new GLTFLoader().setDRACOLoader(draco);
 const url="/local-assets/levels/rf06/pest-v2/insecticide.glb";
 const loaded=new Promise(resolve=>loader.load(url,g=>{
  root.add(g.scene);g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});resolve({loaded:true,url,model:g.scene});
 },undefined,e=>resolve({loaded:false,url,error:String(e)})));
 const previous=w.assetReady;w.assetReady=Promise.all([previous,loaded]).then(v=>v.flat(Infinity));
 return w;
}
