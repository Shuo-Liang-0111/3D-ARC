import { PARCEL_META, PARCEL_TYPES } from "./levels/rf03/level.js";

export { PARCEL_META, PARCEL_TYPES };
export const SORTING = Object.freeze({
  revision: "rf01-sorting-v1",
  conveyor: Object.freeze({ minX: -1.8, maxX: 1.8, z: -5.5, speed: .42, beltHeight: .9875 }),
  bins: Object.freeze(Object.fromEntries(PARCEL_TYPES.map((type, index) => [type,
    Object.freeze({ x: -3.55 + index * 1.5, z: -2.6, yaw: Math.PI, floor: .35 })]))),
  placements: Object.freeze([
    { id: "sorting-infeed", asset: "automaticInfeed", position: [-3.25, .04, -5.5], size: [2.5, 2.04, 1.8] },
    { id: "sorting-belt-west", asset: "beltConveyor", position: [-1, .04, -5.5], size: [2, 1.02, 1.1] },
    { id: "sorting-belt-east", asset: "beltConveyor", position: [1, .04, -5.5], size: [2, 1.02, 1.1] },
    { id: "sorting-scanner", asset: "dwsGantry", position: [-1, .04, -5.5], size: [1.32, 2.85, 1.78] },
  ]),
});

export const SORTING_COLLIDERS = Object.freeze([
  { id: "sorting-infeed", minX: -4.5, maxX: -2, minZ: -6.4, maxZ: -4.6 },
  { id: "sorting-conveyor", minX: -2, maxX: 2, minZ: -6.05, maxZ: -4.95 },
  { id: "sorting-scanner-south-foot", minX: -1.66, maxX: -.34, minZ: -4.74, maxZ: -4.61 },
  { id: "sorting-scanner-north-foot", minX: -1.66, maxX: -.34, minZ: -6.39, maxZ: -6.26 },
  ...PARCEL_TYPES.map(type => ({ id: "sorting-cage-" + type,
    minX: SORTING.bins[type].x - .56, maxX: SORTING.bins[type].x + .56,
    minZ: SORTING.bins[type].z - .41, maxZ: SORTING.bins[type].z + .41 })),
]);

export function conveyorPosition(type, phase) {
  const { minX, maxX, z } = SORTING.conveyor;
  const length = maxX - minX;
  return { x: minX + (PARCEL_TYPES.indexOf(type) * length / 3 + phase) % length, z };
}

export function parcelCollider(parcel) {
  const [width, , depth] = PARCEL_META[parcel.type].dimensions;
  return { id: "parcel-" + parcel.type, minX: parcel.x - width / 2, maxX: parcel.x + width / 2,
    minZ: parcel.z - depth / 2, maxZ: parcel.z + depth / 2 };
}
