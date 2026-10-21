export const FIELD_REVISION = "cardinal-field-v2";
export const FIELD = Object.freeze({
  bounds: { minX: 10.1, maxX: 14.5, minZ: -4.2, maxZ: 1 },
  basket: { x: 10.2, y: 0, z: 2.0 },
  beds: [{ x: 10.85, z: -1.6, width: .42, length: 5.2 }, { x: 13.75, z: -1.6, width: .42, length: 5.2 }],
});
export const FIELD_CROPS = Object.freeze(FIELD.beds.flatMap((bed, row) =>
  [-3.55, -2.25, -.95, .35].map((z, index) => ({
    id: `${row ? "bok-choy" : "lettuce"}-${index + 1}`,
    kind: row ? "bok-choy" : "lettuce", name: row ? "小白菜" : "生菜",
    x: bed.x, y: .14, z, rotation: index * .81 + row * .4,
  }))));
export const FIELD_COLLIDERS = [
  ...FIELD.beds.map((bed, index) => ({ id: `vegetable-bed-${index}`, minX: bed.x - bed.width / 2, maxX: bed.x + bed.width / 2, minZ: -4.2, maxZ: 1 })),
  { id: "harvest-basket", minX: FIELD.basket.x - .34, maxX: FIELD.basket.x + .34, minZ: FIELD.basket.z - .24, maxZ: FIELD.basket.z + .24 },
];
export const SHARED_PRODUCE = Object.freeze([
  { id: "tomato", kind: "lettuce", name: "生菜", code: "L01", weight: 5, x: -7.45, y: 1.18, z: -1.35, collider: "crate-stack" },
  { id: "apple", kind: "bok-choy", name: "小白菜", code: "L02", weight: 5, x: -6.82, y: 1.18, z: -1.35, collider: "crate-stack" },
]);
