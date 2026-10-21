import { BOOK_COLORS, LEVEL as BASE_LEVEL } from "./level.js";
import { CART, CHAIRS, FURNISHINGS_REVISION } from "./furnishings-layout.js";

export { CART, CHAIRS };
export const REVISION = FURNISHINGS_REVISION;
export const ASSET_ROOT = "/local-assets/cardinal/rf02/models/runtime/" + REVISION;

export const SHELF_BOOKS = Object.freeze(Object.fromEntries(BOOK_COLORS.map((color) => {
  const black = color === "black";
  return [color, Object.freeze({
    x: black ? -0.70 : color === "red" ? -10.43 : 10.43,
    z: black ? -6.43 : -1.75,
    y: 1.16, rotation: BASE_LEVEL.shelves[color].rotation,
  })];
})));

export function shelfPose(color, id) {
  const source = SHELF_BOOKS[color];
  const shelfIndex = id.startsWith("shelf-") ? Number(id.split("-").at(-1)) || 0 : id === color ? 3 : 4;
  const slot = shelfIndex * 0.36;
  return { x: source.x + (color === "black" ? slot : 0), y: source.y, z: source.z + (color === "black" ? 0 : slot), rotation: source.rotation };
}

export function landingPose(color, index) {
  return color === "black"
    ? { x: -0.75 + index * 0.66, y: 0.012, z: -5.18 }
    : { x: color === "red" ? -9.22 : 9.22, y: 0.012, z: -1.85 + index * 0.60 };
}

export const BOOKS = Object.freeze([
  ...BOOK_COLORS.map((color) => Object.freeze({ id: color, color, ...BASE_LEVEL.books[color], y: color === "black" ? 0.681 : 0.677, support: "return-table", location: "table" })),
  Object.freeze({ id: "red-reading", color: "red", x: -5.82, z: 2.35, y: 0.686, support: "west-reading-zone", location: "table" }),
  Object.freeze({ id: "black-reading", color: "black", x: 6.22, z: 2.35, y: 0.686, support: "east-reading-zone", location: "table" }),
  Object.freeze({ id: "white-cart", color: "white", x: CART.x, z: CART.z, y: 1.01, support: "return-cart", location: "table" }),
  ...BOOK_COLORS.flatMap((color) => [0, 1, 2].map((index) => Object.freeze({
    id: "shelf-" + color + "-" + index, color, ...shelfPose(color, "shelf-" + color + "-" + index),
    landing: landingPose(color, index), support: color + "-target-shelf", location: "shelved", background: true, shelfIndex: index,
  }))),
]);

export function seriesLevel(id) {
  return Object.freeze({
    ...BASE_LEVEL, id, revision: REVISION,
    title: id === "rf02-3" ? "Closing Patrol" : "Closing Reset",
    dynamic: id === "rf02-3", interactionRange: 1.30,
    progress: Object.freeze({
      initial: 100, maximum: 100, movementDrainPerMeter: id === "rf02-3" ? 0.98 : 1.45,
      blockedDrainPerSecond: id === "rf02-3" ? 1.4 : 1, errorCost: id === "rf02-3" ? 5 : 3,
      repeatCost: 1, chairReward: id === "rf02-3" ? 3 : 5, cartReward: id === "rf02-3" ? 5 : 8, pickupReward: 1, correctBookReward: 1,
    }),
    fallDuration: 0.95, fallIntervalMin: 60, fallIntervalMax: 90, maximumFalls: 3,
  });
}
