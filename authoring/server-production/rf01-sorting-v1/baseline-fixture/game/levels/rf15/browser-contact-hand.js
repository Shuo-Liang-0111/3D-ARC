import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const vector = values => new THREE.Vector3(...values);
const quaternion = values => new THREE.Quaternion(values[1], values[2], values[3], values[0]);
const identity = new THREE.Quaternion();
const closedAngles = [0, -.6, -.8, .6, .8, .6, .8];

export class BrowserContactHand {
  constructor(world, scene, definition, geometries, side, pose) {
    this.world = world;
    this.side = side;
    this.parts = [];
    this.closed = false;
    this.strength = .9;
    this.held = null;
    this.contactSeconds = 0;
    this.lostSeconds = 0;
    this.contacts = [];
    this.attachment = null;
    this.releasing = new Map();
    const byName = new Map();
    for (const spec of definition) {
      const parent = byName.get(spec.parent);
      const localPosition = vector(spec.position);
      const localRotation = quaternion(spec.quaternion);
      const position = parent ? localPosition.clone().applyQuaternion(parent.orientation).add(parent.position) : vector(pose.position);
      const orientation = parent ? parent.orientation.clone().multiply(localRotation) : new THREE.Quaternion(...pose.quaternion);
      const descriptor = parent ? RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAdditionalSolverIterations(12) : RAPIER.RigidBodyDesc.kinematicPositionBased();
      descriptor.setTranslation(...position).setRotation(orientation);
      const body = world.createRigidBody(descriptor);
      if (parent) body.setAdditionalMassProperties(.001, { x: 0, y: 0, z: 0 }, { x: .0001, y: .0001, z: .0001 }, identity, true);
      const visual = new THREE.Group();
      visual.name = spec.name;
      scene?.add(visual);
      const colliders = [];
      for (const geom of spec.geoms) {
        const geometry = geom.mesh ? geometries.get(geom.mesh) : new THREE.BoxGeometry(...geom.size.map(size => size * 2));
        if (!geometry) throw new Error('Missing hand geometry ' + geom.mesh);
        if (geom.visual) {
          const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x858b88, metalness: .45, roughness: .46 }));
          mesh.position.fromArray(geom.position);
          mesh.quaternion.copy(quaternion(geom.quaternion));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          visual.add(mesh);
        }
        if (geom.collision) {
          const colliderDescriptor = geom.type === 'box' ? RAPIER.ColliderDesc.cuboid(...geom.size) : RAPIER.ColliderDesc.convexHull(geometry.attributes.position.array);
          if (!colliderDescriptor) throw new Error('Invalid hand convex hull ' + geom.mesh);
          colliderDescriptor.setTranslation(...geom.position).setRotation(quaternion(geom.quaternion)).setFriction(1.1).setRestitution(0).setCollisionGroups(0x00040013).setMass(spec.mass).setContactSkin(.0004);
          const collider = world.createCollider(colliderDescriptor, body);
          collider.userData = { hand: side, finger: parent ? spec.name.split('_')[2] : 'palm' };
          colliders.push(collider);
        }
      }
      const part = { spec, body, visual, colliders, position, orientation, parent, restRotation: localRotation };
      if (parent) {
        const joint = world.createImpulseJoint(RAPIER.JointData.revolute(localPosition, { x: 0, y: 0, z: 0 }, vector(spec.joint.axis)), parent.body, body, true);
        joint.setContactsEnabled(false);
        joint.setLimits(...spec.joint.limits);
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
        part.joint = joint;
        part.target = closedAngles[this.parts.length - 1] * (side === 'right' ? 1 : -1);
      }
      this.parts.push(part);
      byName.set(spec.name, part);
    }
    this.palm = this.parts[0].body;
    this.draw();
  }

  setPose(position, rotation, immediate = false) {
    if (immediate) {
      const previous = new THREE.Quaternion().copy(this.palm.rotation());
      const transform = new THREE.Quaternion().copy(rotation).multiply(previous.invert());
      const origin = new THREE.Vector3().copy(this.palm.translation());
      for (const part of this.parts) {
        const point = new THREE.Vector3().copy(part.body.translation()).sub(origin).applyQuaternion(transform).add(position);
        part.body.setTranslation(point, true);
        part.body.setRotation(transform.clone().multiply(new THREE.Quaternion().copy(part.body.rotation())), true);
        part.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        part.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    this.palm.setNextKinematicTranslation(position);
    this.palm.setNextKinematicRotation(rotation);
  }

  setGrip(closed, strength = this.strength) {
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('Grip strength must be within 0..1');
    this.closed = Boolean(closed);
    this.strength = strength;
    if (!closed) this.detach();
  }

  attach(entry) {
    if (this.attachment || !entry || entry.rooted) return;
    const palmRotation = new THREE.Quaternion().copy(this.palm.rotation());
    const inverse = palmRotation.clone().invert();
    const position = new THREE.Vector3().copy(entry.body.translation()).sub(new THREE.Vector3().copy(this.palm.translation())).applyQuaternion(inverse);
    const rotation = inverse.clone().multiply(new THREE.Quaternion().copy(entry.body.rotation()));
    const joint = this.world.createImpulseJoint(RAPIER.JointData.fixed(position, rotation, { x: 0, y: 0, z: 0 }, identity), this.palm, entry.body, true);
    joint.setContactsEnabled(false);
    const groups = this.releasing.get(entry)?.groups ?? entry.colliders.map(collider => collider.collisionGroups());
    this.releasing.delete(entry);
    entry.colliders.forEach((collider, index) => collider.setCollisionGroups(groups[index] & ~12));
    this.attachment = { joint, entry, groups, position, rotation };
  }

  detach() {
    if (this.attachment) {
      const { joint, entry, groups } = this.attachment;
      this.world.removeImpulseJoint(joint, true);
      this.releasing.set(entry, { groups });
      entry.body.wakeUp();
      this.attachment = null;
    }
    this.held = null;
    this.contactSeconds = 0;
    this.candidate = null;
  }

  restoreReleasedCollisions(force = false) {
    for (const [entry, { groups }] of this.releasing) {
      const overlaps = !force && entry.colliders.some((collider, index) => (groups[index] & 4) && this.parts.some(part => part.colliders.some(finger => collider.contactCollider(finger, .003))));
      if (overlaps) continue;
      entry.colliders.forEach((collider, index) => collider.setCollisionGroups(groups[index]));
      this.releasing.delete(entry);
    }
  }

  attachmentState() {
    if (!this.attachment) return null;
    const { entry, position, rotation } = this.attachment;
    const inverse = new THREE.Quaternion().copy(this.palm.rotation()).invert();
    const actualPosition = new THREE.Vector3().copy(entry.body.translation()).sub(new THREE.Vector3().copy(this.palm.translation())).applyQuaternion(inverse);
    const actualRotation = inverse.multiply(new THREE.Quaternion().copy(entry.body.rotation()));
    return { id: entry.definition.id, mode: 'fixed', positionError: position.distanceTo(actualPosition), angleError: rotation.angleTo(actualRotation) };
  }

  beforeStep(dt) {
    for (const part of this.parts) {
      if (!part.parent) continue;
      const open = part.spec.name.includes('thumb_0') ? (this.side === 'left' ? -.8 : .8) : THREE.MathUtils.clamp(-part.target * .8, ...part.spec.joint.limits);
      part.joint.configureMotorPosition(this.closed ? part.target : open, this.strength * 8, this.strength * .15);
    }
  }

  afterStep(dt, objects) {
    this.restoreReleasedCollisions();
    const touching = new Map();
    for (const part of this.parts) for (const collider of part.colliders) {
      this.world.contactPairsWith(collider, other => {
        const id = other.userData?.object;
        if (!id || !objects.has(id)) return;
        let impulse = 0;
        this.world.contactPair(collider, other, manifold => {
          for (let index = 0; index < manifold.numContacts(); index++) impulse += manifold.contactImpulse(index);
        });
        if (impulse > 1e-7) {
          if (!touching.has(id)) touching.set(id, new Set());
          touching.get(id).add(collider.userData.finger);
        }
      });
    }
    this.contacts = [...touching].map(([id, fingers]) => ({ id, fingers: [...fingers] }));
    const candidates = [...touching].filter(([, fingers]) => fingers.has('thumb') && ['index', 'middle', 'palm'].some(finger => fingers.has(finger)));
    const candidate = candidates.find(([id]) => id === this.held) ?? candidates[0];
    if (this.closed && candidate) {
      this.contactSeconds = this.candidate === candidate[0] ? this.contactSeconds + dt : dt;
      this.candidate = candidate[0];
      if (this.contactSeconds > .2 && !this.held) {
        this.held = candidate[0];
      }
    } else {
      this.contactSeconds = 0;
    }
    this.lostSeconds = this.held && !touching.has(this.held) ? this.lostSeconds + dt : 0;
    if (this.held) this.attach(objects.get(this.held));
    if (!this.attachment && this.lostSeconds > .15) this.held = null;
  }

  graspPoint() {
    return new THREE.Vector3(.14, this.side === 'right' ? .04 : -.04, 0).applyQuaternion(new THREE.Quaternion().copy(this.palm.rotation())).add(new THREE.Vector3().copy(this.palm.translation()));
  }

  draw() {
    for (const part of this.parts) {
      part.visual.position.copy(part.body.translation());
      part.visual.quaternion.copy(part.body.rotation());
    }
  }

  dispose() {
    this.detach();
    this.restoreReleasedCollisions(true);
    for (const part of this.parts) {
      part.visual.removeFromParent();
      part.visual.traverse(node => node.material?.dispose());
      this.world.removeRigidBody(part.body);
    }
  }
}
