const EPSILON = 1e-6;

function clamp(value) {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function moveAxis(next, state, dx, dz, isWalkable) {
  const proposedX = state.player.x + dx;
  const proposedZ = state.player.z + dz;
  if (isWalkable(next, proposedX, state.player.z)) next.player.x = proposedX;
  if (isWalkable(next, next.player.x, proposedZ)) next.player.z = proposedZ;
}

export function applyRobotMovement(next, state, input = {}, dt, level, isWalkable) {
  let translating = false;
  let turning = false;
  if (Number.isFinite(input.move) || Number.isFinite(input.strafe) || Number.isFinite(input.turn)) {
    let move = clamp(input.move);
    let strafe = clamp(input.strafe);
    const turn = clamp(input.turn);
    const translationMagnitude = Math.hypot(move, strafe);
    if (translationMagnitude > 1) {
      move /= translationMagnitude;
      strafe /= translationMagnitude;
    }
    translating = Math.abs(move) >= EPSILON || Math.abs(strafe) >= EPSILON;
    turning = Math.abs(turn) >= EPSILON;
    if (turning) {
      next.player.yaw += turn * level.turnSpeed * dt;
      if (!isWalkable(next, state.player.x, state.player.z)) next.player.yaw = state.player.yaw;
    }
    if (translating) {
      const forward = move * level.moveSpeed * dt;
      const lateral = strafe * level.moveSpeed * dt;
      moveAxis(next, state,
        Math.sin(next.player.yaw) * forward + Math.cos(next.player.yaw) * lateral,
        Math.cos(next.player.yaw) * forward - Math.sin(next.player.yaw) * lateral,
        isWalkable);
    }
    return { active: translating || turning, translating, turning, motionTurning: turning && !translating };
  }
  const magnitude = Math.hypot(input.x || 0, input.z || 0);
  if (magnitude < EPSILON) return { active: false, translating: false, turning: false, motionTurning: false };
  translating = true;
  const direction = { x: (input.x || 0) / magnitude, z: (input.z || 0) / magnitude };
  const targetYaw = Math.atan2(direction.x, direction.z);
  const delta = Math.atan2(Math.sin(targetYaw - state.player.yaw), Math.cos(targetYaw - state.player.yaw));
  turning = Math.abs(delta) > 0.28;
  next.player.yaw += Math.sign(delta) * Math.min(Math.abs(delta), level.turnSpeed * dt);
  if (!isWalkable(next, state.player.x, state.player.z)) next.player.yaw = state.player.yaw;
  if (Math.abs(delta) <= 0.12) moveAxis(next, state, direction.x * level.moveSpeed * dt, direction.z * level.moveSpeed * dt, isWalkable);
  return { active: true, translating, turning, motionTurning: turning };
}
