import { LEVEL as BASE, STRUCTURES, STATIC_COLLIDERS } from "../rf15/level.js";
import { FIELD, FIELD_REVISION, SHARED_PRODUCE } from "../rf15/field-layout.js";
export const REVISION = FIELD_REVISION;
export const PRODUCE = SHARED_PRODUCE;
export const LEVEL = Object.freeze({ ...BASE, revision: FIELD_REVISION, variant: "rf15-2", id: "rf15-2", objective: "田间收割入筐", bounds: { ...BASE.bounds, maxX: 16.2, minZ: -15.2 }, intake: FIELD.basket, tool: { x: -2.1, y: 1.04, z: -12.9 }, progress: { ...BASE.progress, movementPerMeter: .35, errorCost: 5, milestoneReward: 1 } });
export { STRUCTURES, STATIC_COLLIDERS };
