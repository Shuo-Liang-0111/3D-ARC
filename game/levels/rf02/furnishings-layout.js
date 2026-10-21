export const FURNISHINGS_REVISION = "library-operations-v5";

export const CHAIRS = Object.freeze([
  { id: "west-north", model: "readingChair", x: -5.76, z: 0.40, home: { x: -5.76, z: 1.49, yaw: 0 }, task: true, modelYaw: -Math.PI / 2 },
  { id: "west-north-two", model: "readingChair-2", x: -4.24, z: 1.49, modelYaw: -Math.PI / 2 },
  { id: "west-south", model: "readingChair-3", x: -5.76, z: 3.21, modelYaw: Math.PI / 2 },
  { id: "west-south-two", model: "readingChair-4", x: -4.24, z: 3.21, modelYaw: Math.PI / 2 },
  { id: "east-north-two", model: "readingChair-5", x: 4.64, z: 1.49, modelYaw: -Math.PI / 2 },
  { id: "east-north", model: "readingChair-6", x: 6.16, z: 0.40, home: { x: 6.16, z: 1.49, yaw: 0 }, task: true, modelYaw: -Math.PI / 2 },
  { id: "east-south", model: "readingChair-7", x: 4.64, z: 3.21, modelYaw: Math.PI / 2 },
  { id: "east-south-two", model: "readingChair-8", x: 6.16, z: 3.21, modelYaw: Math.PI / 2 },
].map((chair) => Object.freeze({ halfX: 0.28, halfZ: 0.265, yaw: 0, standOffset: 0.74, handleBack: 0.22, handleY: 0.85, handleHalfWidth: 0.20, ...chair })));

export const CART = Object.freeze({
  id: "return-cart", x: 2.45, z: 4.55, yaw: Math.PI,
  halfX: 0.45, halfZ: 0.30, standOffset: 0.91, pushYawOffset: Math.PI / 2,
  handleBack: 0.40, handleY: 1.095, handleHalfWidth: 0.18,
  parking: Object.freeze({ x: 8.65, z: -3.15, yaw: Math.PI, halfX: 0.90, halfZ: 0.76 }),
});

export function furnitureStand(object, side = 1) {
  const yaw = object.yaw + (object.pushYawOffset ?? 0);
  return {
    x: object.x - Math.sin(yaw) * object.standOffset * side,
    z: object.z - Math.cos(yaw) * object.standOffset * side,
    yaw: yaw + (side < 0 ? Math.PI : 0),
  };
}

export function furnitureRect(object) {
  return { id: object.id, minX: object.x - object.halfX, maxX: object.x + object.halfX, minZ: object.z - object.halfZ, maxZ: object.z + object.halfZ };
}

export const READING_COLLIDERS = Object.freeze([
  { id: "west-reading-zone", minX: -6.20, maxX: -3.80, minZ: 1.825, maxZ: 2.875 },
  { id: "east-reading-zone", minX: 4.20, maxX: 6.60, minZ: 1.825, maxZ: 2.875 },
  ...CHAIRS.map(furnitureRect),
]);
