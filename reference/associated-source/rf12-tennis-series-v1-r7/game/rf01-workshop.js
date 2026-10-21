import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RF01_YARD_LAYOUT } from "./rf01-yard-layout.js";
import { WORKSHOP } from "./rf01-shared-level.js";

function makeBox(parent, name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function splitPolygon(polygon, axis, boundary, direction) {
  const inside = [];
  const outside = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const distance = (current.position[axis] - boundary) * direction;
    const nextDistance = (next.position[axis] - boundary) * direction;
    (distance >= 0 ? inside : outside).push(current);
    if ((distance >= 0) !== (nextDistance >= 0)) {
      const fraction = distance / (distance - nextDistance);
      const vertex = {
        position: current.position.clone().lerp(next.position, fraction),
        normal: current.normal.clone().lerp(next.normal, fraction).normalize(),
        uv: current.uv.clone().lerp(next.uv, fraction),
      };
      inside.push(vertex);
      outside.push(vertex);
    }
  }
  return { inside, outside };
}

export function separateShutter(source) {
  source.updateWorldMatrix(true, false);
  const geometry = source.geometry;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const textureCoordinates = geometry.getAttribute("uv");
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(source.matrixWorld);
  const vertices = Array.from({ length: positions.count }, (_, index) => ({
    position: new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(source.matrixWorld),
    normal: new THREE.Vector3().fromBufferAttribute(normals, index).applyMatrix3(normalMatrix).normalize(),
    uv: new THREE.Vector2().fromBufferAttribute(textureCoordinates, index),
  }));
  const shellIndices = [];
  const doorIndices = [];
  const positionValues = vertices.flatMap(vertex => vertex.position.toArray());
  const normalValues = vertices.flatMap(vertex => vertex.normal.toArray());
  const uvValues = vertices.flatMap(vertex => vertex.uv.toArray());
  vertices.forEach((vertex, index) => { vertex.index = index; });
  const planes = [
    ["x", WORKSHOP.doorway.minX, 1], ["x", WORKSHOP.doorway.maxX, -1],
    ["y", .035, 1], ["y", WORKSHOP.height, -1],
    ["z", -1.95, 1], ["z", -.96, -1],
  ];
  function appendPolygon(polygon, target) {
    if (polygon.length < 3) return;
    const indices = polygon.map(vertex => {
      if (vertex.index === undefined) {
        vertex.index = positionValues.length / 3;
        positionValues.push(...vertex.position.toArray());
        normalValues.push(...vertex.normal.toArray());
        uvValues.push(...vertex.uv.toArray());
      }
      return vertex.index;
    });
    for (let index = 1; index < indices.length - 1; index += 1) target.push(indices[0], indices[index], indices[index + 1]);
  }
  const count = geometry.index?.count ?? positions.count;
  for (let offset = 0; offset < count; offset += 3) {
    const triangle = [0, 1, 2].map(step => vertices[geometry.index ? geometry.index.getX(offset + step) : offset + step]);
    if (planes.some(([axis, boundary, direction]) => triangle.every(vertex => (vertex.position[axis] - boundary) * direction < 0))) {
      appendPolygon(triangle, shellIndices);
      continue;
    }
    let polygon = triangle;
    for (const [axis, boundary, direction] of planes) {
      const split = splitPolygon(polygon, axis, boundary, direction);
      appendPolygon(split.outside, shellIndices);
      polygon = split.inside;
      if (polygon.length < 3) break;
    }
    appendPolygon(polygon, doorIndices);
  }
  if (doorIndices.length < 30) throw new Error("RF-01 workshop shutter could not be separated");
  const attributes = {
    position: new THREE.Float32BufferAttribute(positionValues, 3),
    normal: new THREE.Float32BufferAttribute(normalValues, 3),
    uv: new THREE.Float32BufferAttribute(uvValues, 2),
  };
  function meshFor(indices, name) {
    const result = new THREE.BufferGeometry();
    Object.entries(attributes).forEach(([key, value]) => result.setAttribute(key, value));
    result.setIndex(indices);
    result.computeBoundingBox();
    result.computeBoundingSphere();
    const mesh = new THREE.Mesh(result, source.material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  return { shell: meshFor(shellIndices, "workshop-original-shell"), door: meshFor(doorIndices, "workshop-original-shutter") };
}

async function addControl(parent, name, position, assetName, mountDepth, yaw = 0) {
  const url = assetName === "light-switch"
    ? "/local-assets/cardinal/rf01/models/runtime/workshop-v2-fit/light-switch.glb?v=20260919"
    : "/local-assets/cardinal/rf01/models/runtime/workshop-v2-fit/door-control.glb?v=20260919";
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.name = name;
  root.rotation.y = yaw;
  if (assetName === "light-switch") {
    root.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(root);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    root.scale.set(.32 / sourceSize.x, .42 / sourceSize.y, .14 / sourceSize.z);
    root.updateMatrixWorld(true);
    const fittedBounds = new THREE.Box3().setFromObject(root);
    const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
    root.position.set(position[0] - fittedCenter.x, position[1] - fittedCenter.y, position[2] - fittedCenter.z);
  } else {
    root.position.set(...position);
  }
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      material.envMapIntensity = assetName === "light-switch" ? .035 : .55;
      material.roughness = Math.max(material.roughness ?? .45, .38);
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    });
  });
  parent.add(root);
  const mounting = new THREE.MeshStandardMaterial({ color: 0x677073, roughness: .56, metalness: .6 });
  const isLightSwitch = assetName === "light-switch";
  if (!isLightSwitch) {
    makeBox(parent, name + "-mount", [.20, .25, mountDepth],
      [position[0], position[1], position[2] - Math.cos(yaw) * (.06 + mountDepth / 2)], mounting);
  }
  if (isLightSwitch) {
    makeBox(parent, name + "-mount", [.34, .38, .075],
      [position[0], position[1], position[2] - Math.cos(yaw) * .025], mounting);
    makeBox(parent, name + "-conduit", [.045, .34, .045],
      [position[0], position[1] - .29, position[2] - .025], mounting);
  }
  return { root, loaded: true, name: assetName, url };
}

export async function installWorkshopInterior(world) {
  const workshop = world.productionAssets.getObjectByName("rf01-cardinal-workshop-meter-fitted");
  if (!workshop) throw new Error("RF-01 workshop production asset missing");
  const root = new THREE.Group();
  root.name = "rf01-shared-workshop-interior";
  world.scene.add(root);
  const shutter = new THREE.Group();
  shutter.name = "rf01-workshop-rolling-shutter";
  root.add(shutter);
  const originals = [];
  workshop.traverse(object => { if (object.isMesh) originals.push(object); });
  for (const original of originals) {
    const separated = separateShutter(original);
    root.add(separated.shell);
    shutter.add(separated.door);
    original.visible = false;
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x5e686a, metalness: .7, roughness: .45 });
  [-.43, 3.78].forEach(position => makeBox(root, "shutter-guide", [.10, 2.45, .20], [position, 1.225, -1.27], steel));
  makeBox(root, "shutter-roller-housing", [4.34, .18, .27], [1.675, 2.46, -1.30], steel);
  const controls = await Promise.all([
    addControl(root, "workshop-door-control",
      [WORKSHOP.doorControl.x, WORKSHOP.doorControl.y, WORKSHOP.doorControl.z], "door-control", .14),
    addControl(root, "workshop-inner-door-control",
      [WORKSHOP.innerDoorControl.x, WORKSHOP.innerDoorControl.y, WORKSHOP.innerDoorControl.z], "door-control", .08, Math.PI),
    addControl(root, "workshop-light-switch",
      [WORKSHOP.lightSwitch.x, WORKSHOP.lightSwitch.y, WORKSHOP.lightSwitch.z], "light-switch", .06),
  ]);
  const [outsideButton, innerDoorButton, insideButton] = controls.map(control => control.root);
  const fixtures = world.productionAssets.children.filter(child => {
    let found = false;
    child.traverse(object => { if (object.name === "rf01-cardinal-lightFixture") found = true; });
    return found;
  });
  const bulbs = [];
  const lights = [];
  fixtures.forEach((fixture, index) => {
    const position = WORKSHOP.lampPositions[index];
    if (!position) return;
    fixture.position.set(...position);
    fixture.traverse(object => {
      if (!object.isMesh) return;
      object.material = object.material.clone();
      object.material.emissiveIntensity = 0;
    });
    const glow = new THREE.MeshStandardMaterial({ color: 0xb8c2c1, emissive: 0xffeed3, emissiveIntensity: 0, roughness: .58, metalness: .12 });
    bulbs.push(glow);
    const diffuser = new THREE.Mesh(new RoundedBoxGeometry(1.5, .045, .14, 4, .022), glow);
    diffuser.name = "workshop-light-diffuser-" + index;
    diffuser.position.set(position[0], 3.65, position[2]);
    diffuser.castShadow = true;
    diffuser.receiveShadow = true;
    root.add(diffuser);
    const light = new THREE.PointLight(0xffeedc, 0, 8, 2);
    light.position.set(position[0], 3.4, position[2]);
    light.castShadow = false;
    root.add(light);
    lights.push(light);
  });
  if (fixtures.length !== 3) throw new Error("RF-01 workshop requires all three existing light fixtures");
  const fillLight = new THREE.HemisphereLight(0xa9b8bc, 0x3e4748, .22);
  fillLight.position.set(0, 4, -4);
  root.add(fillLight);
  const result = { root, shutter, lights, bulbs, fillLight, outsideButton, innerDoorButton, insideButton, controls, fixtures, revision: RF01_YARD_LAYOUT.revision };
  setWorkshopLighting(result, false);
  syncWorkshopShutter(result, 0);
  return result;
}

export function syncWorkshopShutter(workshop, lift) {
  const height = Math.max(0, Math.min(WORKSHOP.height, lift));
  workshop.shutter.position.y = height;
  workshop.shutter.scale.y = Math.max(.012, (WORKSHOP.height - height) / WORKSHOP.height);
  workshop.outsideButton.userData.active = height >= WORKSHOP.clearance;
}

export function applyWorkshopAmbientOcclusion(scene) {
  const materials = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    entries.forEach(material => { if (material?.isMeshStandardMaterial) materials.add(material); });
  });
  materials.forEach(material => {
    if (material.userData.workshopOcclusion) return;
    material.userData.workshopOcclusion = true;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = function(shader, renderer) {
      previous.call(this, shader, renderer);
      shader.vertexShader = 'varying vec3 workshopWorldPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nworkshopWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'varying vec3 workshopWorldPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        float workshopInterior = (1.0 - smoothstep(4.5, 4.95, abs(workshopWorldPosition.x)))
          * (1.0 - smoothstep(3.8, 4.15, workshopWorldPosition.y))
          * smoothstep(-7.0, -6.8, workshopWorldPosition.z)
          * (1.0 - smoothstep(-1.9, -1.55, workshopWorldPosition.z));
        float workshopAmbient = mix(1.0, 0.09, workshopInterior);
        reflectedLight.indirectDiffuse *= workshopAmbient;
        reflectedLight.indirectSpecular *= workshopAmbient;
      `);
    };
    material.customProgramCacheKey = () => 'rf01-workshop-ambient-occlusion-v1';
    material.needsUpdate = true;
  });
}

export function setWorkshopLighting(workshop, enabled) {
  workshop.lights.forEach(light => { light.intensity = enabled ? 18 : .45; });
  workshop.bulbs.forEach(material => { material.emissiveIntensity = enabled ? 1.1 : .025; });
  if (workshop.fillLight) workshop.fillLight.intensity = enabled ? .12 : .055;
  workshop.insideButton.userData.active = enabled;
}
