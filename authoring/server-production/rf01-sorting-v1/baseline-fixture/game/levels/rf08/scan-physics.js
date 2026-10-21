import RAPIER from "@dimforge/rapier3d-compat";

await RAPIER.init();

export class OfficePhysics {
  constructor(positions, indices, { radius = 0.23, height = 1.35 } = {}) {
    this.radius = radius;
    this.height = height;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions, indices));
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(height / 2 - radius, radius), this.body);
    this.controller = this.world.createCharacterController(0.008);
    this.controller.setSlideEnabled(true);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 5);
    this.controller.setMinSlopeSlideAngle(Math.PI / 4);
    this.controller.enableSnapToGround(0.12);
    this.world.step();
  }

  setBin(bin) {
    if (!this.binCollider) this.binCollider = this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.155, 0.16));
    this.binCollider.setEnabled(bin.location === 'floor');
    this.binCollider.setTranslation({x: bin.x, y: 0.155, z: bin.z});
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.step();
  }

  canPlaceBin(x, z) {
    if (![x,z].every(Number.isFinite) || x < -2.93 || x > 2.95 || z < -1.45 || z > 1.97) return false;
    let blocked = false;
    this.world.intersectionsWithShape({x,y:0.17,z}, {x:0,y:0,z:0,w:1}, new RAPIER.Cylinder(0.145,0.17), () => {blocked=true;return false;}, undefined,undefined,this.collider,undefined,(collider)=>collider.handle !== this.binCollider?.handle);
    return !blocked;
  }

  binPathClear(from,to) {
    const distance = Math.hypot(to.x-from.x,to.z-from.z);
    if (distance < 0.001) return true;
    const ray = new RAPIER.Ray({x:from.x,y:0.24,z:from.z},{x:(to.x-from.x)/distance,y:0,z:(to.z-from.z)/distance});
    return !this.world.castRay(ray,Math.max(0,distance-0.18),true,undefined,undefined,this.collider,undefined,(collider)=>collider.handle !== this.binCollider?.handle);
  }

  canStand(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < -3.1 + this.radius || x > 3.12 - this.radius || z < -1.62 + this.radius || z > 2.14 - this.radius) return false;
    let blocked = false;
    this.world.intersectionsWithShape(
      { x, y: this.height / 2 + 0.025, z },
      { x: 0, y: 0, z: 0, w: 1 },
      this.collider.shape,
      () => { blocked = true; return false; },
      undefined, undefined, this.collider,
    );
    return !blocked;
  }

  move(from, displacement) {
    const start = { x: from.x, y: this.height / 2 + 0.025, z: from.z };
    this.body.setTranslation(start, true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.controller.computeColliderMovement(this.collider, { x: displacement.x, y: -0.04, z: displacement.z });
    const corrected = this.controller.computedMovement();
    return { x: from.x + corrected.x, z: from.z + corrected.z };
  }

  dispose() {
    this.world.free();
  }
}

let activePhysics = null;
export function installOfficePhysics(physics) { activePhysics?.dispose(); activePhysics = physics; }
export function getOfficePhysics() { return activePhysics; }
export async function loadOfficePhysics() {
  const responses = await Promise.all([
    fetch("/office-scan/collision-positions.bin?v=bin-20260907"),
    fetch("/office-scan/collision-indices.bin?v=bin-20260907"),
  ]);
  if (responses.some((response) => !response.ok)) throw new Error("办公室碰撞数据加载失败");
  const buffers = await Promise.all(responses.map((response) => response.arrayBuffer()));
  activePhysics?.dispose();
  activePhysics = new OfficePhysics(new Float32Array(buffers[0]), new Uint32Array(buffers[1]));
  return activePhysics;
}
