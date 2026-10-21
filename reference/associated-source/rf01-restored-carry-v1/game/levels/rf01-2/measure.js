import * as THREE from "three";
import { createFacilityScene } from "../../scene.js";
const world = createFacilityScene();
await world.assetReady;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.body.append(renderer.domElement);
const camera = new THREE.OrthographicCamera(-6, 6, 2.8, -2.8, .1, 50);
camera.position.set(0, 2.3, 2);
camera.lookAt(0, 2.3, -4);
for (let coordinate = -5; coordinate <= 5; coordinate += 1) {
 const points = [new THREE.Vector3(coordinate, 0, -.7), new THREE.Vector3(coordinate, 4.6, -.7)];
 world.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color:0xffcc33})));
 const canvas = document.createElement("canvas"); canvas.width=128; canvas.height=64;
 const context = canvas.getContext("2d"); context.fillStyle="#fff"; context.font="bold 40px sans-serif"; context.fillText(String(coordinate),10,45);
 const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));
 sprite.position.set(coordinate,.15,-.5);sprite.scale.set(.6,.3,1);world.scene.add(sprite);
}
for (let height = .5; height <= 4.5; height += .5) {
 const points = [new THREE.Vector3(-5.2,height,-.65), new THREE.Vector3(5.2,height,-.65)];
 world.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffcc33})));
}
document.querySelector("#info").textContent = "World X grid = 1 m; horizontal grid = 0.5 m; original door remains closed";
renderer.render(world.scene,camera);
