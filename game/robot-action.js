export const ROBOT_ACTION_DURATION = 0.8;
export const ROBOT_ACTION_CONTACT_PROGRESS = 0.5;

const EVENT_TO_ACTION = Object.freeze({
  office_bin_picked_up: "pickup",
  office_bin_placed: "place",
  battery_collected: "pickup",
  battery_dropped: "place",
  power_restored: "place",
  crate_collected: "pickup",
  crate_dropped: "place",
  crate_delivered: "place",
  shutter_opening: "operate",
  workshop_lit: "operate",
  workshop_dark: "operate",
  dynamic_stop_requested: "operate",
  dynamic_interlock_locked: "operate",
  door_opened: "operate",
  door_closed: "operate",
  terminal_opened: "operate",
  dispatch_confirmed: "operate",
  item_collected_adapter: "pickup",
  item_collected_clicker: "pickup",
  item_recollected_adapter: "pickup",
  item_recollected_clicker: "pickup",
  item_dropped_adapter: "place",
  item_dropped_clicker: "place",
  device_installed_adapter: "place",
  device_installed_clicker: "place",
});

const EVENT_PROFILES = Object.freeze({
  battery_collected: Object.freeze({ duration: 1.35, contactProgress: 0.52, gesture: "two-hand-lift" }),
  battery_dropped: Object.freeze({ duration: 1.25, contactProgress: 0.58, gesture: "two-hand-place" }),
  power_restored: Object.freeze({ duration: 1.45, contactProgress: 0.6, gesture: "two-hand-install" }),
  crate_collected: Object.freeze({ duration: 1.55, contactProgress: 0.54, gesture: "two-hand-lift" }),
  crate_dropped: Object.freeze({ duration: 1.45, contactProgress: 0.6, gesture: "two-hand-place" }),
  crate_delivered: Object.freeze({ duration: 1.55, contactProgress: 0.62, gesture: "two-hand-place" }),
  shutter_opening: Object.freeze({ duration: 1.05, contactProgress: 0.55, gesture: "right-hand-press" }),
  workshop_lit: Object.freeze({ duration: 0.95, contactProgress: 0.52, gesture: "right-hand-press" }),
  workshop_dark: Object.freeze({ duration: 0.95, contactProgress: 0.52, gesture: "right-hand-press" }),
  dynamic_stop_requested: Object.freeze({ duration: 1.05, contactProgress: 0.55, gesture: "right-hand-press" }),
  dynamic_interlock_locked: Object.freeze({ duration: 1.2, contactProgress: 0.6, gesture: "right-hand-confirm" }),
  door_opened: Object.freeze({ duration: 1.05, contactProgress: 0.55, gesture: "right-hand-press" }),
  door_closed: Object.freeze({ duration: 1.05, contactProgress: 0.55, gesture: "right-hand-press" }),
  terminal_opened: Object.freeze({ duration: 1.05, contactProgress: 0.55, gesture: "right-hand-press" }),
  dispatch_confirmed: Object.freeze({ duration: 1.15, contactProgress: 0.58, gesture: "right-hand-confirm" }),
});

function idleAction() {
  return {
    kind: "idle",
    active: false,
    elapsed: 0,
    duration: ROBOT_ACTION_DURATION,
    contactProgress: ROBOT_ACTION_CONTACT_PROGRESS,
    gesture: "idle",
    event: null,
    beforeCarrying: false,
    afterCarrying: false,
    beforeVisualState: null,
  };
}

function visualSnapshot(state) {
  return structuredClone(state);
}

function stateIsCarrying(state) {
  return state.battery?.location === "carried" || Boolean(state.carriedItem);
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function createRobotActionState() {
  return idleAction();
}

export function actionKindForEvent(event) {
  return EVENT_TO_ACTION[event] ?? null;
}

export function isRobotActionActive(action) {
  return Boolean(action?.active);
}

export function beginRobotAction(action, event, beforeState, afterState) {
  const kind = actionKindForEvent(event);
  if (!kind || isRobotActionActive(action)) return action;
  const profile = EVENT_PROFILES[event] ?? {};
  return {
    kind,
    active: true,
    elapsed: 0,
    duration: profile.duration ?? ROBOT_ACTION_DURATION,
    contactProgress: profile.contactProgress ?? ROBOT_ACTION_CONTACT_PROGRESS,
    gesture: profile.gesture ?? (kind === "pickup" ? "two-hand-lift" : "two-hand-place"),
    event,
    beforeCarrying: stateIsCarrying(beforeState),
    afterCarrying: stateIsCarrying(afterState),
    beforeVisualState: visualSnapshot(beforeState),
  };
}

export function advanceRobotAction(action, deltaSeconds) {
  if (!isRobotActionActive(action)) return action;
  const elapsed = Math.min(action.duration, action.elapsed + Math.max(0, deltaSeconds));
  if (elapsed >= action.duration) return idleAction();
  return { ...action, elapsed };
}

export function finishRobotAction() {
  return idleAction();
}

export function getRobotActionPose(action, logicalCarrying = false) {
  if (!isRobotActionActive(action)) {
    return {
      kind: "idle",
      gesture: "idle",
      progress: 1,
      contactReached: true,
      visualCarrying: logicalCarrying,
      reach: 0,
      operationBlend: 0,
      crouch: 0,
      carryBlend: logicalCarrying ? 1 : 0,
      grip: logicalCarrying ? 0.82 : 0.16,
    };
  }

  const progress = Math.max(0, Math.min(1, action.elapsed / action.duration));
  const contactProgress = action.contactProgress ?? ROBOT_ACTION_CONTACT_PROGRESS;
  const contactReached = progress >= contactProgress;
  const beforeContact = smoothstep(progress / contactProgress);
  const afterContact = smoothstep((progress - contactProgress) / (1 - contactProgress));
  const reach = contactReached ? 1 - afterContact : beforeContact;
  const pickup = action.kind === "pickup";
  const operate = action.kind === "operate";
  return {
    kind: action.kind,
    gesture: action.gesture,
    progress,
    contactReached,
    visualCarrying: contactReached ? action.afterCarrying : action.beforeCarrying,
    reach,
    operationBlend: operate ? reach : 0,
    crouch: operate ? 0 : Math.sin(progress * Math.PI) * 0.28,
    carryBlend: operate
      ? (logicalCarrying ? 1 : 0)
      : pickup
        ? (contactReached ? afterContact : 0)
        : (contactReached ? 0 : 1 - beforeContact * 0.42),
    grip: operate
      ? (logicalCarrying ? 0.82 : 0.16)
      : pickup
        ? (contactReached ? 0.82 : 0.16 + beforeContact * 0.66)
        : (contactReached ? 0.16 : 0.82 - beforeContact * 0.66),
  };
}

export function getRobotPresentationState(action, logicalState) {
  if (!isRobotActionActive(action)) return logicalState;
  const pose = getRobotActionPose(action, stateIsCarrying(logicalState));
  if (pose.contactReached) return logicalState;
  return structuredClone(action.beforeVisualState);
}
