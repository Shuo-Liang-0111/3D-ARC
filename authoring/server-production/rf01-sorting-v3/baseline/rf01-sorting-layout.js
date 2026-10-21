import { PARCEL_META, PARCEL_TYPES } from "./levels/rf03/level.js";

export { PARCEL_META, PARCEL_TYPES };
export const SORTING = Object.freeze({
  revision: "rf01-sorting-v2",
  lineScale: .8,
  cageScale: .85,
  conveyor: Object.freeze({ minX: -1.3, maxX: 1.3, z: -5.5, speed: .7, beltHeight: .798 }),
  bins: Object.freeze(Object.fromEntries(PARCEL_TYPES.map((type, index) => [type,
    Object.freeze({ x: -3.55 + index * 1.5, z: -2.45, yaw: -Math.PI / 2, floor: .3035 })]))),
  placements: Object.freeze([
    { id: "sorting-infeed", asset: "automaticInfeed", position: [-2.6, .04, -5.5], size: [2, 1.632, 1.44] },
    { id: "sorting-belt-west", asset: "beltConveyor", position: [-.8, .04, -5.5], size: [1.6, .816, .88] },
    { id: "sorting-belt-east", asset: "beltConveyor", position: [.8, .04, -5.5], size: [1.6, .816, .88] },
    { id: "sorting-scanner", asset: "dwsGantry", position: [-.8, .04, -5.5], size: [1.056, 2.28, 1.424] },
  ]),
});

export const SORTING_COLLIDERS = Object.freeze([
  { id: "sorting-infeed", minX: -3.6, maxX: -1.6, minZ: -6.22, maxZ: -4.78 },
  { id: "sorting-conveyor", minX: -1.6, maxX: 1.6, minZ: -5.94, maxZ: -5.06 },
  { id: "sorting-scanner-south-foot", minX: -1.328, maxX: -.272, minZ: -4.892, maxZ: -4.788 },
  { id: "sorting-scanner-north-foot", minX: -1.328, maxX: -.272, minZ: -6.212, maxZ: -6.108 },
  ...PARCEL_TYPES.map(type => ({ id: "sorting-cage-" + type,
    minX: SORTING.bins[type].x - .41 * SORTING.cageScale, maxX: SORTING.bins[type].x + .41 * SORTING.cageScale,
    minZ: SORTING.bins[type].z - .56 * SORTING.cageScale, maxZ: SORTING.bins[type].z + .56 * SORTING.cageScale })),
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
