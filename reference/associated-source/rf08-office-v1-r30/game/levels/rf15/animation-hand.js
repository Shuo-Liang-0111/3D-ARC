import * as THREE from 'three';

const quaternion = values => new THREE.Quaternion(values[1], values[2], values[3], values[0]);
const closedAngles = [0, -.6, -.8, .6, .8, .6, .8];

export class AnimationHand {
  constructor(scene, definition, geometries, side) {
    this.side = side;
    this.root = new THREE.Group();
    this.parts = [];
    this.amount = 0;
    this.closed = false;
    this.held = null;
    this.attachment = null;
    scene.add(this.root);
    const byName = new Map();
    const material = new THREE.MeshStandardMaterial({ color: 0x858b88, metalness: .45, roughness: .46 });
    for (const spec of definition) {
      const parent = byName.get(spec.parent);
      const node = new THREE.Group();
      node.name = spec.name;
      if (parent) {
        node.position.fromArray(spec.position);
        node.quaternion.copy(quaternion(spec.quaternion));
      }
      (parent?.node ?? this.root).add(node);
      for (const geom of spec.geoms.filter(geom => geom.visual)) {
        const mesh = new THREE.Mesh(geometries.get(geom.mesh), material);
        mesh.position.fromArray(geom.position);
        mesh.quaternion.copy(quaternion(geom.quaternion));
        mesh.castShadow = true;
        node.add(mesh);
      }
      const target = closedAngles[this.parts.length - 1] * (side === 'right' ? 1 : -1);
      const part = { node, spec, parent, rest: node.quaternion.clone(), target };
      this.parts.push(part);
      byName.set(spec.name, part);
    }
  }

  setGrip(closed) { this.closed = closed; }

  attach(entry) {
    const inverse = this.root.quaternion.clone().invert();
    this.held = entry.id;
    this.attachment = {
      entry,
      position: entry.position.clone().sub(this.root.position).applyQuaternion(inverse),
      rotation: inverse.multiply(entry.rotation),
    };
  }

  detach() {
    this.held = null;
    this.attachment = null;
    this.closed = false;
  }

  update(dt, pose) {
    this.root.position.copy(pose.position);
    this.root.quaternion.copy(pose.rotation);
    this.amount += THREE.MathUtils.clamp((this.closed ? 1 : 0) - this.amount, -dt * 3, dt * 3);
    const blend = THREE.MathUtils.smoothstep(this.amount, 0, 1);
    for (const part of this.parts) {
      if (!part.parent) continue;
      const open = part.spec.name.includes('thumb_0') ? (this.side === 'left' ? -.8 : .8) : THREE.MathUtils.clamp(-part.target * .8, ...part.spec.joint.limits);
      part.node.quaternion.copy(part.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...part.spec.joint.axis), THREE.MathUtils.lerp(open, part.target, blend)));
    }
    if (this.attachment) {
      const { entry, position, rotation } = this.attachment;
      entry.position.copy(position).applyQuaternion(pose.rotation).add(pose.position);
      entry.rotation.copy(pose.rotation).multiply(rotation);
    }
  }
}
