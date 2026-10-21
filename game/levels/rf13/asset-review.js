import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { REVISION } from "./level.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#bec9c4");
const generator = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment();
scene.environment = generator.fromScene(room).texture; room.dispose(); generator.dispose();
scene.add(new THREE.HemisphereLight(0xffffff, 0x526258, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 40);
camera.position.set(0.65, 0.55, 0.7);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.12, 0); controls.update();
scene.add(new THREE.GridHelper(2, 20, 0x668877, 0x99aaa1));
const loader = new GLTFLoader();
let model = null;
let requestNumber = 0;
const selection = document.querySelector("#asset");
const status = document.querySelector("#status");
const parameters = new URLSearchParams(location.search);
if (parameters.has("asset")) selection.value = parameters.get("asset");
async function load() {
  const currentRequest = ++requestNumber;
  const name = selection.value;
  const revision = parameters.get("revision") || REVISION;
  status.textContent = "正在加载";
  try {
    if (!/^[a-z0-9.-]+$/.test(revision)) throw new Error("Invalid asset revision");
    const asset = await loader.loadAsync(`/local-assets/levels/rf13/${revision}/${name}.glb`);
    if (currentRequest !== requestNumber) return;
    if (model) scene.remove(model);
    model = asset.scene; scene.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(extent * 1.3, extent * 0.8, extent * 1.5));
    controls.update();
    status.textContent = `${name} · ${[size.x, size.y, size.z].map(value => value.toFixed(3)).join(" × ")} m · 网格 10 cm`;
  } catch (error) {
    if (currentRequest === requestNumber) status.textContent = `加载失败：${error.message}`;
  }
}
selection.onchange = load;
function resize() { renderer.setSize(innerWidth, innerHeight - 56); camera.aspect = innerWidth / (innerHeight - 56); camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize(); load();
function render() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(render); }
render();
