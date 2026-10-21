import assert from "node:assert/strict";
import test from "node:test";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  createG1ArticulatedCollisionRig,
  G1_ARTICULATED_COLLIDER_SPECS,
  G1_MUJOCO_COLLISION_MESHES,
  G1_MUJOCO_PRIMITIVE_COLLIDERS,
  G1_SUPPLEMENTAL_HAND_COLLISION_MESHES,
} from "../game/g1-articulated-collision.js";

function createRobotWithCollisionSources() {
  const robot = new THREE.Group();
  robot.name = "unitree-g1-edu2-dex1-web";
  robot.position.set(1.2, 0.4, -0.8);
  const official = new THREE.Group();
  official.scale.x = -1;
  robot.add(official);

  const links = new Map();
  for (const linkName of new Set(G1_ARTICULATED_COLLIDER_SPECS.map((spec) => spec.link))) {
    const link = new THREE.Group();
    link.name = linkName;
    official.add(link);
    links.set(linkName, link);
  }
  for (const spec of [...G1_MUJOCO_COLLISION_MESHES, ...G1_SUPPLEMENTAL_HAND_COLLISION_MESHES]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06));
    mesh.name = spec.mesh;
    links.get(spec.link).add(mesh);
  }
  return robot;
}

test("G1 collision specification mirrors MuJoCo geoms and only supplements missing hands", () => {
  assert.equal(G1_MUJOCO_COLLISION_MESHES.length, 25);
  assert.equal(G1_MUJOCO_PRIMITIVE_COLLIDERS.length, 12);
  assert.equal(G1_SUPPLEMENTAL_HAND_COLLISION_MESHES.length, 2);
  assert.equal(G1_ARTICULATED_COLLIDER_SPECS.length, 39);
  assert.ok(G1_MUJOCO_COLLISION_MESHES.every((spec) => spec.shape === "trimesh" && spec.source === "mujoco"));
  assert.ok(G1_SUPPLEMENTAL_HAND_COLLISION_MESHES.every((spec) => spec.source === "supplemental-hand"));
});

test("official trimesh bodies follow links and collide with fixed scene geometry", () => {
  const robot = createRobotWithCollisionSources();
  const rig = createG1ArticulatedCollisionRig(robot);
  const summary = rig.getCollisionSummary();
  assert.equal(summary.total, 39);
  assert.equal(summary.officialGeomCount, 37);
  assert.equal(summary.supplementalHandCount, 2);
  assert.equal(summary.triangleCount, 27 * 12);
  assert.deepEqual(summary.missingSources, []);
  assert.equal(rig.getHandColliders("left").length, 1);

  const pelvisCollider = rig.getCollider("pelvis-contour");
  assert.equal(pelvisCollider.shape.type, RAPIER.ShapeType.TriMesh);
  const pelvisBody = rig.parts.find((part) => part.spec.name === "pelvis-contour").rigidBody;
  const before = pelvisBody.translation();
  robot.position.x += 0.5;
  rig.sync();
  const after = pelvisBody.translation();
  assert.ok(Math.abs(after.x - before.x - 0.5) < 1e-5);

  const pelvisPosition = pelvisCollider.translation();
  const obstacle = rig.world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.05, 0.05, 0.05).setTranslation(
      pelvisPosition.x,
      pelvisPosition.y,
      pelvisPosition.z,
    ),
  );
  rig.world.step();
  let touchesObstacle = false;
  rig.world.contactPairsWith(pelvisCollider, (other) => {
    if (other.handle === obstacle.handle) touchesObstacle = true;
  });
  assert.equal(touchesObstacle, true);
  rig.dispose();
});

test("G1 collision rig accepts fixed RF-01 scene boxes", () => {
  const robot = createRobotWithCollisionSources();
  const rig = createG1ArticulatedCollisionRig(robot);
  const obstacle = rig.addStaticBox([0, 0, 0], [2, 2, 2], "wall");
  assert.equal(obstacle.collider.shape.type, RAPIER.ShapeType.Cuboid);
  assert.equal(rig.staticParts.length, 1);
  assert.equal(rig.world.colliders.len(), 40);
  rig.dispose();
});
