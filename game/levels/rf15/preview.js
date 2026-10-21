import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createScene, syncVisuals } from './scene.js';
import { createInitialState } from './engine.js';
import { REVISION } from './level.js';
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3; document.body.append(renderer.domElement);
const asset = new URLSearchParams(location.search).get('asset');
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.05,100);
const controls=new OrbitControls(camera,renderer.domElement);
let scene;
if(asset){
 scene=new THREE.Scene();scene.background=new THREE.Color('#b9c9c7');scene.add(new THREE.HemisphereLight(0xffffff,0x697969,2.5));const sun=new THREE.DirectionalLight(0xffeedc,3);sun.position.set(3,6,4);scene.add(sun);
 const decoder=new DRACOLoader().setDecoderPath('/vendor/draco/');const loader=new GLTFLoader().setDRACOLoader(decoder);const gltf=await loader.loadAsync(`/local-assets/levels/rf15/${REVISION}/${asset}.glb`);scene.add(gltf.scene);
 camera.position.set(1.6,1.3,1.9);controls.target.set(0,.3,0);controls.update();document.querySelector('#status').textContent=asset+' · 当前正式候选资产';
}else{
 const world=createScene(renderer);scene=world.scene;const state=createInitialState();const results=await world.assetReady;syncVisuals(world,state);document.querySelector('#status').textContent=`RF-15 ${REVISION} · ${results.filter(result=>result.loaded).length}/${results.length} 资产`;
 camera.position.set(14,12,17);controls.target.set(0,1,-1);controls.update();
}
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
