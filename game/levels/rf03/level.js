import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const PARCEL_TYPES = Object.freeze(["red", "yellow", "blue"]);

export const PARCEL_META = Object.freeze({
  red: Object.freeze({ code: "A-01", name: "红色", color: 0xc9473d, dimensions: Object.freeze([0.52, 0.32, 0.38]) }),
  yellow: Object.freeze({ code: "B-02", name: "黄色", color: 0xe2b83f, dimensions: Object.freeze([0.44, 0.26, 0.32]) }),
  blue: Object.freeze({ code: "C-03", name: "蓝色", color: 0x3b82c4, dimensions: Object.freeze([0.58, 0.38, 0.42]) }),
});

export const LEVEL = Object.freeze({
  id: "rf03",
  title: "Chinese Parcel Sorting Hub",
  bounds: Object.freeze({ minX: -12.6, maxX: 12.6, minZ: -7.6, maxZ: 7.6 }),
  playerStart: Object.freeze({ x: 2.5, z: 6.35, yaw: Math.PI }),
  playerRadius: 0.42,
  interactionRange: 2.2,
  ...G1_LOCOMOTION,
  terminal: Object.freeze({ x: -10.25, z: 5.55, modelX: -10.25, modelZ: 5.55 }),
  conveyor: Object.freeze({
    minX: -8.9,
    maxX: 8.6,
    z: -1.25,
    speed: 1.15,
    width: 1.0,
    beltHeight: 0.82,
    rollerRadius: 0.08,
    infeedX: -10.35,
  }),
  parcels: Object.freeze({
    red: Object.freeze({ phase: 0, laneZ: 0 }),
    yellow: Object.freeze({ phase: 5.7, laneZ: 0 }),
    blue: Object.freeze({ phase: 11.4, laneZ: 0 }),
  }),
  bins: Object.freeze({
    red: Object.freeze({ x: -5.4, z: 3.75, modelX: -5.4, modelZ: 4.95 }),
    yellow: Object.freeze({ x: 0, z: 3.75, modelX: 0, modelZ: 4.95 }),
    blue: Object.freeze({ x: 5.4, z: 3.75, modelX: 5.4, modelZ: 4.95 }),
  }),
  progress: Object.freeze({
    initial: 100,
    maximum: 100,
    actionDrainPerSecond: 1.5,
    interactionCost: 5,
    correctDeliveryReward: 15,
  }),
  staticColliders: Object.freeze([
    { id: "automatic-infeed-machine", minX: -11.75, maxX: -9.35, minZ: -2.25, maxZ: -0.25 },
    { id: "main-conveyor", minX: -9.55, maxX: 9.55, minZ: -1.82, maxZ: -0.68 },
    { id: "north-chute-a", minX: -5.05, maxX: -4.15, minZ: -4.6, maxZ: -1.72 },
    { id: "north-chute-b", minX: -0.45, maxX: 0.45, minZ: -4.6, maxZ: -1.72 },
    { id: "north-chute-c", minX: 4.15, maxX: 5.05, minZ: -4.6, maxZ: -1.72 },
    { id: "red-route-cage", minX: -6.02, maxX: -4.78, minZ: 4.42, maxZ: 5.52 },
    { id: "yellow-route-cage", minX: -0.62, maxX: 0.62, minZ: 4.42, maxZ: 5.52 },
    { id: "blue-route-cage", minX: 4.78, maxX: 6.02, minZ: 4.42, maxZ: 5.52 },
    { id: "dws-terminal", minX: -10.72, maxX: -9.78, minZ: 5.15, maxZ: 5.95 },
    { id: "west-electrical-cabinets", minX: -12.25, maxX: -11.25, minZ: -5.7, maxZ: -3.0 },
    { id: "east-pallet-buffer", minX: 9.65, maxX: 11.85, minZ: 3.6, maxZ: 6.55 },
  ]),
});
