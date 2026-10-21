import * as THREE from "three";
import { LEVEL } from "./level.js";
import { createScene as createBaseScene, createCargoModel, syncVisuals as syncBaseVisuals, syncCargo as syncRobotCargo } from "../rf15/scene.js";

function sprayerMesh() {
  const root = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .32, 6, 12), new THREE.MeshStandardMaterial({ color: 0xd6e6d0, roughness: .45 }));
  tank.rotation.z = Math.PI / 2; root.add(tank);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x26352f, metalness: .45, roughness: .3 }));
  handle.rotation.z = Math.PI / 2; handle.position.y = .17; root.add(handle);
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .38, 8), new THREE.MeshStandardMaterial({ color: 0x24302b, metalness: .6, roughness: .25 }));
  wand.rotation.z = Math.PI / 2; wand.position.set(.25, .02, 0); root.add(wand);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.035, .025, .09, 8), new THREE.MeshStandardMaterial({ color: 0x7a8e63, roughness: .4 }));
  nozzle.rotation.z = Math.PI / 2; nozzle.position.set(.47, .02, 0); root.add(nozzle);
  root.position.set(LEVEL.tool.x, LEVEL.tool.y, LEVEL.tool.z); root.userData.assetKind = "sprayer";
  return root;
}

function toolRoomMesh() {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x68736d, metalness: .55, roughness: .38 });
  for (const y of [1.0, 1.65, 2.3]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, .38), metal);
    shelf.position.set(-6.4, y, 4.65); root.add(shelf);
  }
  for (const x of [-7.1, -5.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.0, 8), metal);
    post.position.set(x, 1.6, 4.65); root.add(post);
  }
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .32, 12), new THREE.MeshStandardMaterial({ color: 0xc7d5c9, roughness: .42 }));
  bottle.position.set(-6.9, 1.22, 4.65); root.add(bottle);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .5, 8), new THREE.MeshStandardMaterial({ color: 0x5b3422, roughness: .7 }));
  handle.position.set(-6.15, 1.25, 4.65); root.add(handle);
  const wall = new THREE.MeshStandardMaterial({ color: 0x9b8060, roughness: .78 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x39453e, metalness: .35, roughness: .48 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, .12), wall);
  back.position.set(-6.2, 1.4, 5.05); root.add(back);
  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.8, .12), frame);
  leftPost.position.set(-7.45, 1.4, 3.8); root.add(leftPost);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.8, .12), frame);
  rightPost.position.set(-5.05, 1.4, 3.8); root.add(rightPost);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.52, .16, .14), frame);
  lintel.position.set(-6.25, 2.72, 3.8); root.add(lintel);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-7.35, 0, 3.8);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.55, .1), new THREE.MeshStandardMaterial({ color: 0x6c4c32, roughness: .72 }));
  door.position.set(1.05, 1.28, 0); doorPivot.add(door);
  for (const y of [.45, 1.25, 2.05]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(1.85, .045, .13), frame);
    brace.position.set(1.05, y, -.06); doorPivot.add(brace);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb28b45, metalness: .7, roughness: .25 }));
  knob.position.set(1.78, 1.25, -.12); doorPivot.add(knob);
  root.add(doorPivot); doorPivot.rotation.y = -Math.PI / 2; root.userData.doorPivot = doorPivot;
  const rakeHead = new THREE.Mesh(new THREE.BoxGeometry(.38, .08, .06), new THREE.MeshStandardMaterial({ color: 0x4b5550, metalness: .55, roughness: .36 }));
  rakeHead.position.set(-6.0, 1.9, 4.63); root.add(rakeHead);
  for (let index = 0; index < 5; index += 1) {
    const tooth = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .16, 6), new THREE.MeshStandardMaterial({ color: 0x4b5550, metalness: .55, roughness: .36 }));
    tooth.position.set(-6.15 + index * .075, 1.82, 4.63); root.add(tooth);
  }
  const knife = new THREE.Mesh(new THREE.BoxGeometry(.42, .035, .07), new THREE.MeshStandardMaterial({ color: 0xc6cbd0, metalness: .8, roughness: .22 }));
  knife.rotation.z = -.18; knife.position.set(-6.75, 1.95, 4.63); root.add(knife);
  root.userData.assetKind = "tool-room"; return root;
}

export function createScene(renderer) {
  const world = createBaseScene(renderer);
  world.toolRoom = toolRoomMesh(); world.scene.add(world.toolRoom);
  if (LEVEL.variant === "rf15-2") { world.sprayer = sprayerMesh(); world.scene.add(world.sprayer); }
  return world;
}
export { createCargoModel, syncRobotCargo };
export function syncVisuals(world, state) {
  syncBaseVisuals(world, state);
  if (LEVEL.variant === "rf15-1") {
    for (const [id, model] of Object.entries(world.items)) {
      const item = state.items[id];
      if (item.location === "basket") {
        model.position.set(LEVEL.intake.x, LEVEL.intake.y, LEVEL.intake.z);
        model.scale.setScalar(.72);
      } else if (item.location === "field") {
        model.scale.setScalar(1);
      }
      model.visible = item.location === "basket";
    }
  }
  if (world.sprayer) world.sprayer.visible = !state.sprayer;
  if (world.toolRoom?.userData.doorPivot) world.toolRoom.userData.doorPivot.rotation.y = state.toolRoomOpen === false ? 0 : -Math.PI / 2;
}
