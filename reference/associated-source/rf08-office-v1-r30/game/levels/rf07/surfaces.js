import * as THREE from "three";
import { RF07_SURFACE_ASSETS } from "./cardinal-assets.js";

const textureLoader = new THREE.TextureLoader();

function repeatedTexture(url, repeat, colorTexture = false) {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  if (colorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createEpoxyFloorMaterial() {
  const baseColor = repeatedTexture(RF07_SURFACE_ASSETS.floorBaseColor, [12, 8], true);
  const normal = repeatedTexture(RF07_SURFACE_ASSETS.floorNormal, [12, 8]);
  const roughness = repeatedTexture(RF07_SURFACE_ASSETS.floorRoughness, [12, 8]);
  const ao = repeatedTexture(RF07_SURFACE_ASSETS.floorAo, [12, 8]);
  ao.channel = 0;
  return new THREE.MeshStandardMaterial({
    color: 0xd2d7d4,
    map: baseColor,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.82,
    roughnessMap: roughness,
    metalness: 0.02,
    aoMap: ao,
    aoMapIntensity: 0.38,
  });
}

function wallTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const seam = Math.min(x, canvas.width - 1 - x);
      const variation = Math.sin(x * 0.071 + y * 0.019) * 1.4 + Math.sin(y * 0.043) * 0.8;
      let value;
      if (kind === "base") value = 236 + variation - Math.max(0, 5 - seam) * 3.2;
      else if (kind === "roughness") value = 184 + variation * 4 + Math.max(0, 4 - seam) * 7;
      else value = 128 + variation * 1.5 - Math.max(0, 4 - seam) * 3;
      const channel = THREE.MathUtils.clamp(Math.round(value), 0, 255);
      pixels.data[offset] = kind === "base" ? channel + 3 : channel;
      pixels.data[offset + 1] = kind === "base" ? channel + 2 : channel;
      pixels.data[offset + 2] = kind === "base" ? channel - 1 : channel;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  if (kind === "base") texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const wallSources = Object.freeze({
  base: wallTexture("base"),
  roughness: wallTexture("roughness"),
  bump: wallTexture("bump"),
});

function wallMap(source, panelCount) {
  const texture = source.clone();
  texture.repeat.set(panelCount, 1);
  texture.needsUpdate = true;
  return texture;
}

export function createCleanroomWallMaterial(panelCount) {
  return new THREE.MeshStandardMaterial({
    color: 0xf1f0ea,
    map: wallMap(wallSources.base, panelCount),
    roughness: 0.72,
    roughnessMap: wallMap(wallSources.roughness, panelCount),
    metalness: 0.01,
    bumpMap: wallMap(wallSources.bump, panelCount),
    bumpScale: 0.006,
  });
}

export function applyLaboratorySurfaceMaterials(model) {
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const floorMaterial = createEpoxyFloorMaterial();
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name.startsWith("Floor_Seam_")) {
      object.visible = false;
      return;
    }
    if (object.name === "Epoxy_Floor_24x16m") {
      object.material = floorMaterial;
      object.receiveShadow = true;
      return;
    }
    if (!/^(North_Wall|East_Wall|West_Wall|South_Wall_)/.test(object.name)) return;
    bounds.setFromObject(object).getSize(size);
    const panelCount = Math.max(1, Math.round(Math.max(size.x, size.z) / 1.2));
    object.material = createCleanroomWallMaterial(panelCount);
    object.receiveShadow = true;
  });
}
