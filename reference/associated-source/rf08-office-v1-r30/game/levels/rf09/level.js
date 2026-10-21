import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const DEVICE_TYPES = Object.freeze(["adapter", "clicker"]);

export const DEVICE_META = Object.freeze({
  adapter: Object.freeze({ name: "USB-C 视频转接器", shortName: "转接器", color: 0xd8d9d4 }),
  clicker: Object.freeze({ name: "无线演示器", shortName: "演示器", color: 0x272b2c }),
});

export const LEVEL = Object.freeze({
  id: "rf09",
  title: "Executive Meeting Setup",
  bounds: Object.freeze({ minX: -13, maxX: 13, minZ: -9, maxZ: 9 }),
  playerStart: Object.freeze({ x: -4.5, z: 7.4, yaw: Math.PI }),
  playerRadius: 0.34,
  interactionRange: 1.75,
  ...G1_LOCOMOTION,
  requiredOrder: Object.freeze(["adapter", "clicker"]),
  devices: Object.freeze({
    adapter: Object.freeze({ x: -9.65, z: 4.45 }),
    clicker: Object.freeze({ x: 8.85, z: 3.85 }),
  }),
  podium: Object.freeze({ x: 0, z: -3.1, assetX: 0, assetZ: -6.0 }),
  terminal: Object.freeze({ x: 2.1, z: -3.1, assetX: 2.1, assetZ: -6.25 }),
  progress: Object.freeze({
    initial: 100,
    maximum: 100,
    actionDrainPerSecond: 1.2,
    interactionCost: 4,
    pickupReward: 10,
    installReward: 14,
    presentationReward: 20,
  }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -13.25, maxX: 13.25, minZ: -9.25, maxZ: -8.95 },
    { id: "south-wall-west", minX: -13.25, maxX: -2.3, minZ: 8.95, maxZ: 9.25 },
    { id: "south-wall-east", minX: 2.3, maxX: 13.25, minZ: 8.95, maxZ: 9.25 },
    { id: "west-wall", minX: -13.25, maxX: -12.95, minZ: -9.25, maxZ: 9.25 },
    { id: "east-wall", minX: 12.95, maxX: 13.25, minZ: -9.25, maxZ: 9.25 },
    { id: "conference-glass-west", minX: -13, maxX: -2.3, minZ: -2.25, maxZ: -1.95 },
    { id: "conference-glass-east", minX: 2.3, maxX: 13, minZ: -2.25, maxZ: -1.95 },
    { id: "conference-table", minX: -4.4, maxX: 4.4, minZ: -6.55, maxZ: -3.75 },
    { id: "supply-cabinet", minX: -11.75, maxX: -8.65, minZ: 5.05, maxZ: 6.35 },
    { id: "it-locker", minX: 7.75, maxX: 10.75, minZ: 4.55, maxZ: 6.0 },
    { id: "reception-desk", minX: -2.7, maxX: 2.7, minZ: 6.0, maxZ: 6.9 },
    { id: "cubicle-west-1", minX: -11.1, maxX: -7.0, minZ: 0.7, maxZ: 2.4 },
    { id: "cubicle-west-2", minX: -5.8, maxX: -2.2, minZ: 0.7, maxZ: 2.4 },
    { id: "cubicle-east-1", minX: 2.2, maxX: 5.8, minZ: 0.7, maxZ: 2.4 },
    { id: "cubicle-east-2", minX: 7.0, maxX: 11.1, minZ: 0.7, maxZ: 2.4 },
    { id: "lounge-west", minX: -11.4, maxX: -8.0, minZ: -1.45, maxZ: -0.35 },
    { id: "lounge-east", minX: 8.0, maxX: 11.4, minZ: -1.45, maxZ: -0.35 },
  ]),
});
