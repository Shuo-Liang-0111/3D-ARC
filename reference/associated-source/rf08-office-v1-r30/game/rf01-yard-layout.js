export const RF01_YARD_LAYOUT = Object.freeze({
  revision: "rf01-shared-v3",
  powerSlot: Object.freeze({ x: 6.15, z: .4 }),
  cabinet: Object.freeze([6.05, .05, -2.42]),
  pump: Object.freeze([7.05, .05, -1.55]),
  manifold: Object.freeze([7.75, .05, -2.1]),
  crates: Object.freeze([
    Object.freeze([-3.55, .04, -4.8, .05]),
    Object.freeze([-3.55, .04, -3.3, -.08]),
  ]),
  hedges: Object.freeze([
    Object.freeze([-7.8, 0, -2.2]),
    Object.freeze([-6.2, 0, -2.2]),
  ]),
});
export const RF01_YARD_COLLIDERS = Object.freeze([
  Object.freeze({ id: "power-slot", minX: 5.40, maxX: 6.90, minZ: -.14, maxZ: .94 }),
  Object.freeze({ id: "west-hedges", minX: -8.60, maxX: -5.40, minZ: -2.575, maxZ: -1.825 }),
]);
export const RF01_CRATE_COLLIDERS = Object.freeze([
  Object.freeze({ id: "workshop-crate-left", minX: -3.975, maxX: -3.125, minZ: -5.1, maxZ: -4.5 }),
  Object.freeze({ id: "workshop-crate-right", minX: -3.975, maxX: -3.125, minZ: -3.6, maxZ: -3.0 }),
]);
