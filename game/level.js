import { RF01_YARD_LAYOUT, RF01_YARD_COLLIDERS } from "./rf01-yard-layout.js";
import { G1_LOCOMOTION } from "./g1-locomotion.js";

export const LEVEL = Object.freeze({
  id: "rf01",
  title: "Industrial Park Emergency Access",
  // Compact Chinese light-industrial park service yard: 20 x 16 m.
  bounds: Object.freeze({ minX: -9.8, maxX: 9.8, minZ: -7.8, maxZ: 7.8 }),
  playerStart: Object.freeze({ x: 0, z: 4.8, yaw: Math.PI }),
  batteryStart: Object.freeze({ x: -6.8, z: -0.35 }),
  powerSlot: RF01_YARD_LAYOUT.powerSlot,
  terminal: Object.freeze({ x: 5.1, z: 4.25 }),
  door: Object.freeze({ x: 0, z: 6.8 }),
  exit: Object.freeze({ x: 0, z: 7.5, radius: 0.9 }),
  interactionRange: 1.8,
  playerRadius: 0.34,
  playerForwardOffset: 0.18,
  ...G1_LOCOMOTION,
  progress: Object.freeze({
    initial: 100,
    maximum: 100,
    movementDrainPerSecond: 2,
    rewards: Object.freeze({
      battery_collected: 15,
      power_restored: 25,
      door_opened: 20,
    }),
  }),
  staticColliders: Object.freeze([
    ...RF01_YARD_COLLIDERS,
    { id: "workshop", minX: -5.2, maxX: 5.2, minZ: -7, maxZ: -1 },
    { id: "battery-rack", minX: -7.68, maxX: -5.92, minZ: -0.8, maxZ: 0.1 },
    { id: "electrical-compound", minX: 5.02, maxX: 8.18, minZ: -2.82, maxZ: -0.78 },
    { id: "fire-safety-station", minX: 8.55, maxX: 9.05, minZ: -1.6, maxZ: -0.2 },
    { id: "guard-kiosk", minX: 5.45, maxX: 7.55, minZ: 4.1, maxZ: 5.9 },
    { id: "west-fence", minX: -9.88, maxX: -9.72, minZ: -7.76, maxZ: 6.88 },
    { id: "east-fence", minX: 9.72, maxX: 9.88, minZ: -7.76, maxZ: 6.88 },
    { id: "north-fence", minX: -9.88, maxX: 9.88, minZ: -7.76, maxZ: -7.6 },
    { id: "south-fence-west", minX: -9.88, maxX: -2.25, minZ: 6.72, maxZ: 6.88 },
    { id: "south-fence-east", minX: 2.25, maxX: 9.88, minZ: 6.72, maxZ: 6.88 },
    { id: "terminal-pedestal", minX: 4.78, maxX: 5.42, minZ: 3.9, maxZ: 4.6 },
    { id: "gate-bollard-west", minX: -2.62, maxX: -2.28, minZ: 6.62, maxZ: 6.98 },
    { id: "gate-bollard-east", minX: 2.28, maxX: 2.62, minZ: 6.62, maxZ: 6.98 },
  ]),
});

const REPLACED_BY_COLLISION_ASSET = new Set(["workshop", "fire-safety-station"]);
let activeStaticColliders = LEVEL.staticColliders;

export function installRF01CollisionProxies(colliders) {
  if (!Array.isArray(colliders) || colliders.length === 0) return false;
  const normalized = [];
  for (const collider of colliders) {
    if (
      typeof collider?.id !== "string"
      || !Number.isFinite(collider.minX)
      || !Number.isFinite(collider.maxX)
      || !Number.isFinite(collider.minZ)
      || !Number.isFinite(collider.maxZ)
      || collider.minX >= collider.maxX
      || collider.minZ >= collider.maxZ
    ) return false;
    normalized.push(Object.freeze({
      id: collider.id,
      minX: collider.minX,
      maxX: collider.maxX,
      minZ: collider.minZ,
      maxZ: collider.maxZ,
    }));
  }
  activeStaticColliders = Object.freeze([
    ...LEVEL.staticColliders.filter((collider) => !REPLACED_BY_COLLISION_ASSET.has(collider.id)),
    ...normalized,
  ]);
  return true;
}

export function getRF01StaticColliders() { return activeStaticColliders; }


export const DOOR_COLLIDER = Object.freeze({
  id: "sliding-security-gate",
  minX: -2.25,
  maxX: 2.25,
  minZ: 6.72,
  maxZ: 6.88,
});
