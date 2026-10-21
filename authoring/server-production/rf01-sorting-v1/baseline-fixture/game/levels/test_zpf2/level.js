import { G1_LOCOMOTION } from "../../g1-locomotion.js";

// test_zpf2 — a small private office rebuilt from reference photos.
// Meter-space layout (x east, z south, y up). The room is 4.1 m wide (x) and
// 4.4 m deep (z); a 1.2 m vestibule lies beyond the south door.
//
//   north wall (z = -2.2): grey cabinet · pedestal + T-800 bust · trash bin · desk + monitor + red chair
//   west wall  (x = -2.05): glass partition to the corridor, mobile whiteboard in front of it
//   east wall  (x = +2.05): floor-to-ceiling window with roller blinds, portable AC, folding cot
//   south wall (z = +2.2): entrance door (west half), cartons + white storage cubes (east half)

export const ROOM = Object.freeze({
  minX: -2.05,
  maxX: 2.05,
  minZ: -2.2,
  maxZ: 2.2,
  height: 2.75,
  vestibuleMaxZ: 3.4,
});

export const DOOR = Object.freeze({
  hingeX: -1.1,
  width: 0.9,
  height: 2.08,
  z: 2.2,
  openAngle: -1.75,
});

export const FIXTURES = Object.freeze({
  cabinet: Object.freeze({ x: -1.62, z: -1.985, width: 0.8, depth: 0.43, height: 1.25 }),
  pedestal: Object.freeze({ x: -1.82, z: -1.405, width: 0.4, depth: 0.51, height: 0.6 }),
  trashBin: Object.freeze({ x: -0.98, z: -2.02, radius: 0.14, height: 0.3 }),
  desk: Object.freeze({ x: 0.5, z: -1.2, width: 2.4, depth: 0.7, height: 0.74 }),
  monitor: Object.freeze({ x: 0.35, z: -1.3 }),
  executiveChair: Object.freeze({ x: 0.5, z: -1.9, yaw: 0 }),
  visitorChairs: Object.freeze([
    Object.freeze({ id: "visitor-chair-west", x: -0.3, z: -0.5, yaw: Math.PI }),
    Object.freeze({ id: "visitor-chair-east", x: 0.85, z: -0.5, yaw: Math.PI }),
  ]),
  whiteboard: Object.freeze({ x: -1.68, z: -0.35, width: 1.2, height: 0.9, bottom: 0.9 }),
  airConditioner: Object.freeze({ x: 1.62, z: -0.55, width: 0.42, depth: 0.38, height: 0.72 }),
  cot: Object.freeze({ x: 1.72, z: 0.75, length: 1.9, width: 0.64, height: 0.42 }),
  storageCubes: Object.freeze({ minX: 1.15, maxX: 2.05, minZ: 1.75, maxZ: 2.2, size: 0.45 }),
  monitorCartons: Object.freeze({ x: 1.03, z: 1.5, width: 0.72, height: 0.15, depth: 0.45 }),
  cartonTall: Object.freeze({ x: 0.75, z: 1.98, width: 0.5, height: 0.95, depth: 0.42 }),
  cartonOpen: Object.freeze({ x: 1.375, y: 0.45, z: 1.975, width: 0.5, height: 0.42, depth: 0.44 }),
});

export const LEVEL = Object.freeze({
  id: "test_zpf2",
  title: "Small Office Survey",
  bounds: Object.freeze({ minX: ROOM.minX, maxX: ROOM.maxX, minZ: ROOM.minZ, maxZ: 3.3 }),
  playerStart: Object.freeze({ x: -0.35, z: 1.35, yaw: Math.PI }),
  playerRadius: 0.28,
  interactionRange: 1.25,
  ...G1_LOCOMOTION,
  whiteboard: Object.freeze({ x: -1.5, z: -0.35 }),
  workstation: Object.freeze({ x: 0.35, z: -0.8 }),
  airConditioner: Object.freeze({ x: 1.62, z: -0.42 }),
  door: Object.freeze({ x: -0.65, z: 2.05 }),
  exit: Object.freeze({ x: -0.65, z: 2.85, radius: 0.42 }),
  checklist: Object.freeze(["whiteboard", "workstation", "aircon"]),
  progress: Object.freeze({
    initial: 60,
    maximum: 100,
    movementDrainPerSecond: 2,
    rewards: Object.freeze({
      whiteboard_reviewed: 8,
      workstation_checked: 8,
      aircon_started: 12,
      door_opened: 12,
    }),
  }),
  staticColliders: Object.freeze([
    { id: "south-wall-west", minX: -2.05, maxX: -1.1, minZ: 2.12, maxZ: 2.28 },
    { id: "south-wall-east", minX: -0.2, maxX: 2.05, minZ: 2.12, maxZ: 2.28 },
    { id: "cabinet", minX: -2.02, maxX: -1.22, minZ: -2.2, maxZ: -1.77 },
    { id: "pedestal", minX: -2.02, maxX: -1.62, minZ: -1.66, maxZ: -1.15 },
    { id: "trash-bin", minX: -1.12, maxX: -0.84, minZ: -2.16, maxZ: -1.88 },
    { id: "desk", minX: -0.7, maxX: 1.7, minZ: -1.55, maxZ: -0.85 },
    { id: "executive-chair", minX: 0.2, maxX: 0.8, minZ: -2.2, maxZ: -1.6 },
    { id: "visitor-chair-west", minX: -0.58, maxX: -0.02, minZ: -0.78, maxZ: -0.22 },
    { id: "visitor-chair-east", minX: 0.57, maxX: 1.13, minZ: -0.78, maxZ: -0.22 },
    { id: "whiteboard", minX: -2.05, maxX: -1.42, minZ: -1.0, maxZ: 0.3 },
    { id: "air-conditioner", minX: 1.41, maxX: 1.83, minZ: -0.75, maxZ: -0.35 },
    { id: "folding-cot", minX: 1.4, maxX: 2.05, minZ: -0.2, maxZ: 1.7 },
    { id: "storage-cubes", minX: 1.15, maxX: 2.05, minZ: 1.75, maxZ: 2.2 },
    { id: "monitor-cartons", minX: 0.66, maxX: 1.4, minZ: 1.26, maxZ: 1.74 },
    { id: "carton-tall", minX: 0.5, maxX: 1.0, minZ: 1.76, maxZ: 2.2 },
  ]),
});

// Closed leaf sits in the wall line; the open leaf swings outward into the vestibule.
export const DOOR_COLLIDER = Object.freeze({
  id: "office-door",
  minX: DOOR.hingeX,
  maxX: DOOR.hingeX + DOOR.width,
  minZ: 2.12,
  maxZ: 2.28,
});

export const OPEN_DOOR_COLLIDER = Object.freeze({
  id: "office-door-open",
  minX: DOOR.hingeX - 0.06,
  maxX: DOOR.hingeX + 0.08,
  minZ: 2.2,
  maxZ: 3.1,
});
