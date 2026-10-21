import * as THREE from "three";
import { RF09_SURFACE_ASSETS } from "./cardinal-assets.js";

const textureLoader = new THREE.TextureLoader();

function repeatedTexture(url, repeat) {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function reliefTexture(kind, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const fiber = Math.sin(x * 0.71 + y * 0.17) * 4 + Math.sin(x * 0.13 - y * 0.49) * 3;
      const stipple = Math.sin(x * 0.19 + y * 0.37) * 2;
      const value = kind === "carpet" ? 128 + fiber : 128 + stipple;
      const channel = THREE.MathUtils.clamp(Math.round(value), 0, 255);
      pixels.data[offset] = channel;
      pixels.data[offset + 1] = channel;
      pixels.data[offset + 2] = channel;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function createCarpetMaterial() {
  const bump = reliefTexture("carpet");
  bump.repeat.set(13, 9);
  return new THREE.MeshStandardMaterial({
    color: 0xb6b3aa,
    map: repeatedTexture(RF09_SURFACE_ASSETS.carpetBaseColor, [13, 9]),
    roughness: 0.94,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 0.018,
  });
}

export function createPaintedWallMaterial(horizontalMeters = 10) {
  const repeat = [Math.max(1, horizontalMeters / 2), 1.65];
  const bump = reliefTexture("wall");
  bump.repeat.set(...repeat);
  return new THREE.MeshStandardMaterial({
    color: 0xf0ede5,
    map: repeatedTexture(RF09_SURFACE_ASSETS.wallBaseColor, repeat),
    roughness: 0.86,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 0.006,
  });
}
