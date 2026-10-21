// Shared cart and painted parking bay; movement is controlled by the player.
export const CART_REVISION = 'cart-manual-v2';
export const CART = Object.freeze({
  start: { x: 1.5, z: 4.9, yaw: Math.PI },
  parking: { x: -5.65, z: -1.3, yaw: Math.PI },
  halfWidth: .36, halfLength: .60, standOffset: .80,
  handle: { y: 1.005, z: -.49, halfWidth: .13 },
  speed: .65, turnSpeed: .65,
  bay: { halfWidth: .64, halfLength: .94, lineWidth: .06, yawTolerance: .30 },
});
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function cartStand(pose) {
  return { x: pose.x - Math.sin(pose.yaw) * CART.standOffset, z: pose.z - Math.cos(pose.yaw) * CART.standOffset, yaw: pose.yaw };
}
export function cartDriverPose(cart) {
  const stand = cartStand(cart), offset = cart.gripOffset;
  if (!offset) return stand;
  const cosine = Math.cos(cart.yaw), sine = Math.sin(cart.yaw);
  return { x: stand.x + cosine * offset.x + sine * offset.z,
    z: stand.z - sine * offset.x + cosine * offset.z, yaw: stand.yaw + offset.yaw };
}
export function cartBounds(pose) {
  const hx = Math.abs(Math.cos(pose.yaw)) * CART.halfWidth + Math.abs(Math.sin(pose.yaw)) * CART.halfLength;
  const hz = Math.abs(Math.sin(pose.yaw)) * CART.halfWidth + Math.abs(Math.cos(pose.yaw)) * CART.halfLength;
  return {id: 'pallet-jack', minX: pose.x - hx, maxX: pose.x + hx, minZ: pose.z - hz, maxZ: pose.z + hz};
}
export function cartClear(pose, colliders, bounds) {
  const box = cartBounds(pose), margin = .06;
  if (box.minX < bounds.minX || box.maxX > bounds.maxX || box.minZ < bounds.minZ || box.maxZ > bounds.maxZ) return false;
  return !colliders.filter(c => c.id !== 'pallet-jack').some(c => box.minX < c.maxX + margin && box.maxX > c.minX - margin && box.minZ < c.maxZ + margin && box.maxZ > c.minZ - margin);
}
export function cartDocked(cart) {
  const yaw = angleDelta(cart.yaw, CART.parking.yaw);
  if (Math.abs(yaw) > CART.bay.yawTolerance) return false;
  const dx = cart.x - CART.parking.x, dz = cart.z - CART.parking.z;
  const c = Math.cos(CART.parking.yaw), s = Math.sin(CART.parking.yaw);
  const x = c * dx - s * dz, z = s * dx + c * dz;
  const hx = Math.abs(Math.cos(yaw)) * CART.halfWidth + Math.abs(Math.sin(yaw)) * CART.halfLength;
  const hz = Math.abs(Math.sin(yaw)) * CART.halfWidth + Math.abs(Math.cos(yaw)) * CART.halfLength;
  return Math.abs(x) + hx <= CART.bay.halfWidth - CART.bay.lineWidth / 2 && Math.abs(z) + hz <= CART.bay.halfLength - CART.bay.lineWidth / 2;
}

// Low chassis occupies the forks; the elevated handle is not a full-height box.
export function robotClearsCart(pose, x, z, radius) {
  const dx=x-pose.x,dz=z-pose.z,c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
  const lx=c*dx-s*dz,lz=s*dx+c*dz;
  return (lx-Math.max(-.35,Math.min(lx,.35)))**2+(lz-Math.max(-.40,Math.min(lz,.60)))**2 >= radius**2;
}
