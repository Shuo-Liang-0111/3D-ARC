import * as THREE from '/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from '/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c7d7d7');
scene.add(new THREE.HemisphereLight(0xddeaf1,0x81745a,1.9));
const sun = new THREE.DirectionalLight(0xffe3b5,2.5);
sun.position.set(-12,18,9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:.5,far:60});
sun.shadow.bias = -.00025;
sun.shadow.normalBias = .025;
scene.add(sun);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.environmentIntensity = .4;
const camera = new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,100);
const controls = new OrbitControls(camera,renderer.domElement);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/draco/'));
const requestedRevision = new URLSearchParams(location.search).get('revision');
const revision = /^realism-v\d+\.\d+\.\d+$/.test(requestedRevision || '') ? requestedRevision : 'realism-v0.4.3';
const status = document.querySelector('#status');
const inspection = new URLSearchParams(location.search).get('inspect');
const slots = inspection === 'fire' ? [['fire-rf01',[-1,0,0]],['fire-rf03',[1,0,0]]] : inspection === 'cargo' ? [['apple-box',[-.4,0,0]],['tomato-box',[.4,0,0]]] : [
  ['rf15_final',[0,0,0]],['tail-lift',[5.3,0,1]],['platform-scale',[-2.6,.76,-4.2]],
  ['pallet-jack',[1.5,0,4.9]],['tomato-crate',[-6.4,.82,-4.2]],['apple-crate',[-5.3,.82,-4.2]],
  ['plane-tree',[-12,0,-9]],['plane-tree',[-12,0,7]],['plane-tree',[11,0,-10]],['plane-tree',[17,0,-11]],
];
await Promise.all(slots.map(async ([name,position])=>{
  const assetPath = name === 'fire-rf01' ? '/local-assets/cardinal/rf01/models/runtime/rf01_fire_safety_station.glb' : name === 'fire-rf03' ? '/local-assets/cardinal/rf03/models/runtime/fire_safety_station.glb' : `/local-assets/levels/rf15/${revision}/${name}.glb`;
  const asset=await loader.loadAsync(assetPath);
  if (name.startsWith('fire-')) {
    const bounds = new THREE.Box3().setFromObject(asset.scene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 1.4 / size.y;
    asset.scene.scale.multiplyScalar(scale);
    asset.scene.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    const normalized = new THREE.Group(); normalized.add(asset.scene); asset.scene=normalized;
  }
  asset.scene.position.set(...position);
  if(name==='plane-tree')asset.scene.scale.setScalar(.65);
  if(name==='platform-scale')asset.scene.rotation.y=-Math.PI/2;
  asset.scene.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
  scene.add(asset.scene);
}));
status.textContent = inspection === 'fire' ? '已有 Cardinal 消防资产隔离检查' : revision+' · '+slots.length+'/'+slots.length+' 实物与贴图';
for (const [label,position,target] of [
  ['工作台与周转筐',[-4.4,2.4,-.1],[-5.6,.9,-4]],
  ['镂空周转筐',[-5.3,1.75,.2],[-7.4,.55,-1.3]],
  ['洗手池与包装工位',[3.6,2,-3.6],[1.6,1,-5.1]],
  ['包装工具',[.3,1.55,-2.6],[.65,.88,-4.0]],
  ['出库台与托盘',[-4.9,2.3,6.4],[-7.2,.7,4.7]],
  ['车头与制冷机',[9,3.1,-8],[5.3,1.65,-4.9]],
  ['消防柜',[-6.1,2.0,-1.9],[-8.12,1.6,-3.0]],
  ['灯具与墙面',[-4.4,2.0,-2.0],[-4.4,3.2,-4.5]],
  ['钢架与屋面',[-3.8,4.9,5],[-3.3,3.7,-1.8]],
  ['排水与地面',[-.5,1.3,4.4],[-.5,.05,1.4]],
  ['农田与路缘',[14,2.4,6],[15,.2,1]],
  ['冷藏车尾板',[8.6,3,4.5],[5.3,1.1,-.2]],
  ['全景',[12,10,14],[-1,1,-1]],
  ['树木与背景仓库',[-9,6,-17],[-4,2,-10]],
  ['地牛',[3,1.5,6.8],[1.5,.45,4.9]],
]) {
  const button=document.createElement('button');button.textContent=label;
  button.onclick=()=>{camera.position.set(...position);controls.target.set(...target);controls.update();};
  document.querySelector('#views').append(button);
}
document.querySelector('#views button').click();
if (inspection === 'fire') { camera.position.set(0,1.8,4);controls.target.set(0,.7,0);controls.update(); }
if (inspection === 'cargo') { camera.position.set(1,1.1,1.6);controls.target.set(0,.18,0);controls.update(); }
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
