import RAPIER from '../../rapier-runtime.js';
import * as THREE from 'three';
import { STRUCTURES, LEVEL } from './level.js';
import { FIELD, FIELD_CROPS, SHARED_PRODUCE } from './field-layout.js';
import { TOOL_ROOM, TOOL_ROOM_WALLS } from './tool-room-layout.js';

export const PHYSICS_REVISION = 'browser-physics-v1';
export const PHYSICS_STEP = 1 / 240;
const origin = { x: 0, y: 0, z: 0 };
const box = (size, position = [0, 0, 0]) => ({ type: 'box', size, position });
const basket = (width, height, depth) => [
  box([width, .025, depth], [0, .0125, 0]),
  box([.025, height, depth], [-width / 2 + .0125, height / 2, 0]),
  box([.025, height, depth], [width / 2 - .0125, height / 2, 0]),
  box([width, height, .025], [0, height / 2, -depth / 2 + .0125]),
  box([width, height, .025], [0, height / 2, depth / 2 - .0125]),
];

export function objectDefinitions() {
  return [
    ...FIELD_CROPS.map(crop => ({ ...crop, position: [crop.x, crop.y, crop.z], mass: .3, rooted: true, friction: .65, grasp: [0, .16, 0], shapes: [{ type: 'cylinder', size: [.09, .022], position: [0, .12, 0] }, { type: 'ball', size: [.145], position: [0, .21, 0], groups: 0x0002000b }] })),
    ...SHARED_PRODUCE.map(item => ({ ...item, position: [item.x, item.y, item.z], mass: 5, friction: .7, grasp: [.30, .23, 0], shapes: [...basket(.64, .30, .44), box([.48, .16, .30], [0, .1, 0])] })),
    { id: 'harvest-basket', position: [FIELD.basket.x, 0, FIELD.basket.z], mass: 1.2, friction: .8, grasp: [.31, .24, 0], shapes: basket(.68, .31, .46) },
    ...['harvest-knife', 'hand-trowel'].map((id, index) => ({ id, position: [(index ? TOOL_ROOM.trowel.x : TOOL_ROOM.harvest.x) - .1, 1.155, -12.45], rotation: [0, -Math.SQRT1_2, 0, Math.SQRT1_2], mass: index ? .32 : .22, friction: .9, grasp: [0, .025, -.045], shapes: [ { type: 'cylinder', size: [.085, index ? .028 : .026], position: [0, .025, -.1], rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] }, box([.10, .007, .21], [0, .025, .13])] })),
    { id: 'sprayer', position: [TOOL_ROOM.sprayer.x, TOOL_ROOM.sprayer.y, TOOL_ROOM.sprayer.z], mass: 1.3, friction: .65, grasp: [0, .58, 0], shapes: [{ type: 'cylinder', size: [.21, .14], position: [0, .23, 0] }, box([.18, .032, .043], [0, .58, 0])] },
    { id: 'platform-scale', position: [LEVEL.scale.x, .76, LEVEL.scale.z], mass: 8, friction: .9, grasp: [0, .16, 0], shapes: [box([.65, .30, .65], [0, .15, 0])] },
    { id: 'pallet-jack', position: [1.5, 0, 4.9], mass: 65, friction: .16, grasp: [0, 1.1, -.3], shapes: [box([.18, .09, 1.3], [-.23, .09, 0]), box([.18, .09, 1.3], [.23, .09, 0]), box([.6, .23, .38], [0, .22, -.52]), box([.06, .8, .06], [0, .69, -.52])] },
  ];
}

export class RF15PhysicsWorld {
  constructor(world = null) {
    this.world = world ?? new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.gravity = { x: 0, y: -9.81, z: 0 };
    this.world.timestep = PHYSICS_STEP;
    this.world.numSolverIterations = 12;
    this.world.maxCcdSubsteps = 4;
    this.objects = new Map();
    this.ownedBodies = [];
    this.statics = [];
    this.accumulator = 0;
    this.time = 0;
    this.addStatic('ground', [50, .1, 50], [0, -.05, 0]);
    for (const structure of STRUCTURES) if (!['pallet-jack', 'tail-lift'].includes(structure.id)) this.addStatic(structure.id, structure.size, structure.position);
    for (const wall of TOOL_ROOM_WALLS) {
      const height = wall.id === 'tool-bench' ? 1.02 : 2.9;
      this.addStatic(wall.id, [wall.maxX - wall.minX, height, wall.maxZ - wall.minZ], [(wall.minX + wall.maxX) / 2, height / 2, (wall.minZ + wall.maxZ) / 2]);
    }
    for (const bed of FIELD.beds) this.addStatic('field-bed', [bed.width, .14, bed.length], [bed.x, .07, bed.z]);
    for (const definition of objectDefinitions()) this.addObject(definition);
    for (const horizontal of [TOOL_ROOM.harvest.x, TOOL_ROOM.trowel.x]) {
      this.addStatic('tool-rest', [.025, .13, .46], [horizontal + .08, 1.085, -12.66]);
      this.addStatic('tool-rest', [.12, .155, .46], [horizontal - .23, 1.0975, -12.66]);
    }
    this.tail = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(5.3, .06, 1));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.15, .06, .925).setFriction(.9).setCollisionGroups(0x0001001f), this.tail);
    this.ownedBodies.push(this.tail);
    const anchor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(TOOL_ROOM.hinge.x, 0, TOOL_ROOM.hinge.z));
    this.door = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(TOOL_ROOM.hinge.x, 0, TOOL_ROOM.hinge.z).setCanSleep(false));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.75, 1.08, .035).setTranslation(.9, 1.1, 0).setMass(18).setFriction(.7).setCollisionGroups(0x0001001f), this.door);
    this.doorJoint = this.world.createImpulseJoint(RAPIER.JointData.revolute(origin, origin, { x: 0, y: 1, z: 0 }), anchor, this.door, true);
    this.doorJoint.setLimits(-Math.PI / 2, 0);
    this.doorJoint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    this.ownedBodies.push(anchor, this.door);
  }

  addStatic(id, size, position) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...position));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(...size.map(value => value / 2)).setFriction(.8).setCollisionGroups(0x0001001f), body);
    this.statics.push({ id, size, position });
    this.ownedBodies.push(body);
  }

  addObject(definition) {
    const { id, position, rooted, shapes, mass, friction } = definition;
    const descriptor = rooted ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(.18);
    const body = this.world.createRigidBody(descriptor.setTranslation(...position));
    if (definition.rotation) body.setRotation(Array.isArray(definition.rotation) ? new THREE.Quaternion(...definition.rotation) : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), definition.rotation), true);
    const colliders = shapes.map(shape => {
      const colliderDescriptor = shape.type === 'ball' ? RAPIER.ColliderDesc.ball(...shape.size) : shape.type === 'cylinder' ? RAPIER.ColliderDesc.cylinder(...shape.size) : RAPIER.ColliderDesc.cuboid(...shape.size.map(value => value / 2));
      colliderDescriptor.setTranslation(...shape.position).setMass(mass / shapes.length).setFriction(friction).setRestitution(.02).setCollisionGroups(shape.groups ?? (id === 'harvest-knife' ? 0x0010000f : 0x0002001f)).setContactSkin(.0004);
      if (shape.rotation) colliderDescriptor.setRotation(new THREE.Quaternion(...shape.rotation));
      const collider = this.world.createCollider(colliderDescriptor, body);
      collider.userData = { object: id };
      return collider;
    });
    this.objects.set(id, { definition, body, colliders, rooted: Boolean(rooted), model: null });
    return this.objects.get(id);
  }

  cut(id) {
    const entry = this.objects.get(id);
    if (!entry?.rooted) return false;
    entry.rooted = false;
    entry.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    entry.body.enableCcd(true);
    return true;
  }

  graspPoint(id) {
    const entry = this.objects.get(id);
    return new THREE.Vector3(...entry.definition.grasp).applyQuaternion(new THREE.Quaternion().copy(entry.body.rotation())).add(new THREE.Vector3().copy(entry.body.translation()));
  }

  advance(delta, beforeStep = () => {}, afterStep = () => {}) {
    this.accumulator = Math.min(.1, this.accumulator + Math.max(0, delta));
    while (this.accumulator >= PHYSICS_STEP) {
      beforeStep(PHYSICS_STEP, Math.min(1, PHYSICS_STEP / this.accumulator));
      this.world.step();
      afterStep(PHYSICS_STEP);
      this.time += PHYSICS_STEP;
      this.accumulator -= PHYSICS_STEP;
    }
  }

  insideBasket(id) {
    const entry = this.objects.get(id);
    const container = this.objects.get('harvest-basket');
    const point = new THREE.Vector3().copy(entry.body.translation()).sub(new THREE.Vector3().copy(container.body.translation())).applyQuaternion(new THREE.Quaternion().copy(container.body.rotation()).invert());
    return Math.abs(point.x) < .31 && Math.abs(point.z) < .20 && point.y > -.025 && point.y < .38 && new THREE.Vector3().copy(entry.body.linvel()).length() < .18;
  }

  snapshot() {
    return { revision: PHYSICS_REVISION, engine: 'Rapier', time: this.time, objects: Object.fromEntries([...this.objects].map(([id, entry]) => [id, { position: { ...entry.body.translation() }, rotation: { ...entry.body.rotation() }, velocity: { ...entry.body.linvel() }, mass: entry.body.mass(), rooted: entry.rooted }])) };
  }

  dispose() {
    for (const entry of this.objects.values()) this.world.removeRigidBody(entry.body);
    for (const body of this.ownedBodies) this.world.removeRigidBody(body);
    this.objects.clear();
  }
}
