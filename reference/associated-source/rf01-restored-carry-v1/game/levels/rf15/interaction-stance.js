export const STANCE_POSITION_TOLERANCE = .18;
export const STANCE_YAW_TOLERANCE = .30;

export function interactionStanceMessage(player, stand, yaw) {
  if (Math.hypot(player.x - stand.x, player.z - stand.z) > STANCE_POSITION_TOLERANCE) return '请走近物体的操作位置后再按 F';
  const error = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw));
  if (Math.abs(error) > STANCE_YAW_TOLERANCE) return '请面向物体后再按 F';
  return null;
}
