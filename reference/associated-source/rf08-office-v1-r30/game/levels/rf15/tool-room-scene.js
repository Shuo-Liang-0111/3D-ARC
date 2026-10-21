import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TOOL_ROOM } from "./tool-room-layout.js";
import { FIELD_REVISION } from "./field-layout.js";
const loader = new GLTFLoader();
const cache = new Map();
const kinds = ["harvest-knife", "hand-trowel", "sprayer"];
function load(kind, parent) {
  const revision = ["room", "door"].includes(kind) ? FIELD_REVISION : TOOL_ROOM.revision;
  const url = `/local-assets/levels/rf15/${revision}/${kind}.glb`;
  if (!cache.has(kind)) cache.set(kind, loader.loadAsync(url));
  return cache.get(kind).then(asset => {
    const model = asset.scene.clone(true);
    model.name = kind;
    model.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    parent.add(model);
    return { loaded: true, name: `tool-room-${kind}`, model, url };
  }).catch(error => ({ loaded: false, name: `tool-room-${kind}`, error: String(error) }));
}
function removeOldBuilding(environment) {
  environment.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  environment.traverse(node => {
    if (!node.isMesh || !node.geometry.attributes.position) return;
    const source = node.geometry;
    const positions = source.attributes.position;
    const indices = source.index;
    const kept = [];
    const groups = [];
    for (const group of source.groups.length ? source.groups : [{ start: 0, count: indices ? indices.count : positions.count, materialIndex: 0 }]) {
      const start = kept.length;
      for (let offset = group.start; offset < group.start + group.count; offset += 3) {
        const triangle = [0, 1, 2].map(corner => indices ? indices.getX(offset + corner) : offset + corner);
        let remove = true;
        let height = 0;
        for (const vertex of triangle) {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(node.matrixWorld);
          height += point.y;
          if (!(point.x > -7.6 && point.x < -.4 && point.z > -14.7 && point.z < -9.5)) remove = false;
        }
        if (!remove || height / 3 < .015) kept.push(...triangle);
      }
      groups.push({ start, count: kept.length - start, materialIndex: group.materialIndex });
    }
    if (kept.length !== (indices ? indices.count : positions.count)) {
      node.geometry = source.clone();
      node.geometry.setIndex(kept);
      node.geometry.clearGroups();
      for (const group of groups) node.geometry.addGroup(group.start, group.count, group.materialIndex);
    }
  });
}
function sign(text, x, y, z, width, height) {
  const canvas = document.createElement("canvas"); canvas.width = Math.round(256 * width / height); canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#234b3b"; context.fillRect(0, 0, canvas.width, 256);
  context.fillStyle = "#eee9d8"; context.font = "bold 100px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text,canvas.width / 2,128,canvas.width - 44);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({ map:texture,roughness:.8 }));
  mesh.position.set(x,y,z); return mesh;
}
export function installToolRoom(world) {
  if(new URLSearchParams(location.search).get("qa")==="tool-room") import("./tool-room-qa.js").then(module=>module.installToolRoomQA());
  const root = new THREE.Group(); root.name = "RF15-tool-room"; world.scene.add(root);
  const hinge = new THREE.Group(); hinge.position.set(TOOL_ROOM.hinge.x,0,TOOL_ROOM.hinge.z); root.add(hinge);
  const tools = {};
  const jobs = [load("room",root),load("door",hinge)];
  for (const [kind, position] of [["harvest-knife",TOOL_ROOM.harvest],["hand-trowel",TOOL_ROOM.trowel],["sprayer",TOOL_ROOM.sprayer]]) {
    const anchor=new THREE.Group(); anchor.position.set(position.x,position.y,position.z); root.add(anchor); tools[kind]=anchor; jobs.push(load(kind,anchor));
  }
  root.add(sign("农具房",-4,2.84,-9.875,1.45,.32));
  root.add(sign("收割刀    手铲    农药喷剂",-4,2.30,-13.79,3.3,.28));
  world.toolRoom={root,hinge,tools};
  const previous=world.assetReady;
  world.assetReady=Promise.all([previous,Promise.all(jobs)]).then(([base,added])=>{
    if (added.every(asset=>asset.loaded)) removeOldBuilding(world.assetRoots.environment);
    const results=[...base,...added];
    const shell=document.querySelector("#game-shell");
    if(shell) { shell.dataset.toolRoomRevision=TOOL_ROOM.revision; shell.dataset.worldAssetErrors=JSON.stringify(results.filter(asset=>!asset.loaded)); shell.dataset.worldAssetsLoaded=String(results.filter(asset=>asset.loaded).length); shell.dataset.worldAssetsTotal=String(results.length); }
    return results;
  });
}
export function syncToolRoom(world,state) {
  world.toolRoom.hinge.rotation.y=state.toolDoorAngle || 0;
  world.toolRoom.tools["harvest-knife"].visible=state.heldTool!=="harvest-knife";
  world.toolRoom.tools["hand-trowel"].visible=state.heldTool!=="hand-trowel";
  world.toolRoom.tools.sprayer.visible=!state.sprayer;
  const shell=document.querySelector("#game-shell");
  if(shell) shell.dataset.toolRoomState=JSON.stringify({open:state.toolRoomOpen,angle:state.toolDoorAngle,held:state.heldTool,sprayer:state.sprayer,event:state.lastEvent,player:state.player});
}
export function installCargoTools(root) {
  const anchors={};
  const jobs=kinds.map(kind=>{
    const anchor=new THREE.Group(); anchor.visible=false; anchor.position.set(0,-.23,0);root.add(anchor);anchors[kind]=anchor;return load(kind,anchor);
  });
  root.userData.toolModels=anchors;
  const previous=root.userData.assetReady;
  root.userData.assetReady=Promise.all([previous,Promise.all(jobs)]).then(results=>results.flat());
  return root;
}
export function syncCargoTools(root,state) {
  const kind=state.carriedItem?null:state.heldTool || (state.sprayer?"sprayer":null);
  for(const [name,anchor] of Object.entries(root.userData.toolModels || {})) anchor.visible=name===kind;
  if(kind) for(const variant of Object.values(root.userData.variants || {})) variant.visible=false;
}
