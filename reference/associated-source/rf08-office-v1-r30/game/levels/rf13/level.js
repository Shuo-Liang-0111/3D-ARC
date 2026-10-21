import { G1_LOCOMOTION } from "../../g1-locomotion.js";
import { LEVEL as SHARED_LEVEL } from "../../level.js";

export const REVISION = "cardinal-v0.3";
export const STATIONS = [
  { id: "exam-a", name: "诊室一", item: "gloves", x: -2.05, z: -4.2 },
  { id: "exam-b", name: "诊室二", item: "gauze", x: 1.45, z: -4.2 },
  { id: "treatment", name: "处置室", item: "dressings", x: 4.95, z: -4.2 },
  { id: "front-desk", name: "前台", item: "forms", x: 5.0, z: 2.5 },
];
export const SUPPLIES = [
  { id: "gloves", name: "手套补给盒", color: "#739d9f", x: -6.35, z: -4.1 },
  { id: "gauze", name: "纱布补给盒", color: "#a59a7c", x: -6.35, z: -3.3 },
  { id: "dressings", name: "敷料补给盒", color: "#8396ae", x: -6.35, z: -2.5 },
  { id: "forms", name: "前台用品盒", color: "#aa8999", x: -6.35, z: -1.7 },
];
export const PREPARATIONS = [
  { id: "chair", name: "归正候诊椅", x: -3.7, z: 3.25, destination: { x: -4.65, z: 3.25 }, size: [0.6, 0.9, 0.65] },
  { id: "trolley", name: "将通道推车移到停放区", x: 0.8, z: 1.0, destination: { x: 2.65, z: 1.0 }, size: [0.65, 0.9, 0.55] },
];
export const STATIC_BOXES = [];
function block(id, size, position, color, category = "fixture") {
  STATIC_BOXES.push({ id, size, position, color, category });
}
block("floor", [14, 0.12, 10], [0, -0.06, 0], "#bfc6c2", "floor");
block("north-wall", [14, 2.8, 0.16], [0, 1.4, -5], "#e1e6e2", "wall");
block("west-wall", [0.16, 2.8, 10], [-7, 1.4, 0], "#e1e6e2", "wall");
block("east-wall", [0.16, 2.8, 10], [7, 1.4, 0], "#e1e6e2", "wall");
block("south-west", [5.8, 2.8, 0.16], [-4.1, 1.4, 5], "#e1e6e2", "wall");
block("south-east", [5.8, 2.8, 0.16], [4.1, 1.4, 5], "#e1e6e2", "wall");
block("entry-lintel", [2.4, 0.5, 0.16], [0, 2.55, 5], "#e1e6e2", "lintel");
for (const divider of [-3.5, 0, 3.5]) block(`partition-${divider}`, [0.12, 2.8, 4], [divider, 1.4, -3], "#d3dbd5", "wall");
for (const center of [-5.25, -1.75, 1.75, 5.25]) {
  block(`door-left-${center}`, [1.05, 2.8, 0.12], [center - 1.225, 1.4, -1], "#d3dbd5", "wall");
  block(`door-right-${center}`, [1.05, 2.8, 0.12], [center + 1.225, 1.4, -1], "#d3dbd5", "wall");
  block(`door-lintel-${center}`, [1.4, 0.6, 0.12], [center, 2.5, -1], "#d3dbd5", "lintel");
}
block("supply-shelf", [0.65, 0.9, 3.4], [-6.35, 0.45, -2.9], "#99aaa5");
for (const station of STATIONS) {
  block(`counter-${station.id}`, [1.8, 0.9, 0.72], [station.x, 0.45, station.z], "#98aaa7");
}
for (const center of [-1.75, 1.75]) block(`exam-bed-${center}`, [0.75, 0.65, 1.9], [center + 1.22, 0.325, -2.55], "#a9b7b2");
block("return-counter", [2.5, 0.9, 0.7], [-5.35, 0.45, 0.9], "#b1a797");
block("terminal-pedestal", [0.5, 0.9, 0.5], [3.5, 0.45, 2.5], "#98aaa7");
for (const center of [-5.5, -4.65]) {
  if (center === -4.65) continue;
  block(`waiting-seat-${center}`, [0.6, 0.9, 0.65], [center, 0.45, 3.25], "#8da9a2");
}
export const LEVEL = Object.freeze({
  id: "rf13", title: "Community Clinic Opening", revision: REVISION,
  bounds: { minX: -7, maxX: 7, minZ: -5, maxZ: 5 },
  playerStart: { x: 0, z: 4.1, yaw: Math.PI },
  playerRadius: SHARED_LEVEL.playerRadius,
  playerForwardOffset: SHARED_LEVEL.playerForwardOffset,
  interactionRange: 1.05, ...G1_LOCOMOTION,
  terminal: { x: 3.5, y: 0.95, z: 2.5 },
  returns: { x: -5.35, y: 0.9, z: 0.9 },
  progress: { initial: 100, maximum: 100, actionDrainPerSecond: 0.04, interactionCost: 1, reward: 4 },
});
export function boundsFor(box) {
  return { id: box.id, minX: box.position[0] - box.size[0] / 2, maxX: box.position[0] + box.size[0] / 2, minZ: box.position[2] - box.size[2] / 2, maxZ: box.position[2] + box.size[2] / 2 };
}
export const STATIC_COLLIDERS = STATIC_BOXES.filter(box => !["floor", "lintel"].includes(box.category)).map(boundsFor);
export const WALL_COLLIDERS = STATIC_BOXES.filter(box => box.category === "wall").map(boundsFor);
