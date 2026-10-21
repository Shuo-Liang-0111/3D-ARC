import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background=new THREE.Color("#bec9c4");
const generator=new THREE.PMREMGenerator(renderer); const room=new RoomEnvironment();
scene.environment=generator.fromScene(room).texture; room.dispose(); generator.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0x526258,1.5));
const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(1,2,3);scene.add(sun);
const camera=new THREE.PerspectiveCamera(40,1,0.01,20);
camera.position.set(0.65,0.55,0.7);
const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(0,0.12,0); controls.update();
const grid=new THREE.GridHelper(2,20,0x668877,0x99aaa1);scene.add(grid);
const loader=new GLTFLoader(); let model=null;
async function load(){
 const name=document.querySelector("#asset").value;document.querySelector("#status").textContent="正在加载";
 if(model)scene.remove(model);
 const asset=await loader.loadAsync("/local-assets/levels/rf13/cardinal-v0.2/models/runtime/"+name+".glb");
 model=asset.scene;scene.add(model);
 document.querySelector("#status").textContent=name+" · 10 cm 网格 · 拖动旋转检查";
}
document.querySelector("#asset").onchange=load;
function resize(){renderer.setSize(innerWidth,innerHeight-56);camera.aspect=innerWidth/(innerHeight-56);camera.updateProjectionMatrix();}
addEventListener("resize",resize);resize();await load();
function render(){controls.update();renderer.render(scene,camera);requestAnimationFrame(render);}render();

