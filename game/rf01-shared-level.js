import { RF01_YARD_LAYOUT, RF01_CRATE_COLLIDERS } from "./rf01-yard-layout.js";
import { LEVEL as PARK } from "./level.js";
import { RF01_COLLISION_PROXY_RECTS } from "./rf01-collision-proxies.js";
import { SORTING, SORTING_COLLIDERS } from "./rf01-sorting-layout.js";

export const WORKSHOP = Object.freeze({
  doorway: { minX: -.38, maxX: 3.73, minZ: -1.85, maxZ: -1.12 },
  height: 2.36,
  clearance: 2.1,
  openingSeconds: 3,
  holdSeconds: 10,
  innerDoorControl: { x: 4.05, y: 1.2, z: -1.53 },
  doorControl: { x: -.68, y: 1.2, z: -1.08 },
  lightSwitch: { x: 3.8, y: 1.2, z: -6.38 },
  inside: { minX: -4.5, maxX: 4.5, minZ: -6.3, maxZ: -2.1 },
  lampPositions: [[-3.2, 3.68, -4.3], [0, 3.68, -4.3], [3.2, 3.68, -4.3]],
});

export const SHARED_LEVEL = Object.freeze({
  ...PARK,
  id: "rf01",
  revision: SORTING.revision,
  title: "工业园区",
  interactionRange: 1.6,
  staticColliders: Object.freeze([
    ...SORTING_COLLIDERS,
    ...PARK.staticColliders.filter(({ id }) => !["workshop", "fire-safety-station"].includes(id)),
    ...RF01_COLLISION_PROXY_RECTS.filter(({ id }) => !id.startsWith("workshop-front-") && id !== "workshop-interior"),
    { id: "workshop-front-left", minX: -5.07, maxX: -.38, minZ: -1.85, maxZ: -1.08 },
    { id: "workshop-front-right", minX: 3.73, maxX: 5.07, minZ: -1.85, maxZ: -1.08 },
    { id: "workshop-inner-west", minX: -4.65, maxX: -4.55, minZ: -6.55, maxZ: -1.9 },
    { id: "workshop-inner-east", minX: 4.55, maxX: 4.65, minZ: -6.55, maxZ: -1.9 },
    { id: "workshop-inner-back", minX: -4.65, maxX: 4.65, minZ: -6.55, maxZ: -6.45 },
  ]),
  progress: Object.freeze({ initial: 100, maximum: 100, perMeter: 1.0, blockedPerSecond: 2, error: 5, reward: 3 }),
});

export const DISPATCH = Object.freeze({
  bays: Object.freeze([{ x: 3.25, z: 2.75 }, { x: 3.25, z: 4.05 }]),
});
export const DYNAMIC_DEVICE = Object.freeze({
  trackMinX: -2.2, trackMaxX: 2.6, trackZ: -4.2,
  trolleyHalfWidth: .62, trolleyHalfDepth: .38,
  control: Object.freeze({ x: -3.05, z: -4.2 }),
  lock: Object.freeze({ x: 3.18, z: -4.2 }),
  arm: Object.freeze({ minX: 2.0, maxX: 2.68, minZ: -4.72, maxZ: -3.68 }),
  speed: .58, stopDuration: .7, armDuration: .8,
});
export function levelFor(id) {
  const objectives = {
    rf01: "恢复园区供电，打开园区大门并抵达出口",
    "rf01-2": "进入厂房并开启照明",
    "rf01-3": "完成三件快递的正确分拣",
  };
  if (!Object.hasOwn(objectives, id)) throw new RangeError(`Unknown RF-01 level: ${id}`);
  return Object.freeze({ ...SHARED_LEVEL, id, title: objectives[id] });
}
