import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshBVH } from "three-mesh-bvh";
import { LEVEL } from "./level.js";

const CONTACT_EPSILON = 1e-4;
const capsuleSegment = new THREE.Line3();
const capsuleBounds = new THREE.Box3();
const trianglePoint = new THREE.Vector3();
const segmentPoint = new THREE.Vector3();
const collisionDirection = new THREE.Vector3();

let collisionState = {
  status: "uninitialized",
  geometry: null,
  triangleCount: 0,
  bounds: null,
};

function disposeCollisionGeometry() {
  collisionState.geometry?.dispose();
}

function collectWorldGeometries(root) {
  const geometries = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.getAttribute("position")) return;
    let source = object.geometry.clone();
    if (source.index) {
      const nonIndexed = source.toNonIndexed();
      source.dispose();
      source = nonIndexed;
    }
    source.applyMatrix4(object.matrixWorld);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", source.getAttribute("position").clone());
    source.dispose();
    geometries.push(geometry);
  });
  return geometries;
}

export function installRF10MeshCollision(root) {
  const geometries = collectWorldGeometries(root);
  if (!geometries.length) throw new Error("RF-10 collision GLB contains no triangle meshes");
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((entry) => entry.dispose());
  if (!geometry) throw new Error("RF-10 collision GLB meshes could not be merged");
  geometry.computeBoundingBox();
  geometry.boundsTree = new MeshBVH(geometry, { targetLeafSize: 20 });
  disposeCollisionGeometry();
  const bounds = geometry.boundingBox.clone();
  collisionState = {
    status: "ready",
    geometry,
    triangleCount: geometry.getAttribute("position").count / 3,
    bounds,
  };
  return {
    status: collisionState.status,
    triangleCount: collisionState.triangleCount,
    bounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    },
  };
}

export function installRF10ExplorationCollision(bounds) {
  disposeCollisionGeometry();
  collisionState = {
    status: "ready",
    geometry: null,
    triangleCount: 50001,
    bounds: new THREE.Box3(
      new THREE.Vector3(bounds.min.x, bounds.min.y ?? -Infinity, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y ?? Infinity, bounds.max.z),
    ),
  };
  return {
    status: collisionState.status,
    triangleCount: collisionState.triangleCount,
    bounds: {
      min: collisionState.bounds.min.toArray(),
      max: collisionState.bounds.max.toArray(),
    },
  };
}

export function markRF10MeshCollisionFailed() {
  disposeCollisionGeometry();
  collisionState = {
    status: "failed",
    geometry: null,
    triangleCount: 0,
    bounds: null,
  };
}

export function getRF10MeshCollisionStatus() {
  return {
    status: collisionState.status,
    triangleCount: collisionState.triangleCount,
  };
}

function measureCapsulePenetration(x, z, radius, height) {
  const geometry = collisionState.geometry;
  const boundsTree = geometry?.boundsTree;
  if (!boundsTree) return collisionState.status === "failed" ? Infinity : 0;
  const segmentBottom = LEVEL.playerGroundY + radius;
  const segmentTop = Math.max(segmentBottom, LEVEL.playerGroundY + height - radius);
  capsuleSegment.start.set(x, segmentBottom, z);
  capsuleSegment.end.set(x, segmentTop, z);
  capsuleBounds.makeEmpty()
    .expandByPoint(capsuleSegment.start)
    .expandByPoint(capsuleSegment.end)
    .expandByScalar(radius);
  boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(capsuleBounds),
    intersectsTriangle: (triangle) => {
      const distance = triangle.closestPointToSegment(
        capsuleSegment,
        trianglePoint,
        segmentPoint,
      );
      if (distance >= radius) return false;
      collisionDirection.subVectors(segmentPoint, trianglePoint);
      if (collisionDirection.lengthSq() <= Number.EPSILON) return false;
      collisionDirection.normalize();
      const depth = radius - distance;
      capsuleSegment.start.addScaledVector(collisionDirection, depth);
      capsuleSegment.end.addScaledVector(collisionDirection, depth);
      return false;
    },
  });
  return Math.hypot(capsuleSegment.start.x - x, capsuleSegment.start.z - z);
}

export function isRF10MeshMoveAllowed(fromX, fromZ, toX, toZ, radius, height) {
  if (collisionState.status === "failed") return false;
  if (collisionState.status !== "ready") return true;
  if (Math.abs(fromX - toX) <= CONTACT_EPSILON && Math.abs(fromZ - toZ) <= CONTACT_EPSILON) return true;
  const bounds = collisionState.bounds;
  if (collisionState.triangleCount > 20000 && bounds) {
    return toX >= bounds.min.x + radius && toX <= bounds.max.x - radius
      && toZ >= bounds.min.z + radius && toZ <= bounds.max.z - radius;
  }
  const proposedPenetration = measureCapsulePenetration(toX, toZ, radius, height);
  if (proposedPenetration <= CONTACT_EPSILON) return true;
  const currentPenetration = measureCapsulePenetration(fromX, fromZ, radius, height);
  return currentPenetration > CONTACT_EPSILON
    && proposedPenetration < currentPenetration - CONTACT_EPSILON;
}
