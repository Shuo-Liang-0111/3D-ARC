export const ORANGE_ID = 'orange-shipment';
export const ORANGE_TASK = Object.freeze({
  revision: 'orange-weigh-v2',
  gramsEach: 250,
  targetGrams: 5000,
  count: 20,
  stabilitySeconds: 6.5,
  instabilityAmplitude: .34,
  range: 1.2,
  // Stations sit at the accessible front edge of each work surface so the
  // scripted G1 reach is a short forward motion instead of an impossible lean.
  home: { x: -5.70, y: .82, z: -3.92 },
  scale: { x: -2.60, y: 1.062, z: -3.96 },
  source: { x: -3.03, y: 1.00, z: -3.82 },
  pack: { x: .6, y: .84, z: -2.95 },
  tail: { x: 5.3, y: .14, z: 2.25 },
  truck: { x: 5.3, y: 1.02, z: -.62 },
  stands: {
    // Leave the G1 body clearance in front of the tables; the hand target
    // remains at the table edge and is reached by a short forward extension.
    home: { x: -5.70, z: -3.34, yaw: Math.PI },
    scale: { x: -2.60, z: -3.29, yaw: Math.PI },
    pack: { x: .6, z: -2.65, yaw: Math.PI },
    tail: { x: 5.3, z: 2.55, yaw: Math.PI },
  },
});
export function createOrangeShipment() {
  return {
    id: ORANGE_ID,
    kind: 'orange',
    name: '满筐橙子',
    code: 'O01',
    weight: ORANGE_TASK.targetGrams / 1000,
    orangeCount: ORANGE_TASK.count,
    weighed: false,
    weighing: false,
    stable: false,
    weighElapsed: 0,
    packed: false,
    location: 'intake',
    ...ORANGE_TASK.home,
  };
}
export function orangeInteraction(state) {
  const item = state.items[ORANGE_ID];
  if (!item || state.heldTool || state.sprayer || state.carriedCrop || (state.carriedItem && state.carriedItem !== ORANGE_ID) || state.cart.gripped) return null;
  const near = point => Math.hypot(state.player.x - point.x, state.player.z - point.z) <= ORANGE_TASK.range;
  if (state.carriedItem === ORANGE_ID) {
    if (!item.weighed && near(ORANGE_TASK.scale)) return { type: 'orange-place-scale', item: ORANGE_ID };
    if (item.weighed && !item.packed && near(ORANGE_TASK.pack)) return { type: 'orange-place-pack', item: ORANGE_ID };
    if (item.packed && near(ORANGE_TASK.tail)) return { type: 'orange-load', item: ORANGE_ID };
    return null;
  }
  if (item.location === 'intake' && near(item)) {
    // The legacy shared produce crates remain interactive in every RF-15
    // variant.  They sit on the same intake table, so a broad nearby range
    // can contain both the orange basket and a leafy-produce crate. Prefer
    // the object the robot is actually facing; this prevents an approach to
    // the apple/bok-choy slot from accidentally picking the orange basket.
    const targetAngle = point => Math.atan2(point.x - state.player.x, point.z - state.player.z);
    const angleError = point => Math.abs(Math.atan2(Math.sin(targetAngle(point) - state.player.yaw), Math.cos(targetAngle(point) - state.player.yaw)));
    const score = point => Math.hypot(state.player.x - point.x, state.player.z - point.z) + angleError(point) * .35;
    const shared = Object.values(state.items)
      .filter(candidate => candidate.id !== ORANGE_ID && ['intake', 'floor'].includes(candidate.location))
      .filter(candidate => near(candidate))
      .sort((left, right) => score(left) - score(right))[0];
    if (shared && score(shared) + .05 < score(item)) return null;
    return { type: 'orange-pickup', item: ORANGE_ID };
  }
  if (item.location === 'scale' && near(ORANGE_TASK.scale)) {
    return { type: item.stable ? 'orange-take-scale' : 'orange-weighing', item: ORANGE_ID };
  }
  if (item.location === 'pack' && near(ORANGE_TASK.pack)) return { type: item.packed ? 'orange-take-pack' : 'orange-pack', item: ORANGE_ID };
  return null;
}
export function applyOrangeAction(next, action) {
  const item = next.items[ORANGE_ID];
  let reward = null;
  switch (action.type) {
    case 'orange-pickup':
      next.carriedItem = ORANGE_ID; item.location = 'carried'; next.lastEvent = 'orange_basket_taken'; break;
    case 'orange-place-scale':
      if (next.scaleItem) return { error: 'station_occupied' };
      next.carriedItem = null; next.scaleItem = ORANGE_ID; item.location = 'scale';
      Object.assign(item, ORANGE_TASK.scale, { weighing: true, stable: false, weighElapsed: 0, weight: 0 });
      next.weight = 0; next.lastEvent = 'orange_weighing'; break;
    case 'orange-weighing':
      return { error: 'weight_stabilizing' };
    case 'orange-take-scale':
      if (!item.stable || item.orangeCount * ORANGE_TASK.gramsEach !== ORANGE_TASK.targetGrams) return { error: 'weight_not_ready' };
      next.scaleItem = null; next.weight = 0; next.carriedItem = ORANGE_ID; item.location = 'carried';
      item.weighed = true; item.weighing = false; item.weight = ORANGE_TASK.targetGrams / 1000;
      next.records.push({ id: ORANGE_ID, kg: 5, count: ORANGE_TASK.count });
      next.lastEvent = 'weight_ok'; reward = 'orange-weighed'; break;
    case 'orange-place-pack':
      if (!item.weighed || next.packItem) return { error: 'weight_required' };
      next.carriedItem = null; next.packItem = ORANGE_ID; item.location = 'pack';
      Object.assign(item, ORANGE_TASK.pack); next.lastEvent = 'on_pack'; break;
    case 'orange-pack':
      if (!item.weighed || item.orangeCount !== ORANGE_TASK.count) return { error: 'weight_required' };
      item.packed = true; item.name = '橙子箱 · 5 kg'; next.lastEvent = 'packed'; reward = 'orange-packed'; break;
    case 'orange-take-pack':
      if (!item.packed) return { error: 'packing_required' };
      next.packItem = null; next.carriedItem = ORANGE_ID; item.location = 'carried'; next.lastEvent = 'orange_box_taken'; break;
    case 'orange-load':
      if (!item.packed || item.orangeCount !== ORANGE_TASK.count || next.loaded.includes(ORANGE_ID)) return { error: 'packing_required' };
      next.carriedItem = null; item.location = 'loaded'; Object.assign(item, ORANGE_TASK.truck);
      next.loaded.push(ORANGE_ID); next.lastEvent = 'loaded'; reward = 'orange-loaded'; break;
    default: return { error: 'nothing_in_reach' };
  }
  return { reward };
}
