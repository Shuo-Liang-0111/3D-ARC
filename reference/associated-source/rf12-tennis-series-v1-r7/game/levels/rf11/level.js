export const ROBOTS = Object.freeze(["alpha", "beta"]);
export const LEVEL = Object.freeze({
  id: "rf11",
  title: "Cooperative Servo Cell",
  bounds: Object.freeze({ minX: -12, maxX: 12, minZ: -8, maxZ: 8 }),
  playerRadius: 0.42,
  interactionRange: 1.55,
  moveSpeed: 1.55,
  turnSpeed: 1.9,
  playerStart: Object.freeze({ x: -2.6, z: 3.8, yaw: Math.PI / 2 }),
  partnerStart: Object.freeze({ x: 2.6, z: 3.8, yaw: -Math.PI / 2 }),
  cargo: Object.freeze({ x: 0, z: 3.8 }),
  target: Object.freeze({ x: 0, z: -5.15 }),
  safeDoor: Object.freeze({ x: 0, z: -1.0, width: 3.2 }),
  staticColliders: Object.freeze([
    { id: "north-wall", minX: -12.2, maxX: 12.2, minZ: 7.8, maxZ: 8.15 },
    { id: "west-wall", minX: -12.2, maxX: -11.85, minZ: -8.15, maxZ: 8.15 },
    { id: "east-wall", minX: 11.85, maxX: 12.2, minZ: -8.15, maxZ: 8.15 },
    { id: "south-wall-west", minX: -12.2, maxX: -1.7, minZ: -8.15, maxZ: -7.8 },
    { id: "south-wall-east", minX: 1.7, maxX: 12.2, minZ: -8.15, maxZ: -7.8 },
    { id: "west-infeed-machine", minX: -9.8, maxX: -8.0, minZ: -1.6, maxZ: 0.9 },
    { id: "east-control-terminal", minX: 9.3, maxX: 10.0, minZ: -1.85, maxZ: -1.15 },
    { id: "east-control-cabinet", minX: 10.4, maxX: 11.2, minZ: 4.25, maxZ: 5.1 },
    { id: "north-pallet-stack", minX: 8.05, maxX: 9.35, minZ: 5.0, maxZ: 6.1 },
    { id: "north-scanner-gantry-left", minX: 3.72, maxX: 4.04, minZ: 4.5, maxZ: 6.25 },
    { id: "north-scanner-gantry-right", minX: 4.56, maxX: 4.88, minZ: 4.5, maxZ: 6.25 },
    { id: "target-base", minX: -1.7, maxX: 1.7, minZ: -6.05, maxZ: -4.25 },
  ]),
  progress: Object.freeze({ initial: 100, actionDrainPerSecond: 0.9, interactionCost: 3, pickupReward: 18, installReward: 22 }),
});

export const CARGO_META = Object.freeze({ name: "精密伺服泵箱", shortName: "伺服泵箱", color: 0xc6d1cf });
