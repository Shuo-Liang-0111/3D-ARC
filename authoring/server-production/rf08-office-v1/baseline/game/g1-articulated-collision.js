import RAPIER from "./rapier-runtime.js";
import * as THREE from "three";

const CAPSULE_ALONG_Z = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const triMeshDataCache = new WeakMap();

function meshGeom(link, mesh, name, source = "mujoco") {
  return Object.freeze({ link, mesh, name, shape: "trimesh", source });
}

function cylinder(link, name, center, radius, halfHeight, rotation = null) {
  return Object.freeze({ link, name, center, radius, halfHeight, rotation, shape: "cylinder", source: "mujoco" });
}

function sphere(link, name, center, radius) {
  return Object.freeze({ link, name, center, radius, shape: "sphere", source: "mujoco" });
}

export const G1_MUJOCO_COLLISION_MESHES = Object.freeze([
  meshGeom("pelvis", "pelvis__visual_1", "pelvis-contour"),
  ...["left", "right"].flatMap((side) => [
    meshGeom(`${side}_hip_pitch_link`, `${side}_hip_pitch_link__visual_0`, `${side}-hip-pitch`),
    meshGeom(`${side}_hip_roll_link`, `${side}_hip_roll_link__visual_0`, `${side}-hip-roll`),
    meshGeom(`${side}_hip_yaw_link`, `${side}_hip_yaw_link__visual_0`, `${side}-hip-yaw`),
    meshGeom(`${side}_knee_link`, `${side}_knee_link__visual_0`, `${side}-knee`),
    meshGeom(`${side}_ankle_pitch_link`, `${side}_ankle_pitch_link__visual_0`, `${side}-ankle-pitch`),
  ]),
  meshGeom("torso_link", "torso_link__visual_0", "torso-shell"),
  meshGeom("torso_link", "torso_link__visual_1", "torso-logo"),
  meshGeom("head_link", "torso_link__visual_2", "head-shell"),
  meshGeom("torso_link", "torso_link__visual_3", "waist-support"),
  ...["left", "right"].flatMap((side) => [
    meshGeom(`${side}_shoulder_yaw_link`, `${side}_shoulder_yaw_link__visual_0`, `${side}-shoulder-yaw`),
    meshGeom(`${side}_elbow_link`, `${side}_elbow_link__visual_0`, `${side}-elbow`),
    meshGeom(`${side}_wrist_roll_link`, `${side}_wrist_roll_link__visual_0`, `${side}-wrist-roll`),
    meshGeom(`${side}_wrist_pitch_link`, `${side}_wrist_pitch_link__visual_0`, `${side}-wrist-pitch`),
    meshGeom(`${side}_wrist_yaw_link`, `${side}_wrist_yaw_link__visual_0`, `${side}-wrist-yaw`),
  ]),
]);

export const G1_MUJOCO_PRIMITIVE_COLLIDERS = Object.freeze([
  cylinder("left_shoulder_pitch_link", "left-shoulder-pitch-cylinder", [-0.04, -0.01, 0], 0.03, 0.025, CAPSULE_ALONG_Z.toArray()),
  cylinder("right_shoulder_pitch_link", "right-shoulder-pitch-cylinder", [0.04, -0.01, 0], 0.03, 0.025, CAPSULE_ALONG_Z.toArray()),
  cylinder("left_shoulder_roll_link", "left-shoulder-roll-cylinder", [-0.006, -0.053, -0.004], 0.03, 0.015),
  cylinder("right_shoulder_roll_link", "right-shoulder-roll-cylinder", [0.006, -0.053, -0.004], 0.03, 0.015),
  ...["left", "right"].flatMap((side) => {
    const link = `${side}_ankle_roll_link`;
    return [
      sphere(link, `${side}-heel-inner`, [-0.025, -0.03, -0.05], 0.005),
      sphere(link, `${side}-heel-outer`, [0.025, -0.03, -0.05], 0.005),
      sphere(link, `${side}-toe-inner`, [-0.03, -0.03, 0.12], 0.005),
      sphere(link, `${side}-toe-outer`, [0.03, -0.03, 0.12], 0.005),
    ];
  }),
]);

export const G1_SUPPLEMENTAL_HAND_COLLISION_MESHES = Object.freeze([
  meshGeom("left_wrist_yaw_link", "left_wrist_yaw_link__visual_1", "left-rubber-hand", "supplemental-hand"),
  meshGeom("right_wrist_yaw_link", "right_wrist_yaw_link__visual_1", "right-rubber-hand", "supplemental-hand"),
]);

export const G1_ARTICULATED_COLLIDER_SPECS = Object.freeze([
  ...G1_MUJOCO_COLLISION_MESHES,
  ...G1_MUJOCO_PRIMITIVE_COLLIDERS,
  ...G1_SUPPLEMENTAL_HAND_COLLISION_MESHES,
]);

function getModelRoot(robot) {
  if (robot?.name === "unitree-g1-edu2-dex1-web") return robot.children[0];
  if (robot?.userData?.officialModel) return robot.userData.officialModel.children[0];
  return robot?.getObjectByName?.("g1_official_root")?.parent ?? robot;
}

function getMeshScale(mesh) {
  const scale = new THREE.Vector3();
  mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return scale;
}

function getTriMeshData(mesh) {
  const scale = getMeshScale(mesh);
  const cacheKey = `${scale.x.toFixed(8)}:${scale.y.toFixed(8)}:${scale.z.toFixed(8)}`;
  let geometryCache = triMeshDataCache.get(mesh.geometry);
  if (!geometryCache) {
    geometryCache = new Map();
    triMeshDataCache.set(mesh.geometry, geometryCache);
  }
  if (geometryCache.has(cacheKey)) return geometryCache.get(cacheKey);

  const position = mesh.geometry.getAttribute("position");
  const vertices = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    vertices[index * 3] = position.getX(index) * scale.x;
    vertices[index * 3 + 1] = position.getY(index) * scale.y;
    vertices[index * 3 + 2] = position.getZ(index) * scale.z;
  }
  const sourceIndex = mesh.geometry.getIndex();
  const indices = new Uint32Array(sourceIndex?.count ?? position.count);
  for (let index = 0; index < indices.length; index += 1) indices[index] = sourceIndex ? sourceIndex.getX(index) : index;
  const data = { vertices, indices, triangles: indices.length / 3 };
  geometryCache.set(cacheKey, data);
  return data;
}

function createPrimitiveDescriptor(spec) {
  if (spec.shape === "cylinder") return RAPIER.ColliderDesc.cylinder(spec.halfHeight, spec.radius);
  return RAPIER.ColliderDesc.ball(spec.radius);
}

function createPrimitiveDebugGeometry(spec) {
  if (spec.shape === "cylinder") return new THREE.CylinderGeometry(spec.radius, spec.radius, spec.halfHeight * 2, 20);
  return new THREE.SphereGeometry(spec.radius, 12, 8);
}

function createDebugMaterial(source) {
  const color = source === "supplemental-hand" ? 0xff4f87 : 0x22d8e6;
  return new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    opacity: source === "supplemental-hand" ? 0.58 : 0.34,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

function configureColliderDescriptor(descriptor) {
  return descriptor.setActiveCollisionTypes(
    RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED,
  );
}

export class G1ArticulatedCollisionRig {
  constructor(robot, { world = null, debugVisible = false } = {}) {
    const startedAt = performance.now();
    this.robot = robot;
    this.root = getModelRoot(robot);
    this.ownsWorld = !world;
    this.world = world ?? new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.parts = [];
    this.staticParts = [];
    this.missingSources = [];
    this.debugVisible = debugVisible;
    this.triangleCount = 0;
    this.#buildMeshColliders();
    this.#buildPrimitiveColliders();
    this.sync({ step: this.ownsWorld });
    this.buildDurationMs = performance.now() - startedAt;
    this.robot.userData.collisionRig = this;
  }

  #buildMeshColliders() {
    for (const spec of [...G1_MUJOCO_COLLISION_MESHES, ...G1_SUPPLEMENTAL_HAND_COLLISION_MESHES]) {
      const sourceMesh = this.root?.getObjectByName(spec.mesh);
      if (!sourceMesh?.isMesh) {
        this.missingSources.push(spec.mesh);
        continue;
      }
      sourceMesh.updateWorldMatrix(true, false);
      const triMeshData = getTriMeshData(sourceMesh);
      const rigidBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const descriptor = configureColliderDescriptor(RAPIER.ColliderDesc.trimesh(triMeshData.vertices, triMeshData.indices));
      const collider = this.world.createCollider(descriptor, rigidBody);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      const debugMesh = new THREE.Mesh(sourceMesh.geometry, createDebugMaterial(spec.source));
      debugMesh.name = `g1-collider-debug-${spec.name}`;
      debugMesh.position.copy(sourceMesh.position);
      debugMesh.quaternion.copy(sourceMesh.quaternion);
      debugMesh.scale.copy(sourceMesh.scale);
      debugMesh.renderOrder = 1000;
      debugMesh.visible = this.debugVisible;
      sourceMesh.parent.add(debugMesh);

      this.triangleCount += triMeshData.triangles;
      this.parts.push({ spec, source: sourceMesh, debugMesh, rigidBody, collider, sharedGeometry: true });
    }
  }

  #buildPrimitiveColliders() {
    for (const spec of G1_MUJOCO_PRIMITIVE_COLLIDERS) {
      const link = this.root?.getObjectByName(spec.link);
      if (!link) {
        this.missingSources.push(spec.link);
        continue;
      }
      const anchor = new THREE.Object3D();
      anchor.name = `g1-collider-anchor-${spec.name}`;
      anchor.position.fromArray(spec.center);
      if (spec.rotation) anchor.quaternion.fromArray(spec.rotation);
      link.add(anchor);

      const debugMesh = new THREE.Mesh(createPrimitiveDebugGeometry(spec), createDebugMaterial(spec.source));
      debugMesh.name = `g1-collider-debug-${spec.name}`;
      debugMesh.renderOrder = 1000;
      debugMesh.visible = this.debugVisible;
      anchor.add(debugMesh);

      const rigidBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const collider = this.world.createCollider(configureColliderDescriptor(createPrimitiveDescriptor(spec)), rigidBody);
      collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      this.parts.push({ spec, source: anchor, anchor, debugMesh, rigidBody, collider, sharedGeometry: false });
    }
  }

  sync({ step = this.ownsWorld } = {}) {
    this.robot.updateWorldMatrix(true, true);
    for (const part of this.parts) {
      const position = part.source.getWorldPosition(new THREE.Vector3());
      const quaternion = part.source.getWorldQuaternion(new THREE.Quaternion());
      part.rigidBody.setNextKinematicTranslation(position);
      part.rigidBody.setNextKinematicRotation(quaternion);
    }
    if (step) this.world.step();
  }

  setDebugVisible(visible) {
    this.debugVisible = Boolean(visible);
    for (const part of this.parts) part.debugMesh.visible = this.debugVisible;
  }

  getCollider(name) {
    return this.parts.find((part) => part.spec.name === name)?.collider ?? null;
  }

  getHandColliders(side = null) {
    return this.parts
      .filter((part) => part.spec.source === "supplemental-hand" && (!side || part.spec.name.startsWith(`${side}-`)))
      .map((part) => part.collider);
  }

  addStaticBox(position, size, name = "rf01-static") {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    const collider = this.world.createCollider(
      configureColliderDescriptor(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)),
      body,
    );
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const part = { name, body, collider };
    this.staticParts.push(part);
    return part;
  }

  getCollisionSummary() {
    return {
      total: this.parts.length,
      officialGeomCount: this.parts.filter((part) => part.spec.source === "mujoco").length,
      supplementalHandCount: this.parts.filter((part) => part.spec.source === "supplemental-hand").length,
      triangleCount: this.triangleCount,
      buildDurationMs: this.buildDurationMs,
      missingSources: [...new Set(this.missingSources)],
    };
  }

  dispose() {
    for (const part of this.staticParts) this.world.removeRigidBody(part.body);
    this.staticParts.length = 0;
    for (const part of this.parts) {
      part.anchor?.removeFromParent();
      part.debugMesh.removeFromParent();
      if (!part.sharedGeometry) part.debugMesh.geometry.dispose();
      part.debugMesh.material.dispose();
      if (!this.ownsWorld) this.world.removeRigidBody(part.rigidBody);
    }
    this.parts.length = 0;
    if (this.robot.userData.collisionRig === this) delete this.robot.userData.collisionRig;
    if (this.ownsWorld) this.world.free();
  }
}

export function createG1ArticulatedCollisionRig(robot, options) {
  return new G1ArticulatedCollisionRig(robot, options);
}
