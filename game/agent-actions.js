export const EXTERNAL_AGENT_ACTIONS = Object.freeze([
  "W", "A", "S", "D", "E", "WAIT", "TURN_LEFT", "TURN_RIGHT",
]);

export const EXTERNAL_AGENT_ACTION_DESCRIPTIONS = Object.freeze({
  W: "Move forward relative to the robot's heading; does not turn.",
  A: "Strafe left relative to the robot's heading; does not turn.",
  S: "Move backward relative to the robot's heading; does not turn.",
  D: "Strafe right relative to the robot's heading; does not turn.",
  E: "Interact once: pick up, place, operate, or close the visible terminal. This API action is equivalent to the human F key, not the human E turn key.",
  WAIT: "Wait without issuing movement or interaction.",
  TURN_LEFT: "Turn the robot left in place (human Q key); does not consume movement reserve.",
  TURN_RIGHT: "Turn the robot right in place (human E key); does not consume movement reserve.",
});

const MOVEMENT_INPUTS = Object.freeze({
  W: Object.freeze({ move: 1, strafe: 0, turn: 0 }),
  A: Object.freeze({ move: 0, strafe: 1, turn: 0 }),
  S: Object.freeze({ move: -1, strafe: 0, turn: 0 }),
  D: Object.freeze({ move: 0, strafe: -1, turn: 0 }),
  TURN_LEFT: Object.freeze({ move: 0, strafe: 0, turn: 1, drain: false }),
  TURN_RIGHT: Object.freeze({ move: 0, strafe: 0, turn: -1, drain: false }),
});

export function externalAgentMovementInput(action) {
  const input = MOVEMENT_INPUTS[action];
  return input ? { ...input } : null;
}
