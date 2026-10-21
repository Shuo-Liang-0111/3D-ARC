import { PARCEL_META, PARCEL_TYPES } from "./levels/rf03/level.js";

export { PARCEL_META, PARCEL_TYPES };
export const SORTING = Object.freeze({
  revision: "rf01-sorting-v3",
  lineScale: .7,
  cageScale: .85,
  conveyor: Object.freeze({ minX: -1.1, maxX: 1.1, z: -5.5, speed: .7, beltHeight: .7032, pitch: 1.6, cycleLength: 4.8 }),
  bins: Object.freeze(Object.fromEntries(PARCEL_TYPES.map((type, index) => [type,
    Object.freeze({ x: -3.55 + index * 1.5, z: -2.45, yaw: -Math.PI / 2, floor: .3035 })]))),
  placements: Object.freeze([
    { id: "sorting-belt-west", asset: "beltConveyor", position: [-.7, .04, -5.5], size: [1.4, .714, .77] },
    { id: "sorting-belt-east", asset: "beltConveyor", position: [.7, .04, -5.5], size: [1.4, .714, .77] },
    { id: "sorting-scanner", asset: "dwsGantry", position: [-.7, .04, -5.5], size: [.924, 1.995, 1.246] },
  ]),
});

export const SORTING_COLLIDERS = Object.freeze([
  { id: "sorting-conveyor", minX: -1.4, maxX: 1.4, minZ: -5.885, maxZ: -5.115 },
  { id: "sorting-scanner-south-foot", minX: -1.162, maxX: -.238, minZ: -4.968, maxZ: -4.877 },
  { id: "sorting-scanner-north-foot", minX: -1.162, maxX: -.238, minZ: -6.123, maxZ: -6.032 },
  ...PARCEL_TYPES.map(type => ({ id: "sorting-cage-" + type,
    minX: SORTING.bins[type].x - .41 * SORTING.cageScale, maxX: SORTING.bins[type].x + .41 * SORTING.cageScale,
    minZ: SORTING.bins[type].z - .56 * SORTING.cageScale, maxZ: SORTING.bins[type].z + .56 * SORTING.cageScale })),
]);

export function conveyorPosition(type, phase) {
  const { minX, maxX, z, pitch, cycleLength } = SORTING.conveyor;
  const length = maxX - minX;
  const offset = (PARCEL_TYPES.indexOf(type) * pitch + phase) % cycleLength;
  return { x: minX + Math.min(offset, length), z, onBelt: offset <= length };
}

export function parcelCollider(parcel) {
  const [width, , depth] = PARCEL_META[parcel.type].dimensions;
  return { id: "parcel-" + parcel.type, minX: parcel.x - width / 2, maxX: parcel.x + width / 2,
    minZ: parcel.z - depth / 2, maxZ: parcel.z + depth / 2 };
}
