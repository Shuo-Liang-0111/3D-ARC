import { WORKSHOP } from "./rf01-shared-level.js";

export function hasWorkshopDoorPower(levelId, state) {
  return !["rf01-2", "rf01-3"].includes(levelId) || state.powered;
}

// Only parcels inside the workshop depend on room lighting.
// Carried parcels are rendered separately by the robot cargo layer.
export function isWorkshopParcelVisible(state, parcel) {
  if (parcel.location === "carried") return false;
  if (parcel.location === "conveyor" && parcel.onBelt === false) return false;
  const inside = parcel.x > WORKSHOP.inside.minX && parcel.x < WORKSHOP.inside.maxX
    && parcel.z > WORKSHOP.inside.minZ && parcel.z < WORKSHOP.inside.maxZ;
  return state.lightsOn || !inside;
}
