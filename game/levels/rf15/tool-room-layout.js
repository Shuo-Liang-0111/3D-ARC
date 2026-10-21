export const TOOL_ROOM = Object.freeze({
  revision: "tool-room-v1",
  hinge: { x: -4.85, z: -9.98 },
  width: 1.7,
  door: { x: -3.28, z: -9.9 },
  harvest: { x: -5.9, y: 1.04, z: -12.9 },
  trowel: { x: -5.0, y: 1.04, z: -12.9 },
  sprayer: { x: -2.1, y: 1.04, z: -12.9 },
});
const rect = (id, minX, maxX, minZ, maxZ) => ({ id, minX, maxX, minZ, maxZ });
export const TOOL_ROOM_WALLS = [
  rect("tool-west", -7.1, -6.9, -14.1, -10),
  rect("tool-east", -1.1, -.9, -14.1, -10),
  rect("tool-back", -7, -1, -14.1, -13.9),
  rect("tool-front-left", -7, -4.85, -10.1, -9.9),
  rect("tool-front-right", -3.15, -1, -10.1, -9.9),
  rect("tool-bench", -6.55, -1.45, -13.65, -12.65),
];
export function toolDoorCollider(state) {
  const angle = state.toolDoorAngle || 0;
  const { x, z } = TOOL_ROOM.hinge;
  const endX = x + Math.cos(angle) * TOOL_ROOM.width;
  const endZ = z - Math.sin(angle) * TOOL_ROOM.width;
  return rect("tool-door", Math.min(x, endX) - .065, Math.max(x, endX) + .065, Math.min(z, endZ) - .065, Math.max(z, endZ) + .065);
}
export function toolRoomInteraction(state) {
  if (state.complete || state.failed) return null;
  const distance = point => Math.hypot(state.player.x - point.x, state.player.z - point.z);
  const inside = state.player.x > -6.8 && state.player.x < -1.2 && state.player.z < -10.6 && state.player.z > -13.8;
  if (inside && !state.carriedItem && Math.abs((state.toolDoorAngle || 0) + Math.PI / 2) < .02) {
    if (distance(TOOL_ROOM.harvest) < 1.15) return { type: state.heldTool === "harvest-knife" ? "return-tool" : "take-tool", tool: "harvest-knife", label: state.heldTool === "harvest-knife" ? "放回收割刀" : "拿起收割刀" };
    if (distance(TOOL_ROOM.trowel) < 1.15) return { type: state.heldTool === "hand-trowel" ? "return-tool" : "take-tool", tool: "hand-trowel", label: state.heldTool === "hand-trowel" ? "放回手铲" : "拿起手铲" };
    if (!state.sprayer && distance(TOOL_ROOM.sprayer) < 1.15) return { type: "take-sprayer", label: "拿起农药喷剂" };
  }
  if (distance(TOOL_ROOM.door) < 1.65 && state.player.z > -11.3) {
    if (state.toolRoomOpen) return { type: "close-tool-room", label: "关闭工具房门" };
    return { type: "open-tool-room", label: "打开工具房门" };
  }
  return null;
}
export function doorSweepBlocked(state, radius) {
  const { x, z } = state.player;
  return x + radius > -4.98 && x - radius < -3.02 && z + radius > -10.12 && z - radius < -8.15;
}

export function advanceToolRoom(state, dt) {
  if (state.complete || state.failed) return state;
  const target = state.toolRoomOpen ? -Math.PI / 2 : 0;
  const current = state.toolDoorAngle || 0;
  const difference = target - current;
  if (Math.abs(difference) < .000001) return state;
  return { ...state, toolDoorAngle: current + Math.sign(difference) * Math.min(Math.abs(difference), Math.max(0, Math.min(.05, dt)) * 1.8) };
}
