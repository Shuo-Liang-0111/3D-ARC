import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const [red, green, blue] = hexToRgb(source);
  return new THREE.Color(red / 255, green / 255, blue / 255);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Unitree G1 EDU2
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createUnitreeG1EDU2Model(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Unitree G1 EDU2";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "analysisArtifact": "./.img2threejs/g1-edu2/material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "torso-shell", "regionId": "silver-armour-clean", "specMaterialId": "silver-armour", "profileId": "coating.painted-metal", "status": "proceed"}, {"componentId": "waist-mid", "regionId": "graphite-actuator-clean", "specMaterialId": "graphite-mechanism", "profileId": "metal.aluminum", "status": "proceed"}, {"componentId": "palm-l", "regionId": "dex3-black-elastomer", "specMaterialId": "black-elastomer", "profileId": "rubber.matte", "status": "proceed"}, {"componentId": "face-glazing", "regionId": "sensor-dark-glazing", "specMaterialId": "sensor-glazing", "profileId": "glass.clear", "status": "proceed"}, {"componentId": "cyan-perimeter", "regionId": "cyan-light-guide", "specMaterialId": "cyan-emission", "profileId": "plastic.glossy", "status": "proceed"}], "controlledViewsRequired": ["albedo-unlit", "backlight-transmission", "environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {"id": "hidden", "name": "Hidden", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#000000"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 1.0, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/01-graphite-actuator-clean.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.909, "estimatedFidelity": 0.909, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates. This evidence is inherited only to satisfy the non-rendered scene-group proxy; hidden emits no pixels.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_albedo.png", "url": "graphite-mechanism_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_roughness.png", "url": "graphite-mechanism_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_height.png", "url": "graphite-mechanism_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_normal.png", "url": "graphite-mechanism_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_ao.png", "url": "graphite-mechanism_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 470, "sourceHeight": 330, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 470, "height": 330}, "mask": {"backgroundColor": "#232227", "backgroundNoise": 60.737, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.3417}, "mapStats": {"valueRange": 0.7222, "heightP90Gradient": 0.1259, "roughnessBase": 0.704, "roughnessVariation": 0.197, "normalStrength": 0.304, "blurRadius": 10}, "palette": ["#0E0D12", "#848491", "#B9B9C4", "#393947", "#5B596F"]}, "warnings": [], "proxyForInvisibleGroup": true}},
    options
  );
  materialMap["silver-armour"] = createSculptMaterial(
    "silver-armour",
    {"id": "silver-armour", "name": "Silver Armour", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#B9BEC3", "color": "#B9BEC3", "albedo": {"dominant": "#B9BEC3", "secondary": ["#B9BEC3"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#B9BEC3"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.45, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 0.0, "variation": 0.03}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [{"id": "silver-armour.satinGrain", "roughness": 0.31, "description": "Broad cool satin highlight with extremely fine grain; no brushed-metal stripes."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "referenceMaterialId": "coating.painted-metal", "materialFamily": "coating", "materialSubtype": "paint-over-metal", "materialFinish": "gloss-or-satin", "materialReference": {"registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "profileId": "coating.painted-metal", "method": "family-subtype-finish", "confidence": 0.834, "sourceRefs": ["three.mesh-physical", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-1", "adobe.pbr-guide-2"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap", "clearcoatRoughnessMap", "metalnessMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.75, "variation": 0.0}, "clearcoatRoughness": {"base": 0.12, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/00-silver-armour-clean.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.834, "estimatedFidelity": 0.834, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-00-silver-armour-clean/silver-armour_albedo.png", "url": "silver-armour_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-00-silver-armour-clean/silver-armour_roughness.png", "url": "silver-armour_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-00-silver-armour-clean/silver-armour_height.png", "url": "silver-armour_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-00-silver-armour-clean/silver-armour_normal.png", "url": "silver-armour_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-00-silver-armour-clean/silver-armour_ao.png", "url": "silver-armour_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 330, "sourceHeight": 260, "mapSize": 512, "cropBBoxPixels": {"x": 233, "y": 0, "width": 97, "height": 260}, "mask": {"backgroundColor": "#646573", "backgroundNoise": 12.207, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.11}, "mapStats": {"valueRange": 0.1787, "heightP90Gradient": 0.01936, "roughnessBase": 0.68, "roughnessVariation": 0.05, "normalStrength": 0.179, "blurRadius": 10}, "palette": ["#787783", "#80808B", "#8B8B96", "#9C9CA6", "#35353B"]}, "warnings": ["low value range weakens height/roughness inference"]}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#62626A", "#787882", "#787882", "#757580", "#6D6D7A"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 119.7, "meanSaturation": 0.082, "gradientStrength": 0.122, "mottle": 0.005, "streakRatio": 0.75, "hueSpread": 0.006, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "torso-shell", "regionId": "silver-armour-clean", "crop": {"path": "./.img2threejs/g1-edu2/material-evidence/00-silver-armour-clean.png", "bbox": {"x": 1580, "y": 40, "width": 330, "height": 260}, "sourceWidth": 2740, "sourceHeight": 1720, "loaderWarnings": [], "coverage": 0.0182}, "observations": ["near-neutral colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "torso-shell", "regionId": "silver-armour-clean", "materialId": null, "family": "coating", "subtype": "paint-over-metal", "finish": "gloss-or-satin", "aliases": [], "confidence": 0.834, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["graphite-mechanism"] = createSculptMaterial(
    "graphite-mechanism",
    {"id": "graphite-mechanism", "name": "Graphite Mechanism", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#202327", "color": "#202327", "albedo": {"dominant": "#202327", "secondary": ["#202327"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#202327"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.3, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 1.0, "variation": 0.03}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [{"id": "graphite-mechanism.roughnessZones", "roughness": 0.46, "description": "Textured actuator faces with slightly smoother machined ring edges."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "referenceMaterialId": "metal.aluminum", "materialFamily": "metal", "materialSubtype": "aluminum", "materialFinish": "satin", "materialReference": {"registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "profileId": "metal.aluminum", "method": "family-subtype-finish", "confidence": 0.909, "sourceRefs": ["three.mesh-standard", "three.pmrem", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "anisotropyMap"], "validationViews": ["neutral-studio", "environment-reflection", "grazing"]}, "anisotropy": {"base": 0.2, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/01-graphite-actuator-clean.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.909, "estimatedFidelity": 0.909, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_albedo.png", "url": "graphite-mechanism_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_roughness.png", "url": "graphite-mechanism_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_height.png", "url": "graphite-mechanism_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_normal.png", "url": "graphite-mechanism_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-01-graphite-actuator-clean/graphite-mechanism_ao.png", "url": "graphite-mechanism_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 470, "sourceHeight": 330, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 0, "width": 470, "height": 330}, "mask": {"backgroundColor": "#232227", "backgroundNoise": 60.737, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.3417}, "mapStats": {"valueRange": 0.7222, "heightP90Gradient": 0.1259, "roughnessBase": 0.704, "roughnessVariation": 0.197, "normalStrength": 0.304, "blurRadius": 10}, "palette": ["#0E0D12", "#848491", "#B9B9C4", "#393947", "#5B596F"]}, "warnings": []}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#6E6E7A", "#585761", "#3E3D46", "#3F3F44", "#1D1C21"], "paletteHueRisk": [{"stop": "#1D1C21", "hueRisk": "blue-collapse", "suggestedRgb": [33, 28, 29]}], "gradientAxis": "horizontal", "stats": {"meanLum": 69.3, "meanSaturation": 0.123, "gradientStrength": 0.329, "mottle": 0.037, "streakRatio": 0.97, "hueSpread": 0.007, "specularFraction": 0.003}}, "materialEvidence": {"componentId": "waist-mid", "regionId": "graphite-actuator-clean", "crop": {"path": "./.img2threejs/g1-edu2/material-evidence/01-graphite-actuator-clean.png", "bbox": {"x": 700, "y": 650, "width": 470, "height": 330}, "sourceWidth": 2740, "sourceHeight": 1720, "loaderWarnings": [], "coverage": 0.0329}, "observations": ["near-neutral colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "waist-mid", "regionId": "graphite-actuator-clean", "materialId": null, "family": "metal", "subtype": "aluminum", "finish": "satin", "aliases": [], "confidence": 0.909, "source": "vision"}, "alternatives": []}, "needsEnvironment": true},
    options
  );
  materialMap["black-elastomer"] = createSculptMaterial(
    "black-elastomer",
    {"id": "black-elastomer", "name": "Black Elastomer", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#101215", "color": "#101215", "albedo": {"dominant": "#101215", "secondary": ["#101215"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#101215"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.88, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 0.0, "variation": 0.03}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "referenceMaterialId": "rubber.matte", "materialFamily": "rubber", "materialSubtype": "generic-elastomer", "materialFinish": "matte", "materialReference": {"registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "profileId": "rubber.matte", "method": "family-subtype-finish", "confidence": 0.909, "sourceRefs": ["three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap", "normalMap"], "optionalMaps": ["aoMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing", "reference-beauty"]}, "ior": {"base": 1.48, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/02-dex3-black-elastomer.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.909, "estimatedFidelity": 0.909, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-02-dex3-black-elastomer/black-elastomer_albedo.png", "url": "black-elastomer_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-02-dex3-black-elastomer/black-elastomer_roughness.png", "url": "black-elastomer_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-02-dex3-black-elastomer/black-elastomer_height.png", "url": "black-elastomer_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-02-dex3-black-elastomer/black-elastomer_normal.png", "url": "black-elastomer_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-02-dex3-black-elastomer/black-elastomer_ao.png", "url": "black-elastomer_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 450, "sourceHeight": 255, "mapSize": 512, "cropBBoxPixels": {"x": 0, "y": 68, "width": 450, "height": 187}, "mask": {"backgroundColor": "#F0F1F3", "backgroundNoise": 51.981, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.3438}, "mapStats": {"valueRange": 0.5012, "heightP90Gradient": 0.06848, "roughnessBase": 0.688, "roughnessVariation": 0.118, "normalStrength": 0.237, "blurRadius": 10}, "palette": ["#2B2B2C", "#161618", "#4D4F53", "#070707", "#83868C"]}, "warnings": []}, "textureAnalysis": {"finishClass": "brushed-steel", "recipe": {"metalness": 1.0, "roughness": 0.35, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 1.0, "procedural": "brushed"}, "palette": ["#E5E6E9", "#4E4E50", "#59595B", "#B4B5B7", "#EBECEE"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 148.8, "meanSaturation": 0.028, "gradientStrength": 0.773, "mottle": 0.05, "streakRatio": 1.27, "hueSpread": 0.0, "specularFraction": 0.502}}, "materialEvidence": {"componentId": "palm-l", "regionId": "dex3-black-elastomer", "crop": {"path": "./.img2threejs/g1-edu2/material-evidence/02-dex3-black-elastomer.png", "bbox": {"x": 110, "y": 260, "width": 450, "height": 255}, "sourceWidth": 2004, "sourceHeight": 1470, "loaderWarnings": [], "coverage": 0.039}, "observations": ["near-neutral colour response", "visible meso/micro variation", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "palm-l", "regionId": "dex3-black-elastomer", "materialId": null, "family": "rubber", "subtype": "generic-elastomer", "finish": "matte", "aliases": [], "confidence": 0.909, "source": "vision"}, "alternatives": []}},
    options
  );
  materialMap["sensor-glazing"] = createSculptMaterial(
    "sensor-glazing",
    {"id": "sensor-glazing", "name": "Sensor Glazing", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#07181D", "color": "#07181D", "albedo": {"dominant": "#07181D", "secondary": ["#07181D"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#07181D"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.05, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 0.0, "variation": 0.03}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [{"id": "sensor-glazing.cyanPerimeter", "roughness": 0.16, "emissive": "#20E8F2", "emissiveIntensity": 1.8, "description": "Cyan U-shaped helmet light guide seen in official images."}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "referenceMaterialId": "glass.clear", "materialFamily": "glass", "materialSubtype": "clear", "materialFinish": "polished", "materialReference": {"registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "profileId": "glass.clear", "method": "family-subtype-finish", "confidence": 0.909, "sourceRefs": ["three.mesh-physical", "three.pmrem", "gltf.2", "khronos.transmission", "khronos.volume", "google.filament-pbr"], "requiredMaps": ["roughnessMap", "thicknessMap"], "optionalMaps": ["map", "normalMap", "transmissionMap"], "validationViews": ["neutral-studio", "environment-reflection", "backlight-transmission", "reference-beauty"]}, "transmission": {"base": 1.0, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/03-sensor-dark-glazing.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.909, "estimatedFidelity": 0.909, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-03-sensor-dark-glazing/sensor-glazing_albedo.png", "url": "sensor-glazing_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-03-sensor-dark-glazing/sensor-glazing_roughness.png", "url": "sensor-glazing_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-03-sensor-dark-glazing/sensor-glazing_height.png", "url": "sensor-glazing_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-03-sensor-dark-glazing/sensor-glazing_normal.png", "url": "sensor-glazing_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-03-sensor-dark-glazing/sensor-glazing_ao.png", "url": "sensor-glazing_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 270, "sourceHeight": 355, "mapSize": 512, "cropBBoxPixels": {"x": 75, "y": 8, "width": 195, "height": 347}, "mask": {"backgroundColor": "#F0F1F6", "backgroundNoise": 27.185, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.2737}, "mapStats": {"valueRange": 0.5877, "heightP90Gradient": 0.12345, "roughnessBase": 0.696, "roughnessVariation": 0.198, "normalStrength": 0.301, "blurRadius": 10}, "palette": ["#353A46", "#1D1F25", "#5B626E", "#94A5B2", "#1D3568"]}, "warnings": []}, "textureAnalysis": {"finishClass": "brushed-steel", "recipe": {"metalness": 1.0, "roughness": 0.35, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 1.0, "procedural": "brushed"}, "palette": ["#DFE0E4", "#F3F4F6", "#919294", "#797B82", "#58739A"], "paletteHueRisk": [{"stop": "#58739A", "hueRisk": "blue-collapse", "suggestedRgb": [154, 115, 88]}], "gradientAxis": "vertical", "stats": {"meanLum": 175.6, "meanSaturation": 0.108, "gradientStrength": 0.64, "mottle": 0.082, "streakRatio": 0.74, "hueSpread": 0.009, "specularFraction": 0.485}}, "materialEvidence": {"componentId": "face-glazing", "regionId": "sensor-dark-glazing", "crop": {"path": "./.img2threejs/g1-edu2/material-evidence/03-sensor-dark-glazing.png", "bbox": {"x": 1480, "y": 810, "width": 270, "height": 355}, "sourceWidth": 2004, "sourceHeight": 1470, "loaderWarnings": [], "coverage": 0.0325}, "observations": ["near-neutral colour response", "visible meso/micro variation", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "face-glazing", "regionId": "sensor-dark-glazing", "materialId": null, "family": "glass", "subtype": "clear", "finish": "polished", "aliases": [], "confidence": 0.909, "source": "vision"}, "alternatives": []}, "needsEnvironment": true},
    options
  );
  materialMap["cyan-emission"] = createSculptMaterial(
    "cyan-emission",
    {"id": "cyan-emission", "name": "Cyan Emission", "type": "physical", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#20E8F2", "color": "#20E8F2", "albedo": {"dominant": "#20E8F2", "secondary": ["#20E8F2"], "samplingNotes": "Official Unitree G1 product imagery; exact crop evidence is wired in material-evidence stage."}, "colorVariation": {"palette": ["#20E8F2"], "pattern": "none", "amplitude": 0.0, "heightCorrelation": 0.0}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad color and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "ridges, pores, grain, dents, or equivalent visible relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "highlight breakup visible under grazing light"}], "roughness": {"base": 0.28, "variation": 0.035, "map": "independent-procedural-field", "localResponse": "clean manufactured surface; broad highlight response"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#000000"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Clean factory-new G1 EDU surface. No invented dirt, damage, or weathering.", "emissive": "#20E8F2", "emissiveIntensity": 1.8, "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "/path/to/arc-workspace/img2threejs-skill/docs/materials/material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.831, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "referencePbr": {"version": "1.0", "sourceImage": "./.img2threejs/g1-edu2/material-evidence/04-cyan-light-guide.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.831, "estimatedFidelity": 0.831, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-04-cyan-light-guide/cyan-emission_albedo.png", "url": "cyan-emission_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-04-cyan-light-guide/cyan-emission_roughness.png", "url": "cyan-emission_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-04-cyan-light-guide/cyan-emission_height.png", "url": "cyan-emission_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-04-cyan-light-guide/cyan-emission_normal.png", "url": "cyan-emission_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "./.img2threejs/g1-edu2/material-evidence/pbr-04-cyan-light-guide/cyan-emission_ao.png", "url": "cyan-emission_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 245, "sourceHeight": 135, "mapSize": 512, "cropBBoxPixels": {"x": 88, "y": 0, "width": 157, "height": 135}, "mask": {"backgroundColor": "#F2F3F5", "backgroundNoise": 139.793, "transparentPixelFraction": 0.0, "foregroundCoverage": 0.0895}, "mapStats": {"valueRange": 0.1101, "heightP90Gradient": 0.11018, "roughnessBase": 0.68, "roughnessVariation": 0.176, "normalStrength": 0.285, "blurRadius": 10}, "palette": ["#242526", "#181819", "#1D1D1F", "#0F0F10", "#2C2D2D"]}, "warnings": ["low value range weakens height/roughness inference"]}, "textureAnalysis": {"finishClass": "brushed-steel", "recipe": {"metalness": 1.0, "roughness": 0.35, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 1.0, "procedural": "brushed"}, "palette": ["#8F9092", "#F2F3F5", "#7F7F81", "#F1F2F4", "#8C8E93"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 193.5, "meanSaturation": 0.024, "gradientStrength": 0.586, "mottle": 0.097, "streakRatio": 0.98, "hueSpread": 0.0, "specularFraction": 0.683}}, "materialEvidence": {"componentId": "cyan-perimeter", "regionId": "cyan-light-guide", "crop": {"path": "./.img2threejs/g1-edu2/material-evidence/04-cyan-light-guide.png", "bbox": {"x": 1490, "y": 925, "width": 245, "height": 135}, "sourceWidth": 2004, "sourceHeight": 1470, "loaderWarnings": [], "coverage": 0.0112}, "observations": ["near-neutral colour response", "visible meso/micro variation", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "cyan-perimeter", "regionId": "cyan-light-guide", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.831, "source": "vision"}, "alternatives": []}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "G1 EDU2 root__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "G1 EDU2 root", "level": "macro", "role": "assembly-root", "importance": 1.0, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show G1 EDU2 root as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 1.32, "depth": 0.2, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "G1 EDU2 root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "G1 EDU2 root", "level": "macro", "role": "assembly-root", "importance": 1.0, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show G1 EDU2 root as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": null, "attachment": null, "dimensions": {"width": 0.45, "height": 1.32, "depth": 0.2, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_sensor_head_1 = {"parentId": "root", "parentSocket": "root-to-sensor-head", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_sensor_head_1 = makeAttachmentEndpoint(attachment_sensor_head_1);
  const node_sensor_head_1 = new THREE.Group();
  node_sensor_head_1.name = "Sensor head assembly__pivot";
  node_sensor_head_1.scale.set(1, 1, 1);
  if (endpoint_sensor_head_1) {
    node_sensor_head_1.position.copy(endpoint_sensor_head_1.start);
    node_sensor_head_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sensor_head_1.position.set(0.0, 1.205, 0.0);
    node_sensor_head_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_sensor_head_1.userData.sculptComponent = {"id": "sensor-head", "name": "Sensor head assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Sensor head assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-sensor-head", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.205, "height": 0.17, "depth": 0.195, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 1.205, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_sensor_head_1.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_sensor_head_1);
  nodes["sensor-head"] = node_sensor_head_1;
  const mesh_sensor_head_1Geometry = endpoint_sensor_head_1
    ? new THREE.CylinderGeometry(endpoint_sensor_head_1.endRadius, endpoint_sensor_head_1.baseRadius, endpoint_sensor_head_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_sensor_head_1) {
    mesh_sensor_head_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sensor_head_1 = new THREE.Mesh(
    mesh_sensor_head_1Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sensor_head_1.name = "Sensor head assembly";
  if (endpoint_sensor_head_1) {
    mesh_sensor_head_1.position.copy(endpoint_sensor_head_1.midpoint);
    mesh_sensor_head_1.quaternion.copy(endpoint_sensor_head_1.quaternion);
  }
  mesh_sensor_head_1.castShadow = options.castShadow ?? true;
  mesh_sensor_head_1.receiveShadow = options.receiveShadow ?? true;
  mesh_sensor_head_1.userData.sculptComponent = {"id": "sensor-head", "name": "Sensor head assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Sensor head assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-sensor-head", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.205, "height": 0.17, "depth": 0.195, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 1.205, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_sensor_head_1.add(mesh_sensor_head_1);
  meshes["sensor-head"] = mesh_sensor_head_1;
  colliders["sensor-head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_sensor_head_1);

  const attachment_torso_2 = {"parentId": "root", "parentSocket": "root-to-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_torso_2 = makeAttachmentEndpoint(attachment_torso_2);
  const node_torso_2 = new THREE.Group();
  node_torso_2.name = "Tapered torso assembly__pivot";
  node_torso_2.scale.set(1, 1, 1);
  if (endpoint_torso_2) {
    node_torso_2.position.copy(endpoint_torso_2.start);
    node_torso_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_torso_2.position.set(0.0, 0.92, 0.0);
    node_torso_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_torso_2.userData.sculptComponent = {"id": "torso", "name": "Tapered torso assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Tapered torso assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.36, "height": 0.33, "depth": 0.18, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.92, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_torso_2.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_torso_2);
  nodes["torso"] = node_torso_2;
  const mesh_torso_2Geometry = endpoint_torso_2
    ? new THREE.CylinderGeometry(endpoint_torso_2.endRadius, endpoint_torso_2.baseRadius, endpoint_torso_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_torso_2) {
    mesh_torso_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_torso_2 = new THREE.Mesh(
    mesh_torso_2Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_torso_2.name = "Tapered torso assembly";
  if (endpoint_torso_2) {
    mesh_torso_2.position.copy(endpoint_torso_2.midpoint);
    mesh_torso_2.quaternion.copy(endpoint_torso_2.quaternion);
  }
  mesh_torso_2.castShadow = options.castShadow ?? true;
  mesh_torso_2.receiveShadow = options.receiveShadow ?? true;
  mesh_torso_2.userData.sculptComponent = {"id": "torso", "name": "Tapered torso assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Tapered torso assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-torso", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.36, "height": 0.33, "depth": 0.18, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.92, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_torso_2.add(mesh_torso_2);
  meshes["torso"] = mesh_torso_2;
  colliders["torso"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_torso_2);

  const attachment_waist_stack_3 = {"parentId": "root", "parentSocket": "root-to-waist-stack", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_waist_stack_3 = makeAttachmentEndpoint(attachment_waist_stack_3);
  const node_waist_stack_3 = new THREE.Group();
  node_waist_stack_3.name = "Three-axis waist stack__pivot";
  node_waist_stack_3.scale.set(1, 1, 1);
  if (endpoint_waist_stack_3) {
    node_waist_stack_3.position.copy(endpoint_waist_stack_3.start);
    node_waist_stack_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_waist_stack_3.position.set(0.0, 0.7, 0.0);
    node_waist_stack_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_waist_stack_3.userData.sculptComponent = {"id": "waist-stack", "name": "Three-axis waist stack", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Three-axis waist stack as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-waist-stack", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.19, "height": 0.16, "depth": 0.15, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.7, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_waist_stack_3.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_waist_stack_3);
  nodes["waist-stack"] = node_waist_stack_3;
  const mesh_waist_stack_3Geometry = endpoint_waist_stack_3
    ? new THREE.CylinderGeometry(endpoint_waist_stack_3.endRadius, endpoint_waist_stack_3.baseRadius, endpoint_waist_stack_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_waist_stack_3) {
    mesh_waist_stack_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_waist_stack_3 = new THREE.Mesh(
    mesh_waist_stack_3Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_waist_stack_3.name = "Three-axis waist stack";
  if (endpoint_waist_stack_3) {
    mesh_waist_stack_3.position.copy(endpoint_waist_stack_3.midpoint);
    mesh_waist_stack_3.quaternion.copy(endpoint_waist_stack_3.quaternion);
  }
  mesh_waist_stack_3.castShadow = options.castShadow ?? true;
  mesh_waist_stack_3.receiveShadow = options.receiveShadow ?? true;
  mesh_waist_stack_3.userData.sculptComponent = {"id": "waist-stack", "name": "Three-axis waist stack", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Three-axis waist stack as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-waist-stack", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.19, "height": 0.16, "depth": 0.15, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.7, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_waist_stack_3.add(mesh_waist_stack_3);
  meshes["waist-stack"] = mesh_waist_stack_3;
  colliders["waist-stack"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_waist_stack_3);

  const attachment_pelvis_4 = {"parentId": "root", "parentSocket": "root-to-pelvis", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_pelvis_4 = makeAttachmentEndpoint(attachment_pelvis_4);
  const node_pelvis_4 = new THREE.Group();
  node_pelvis_4.name = "Compact pelvis assembly__pivot";
  node_pelvis_4.scale.set(1, 1, 1);
  if (endpoint_pelvis_4) {
    node_pelvis_4.position.copy(endpoint_pelvis_4.start);
    node_pelvis_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pelvis_4.position.set(0.0, 0.585, 0.0);
    node_pelvis_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_pelvis_4.userData.sculptComponent = {"id": "pelvis", "name": "Compact pelvis assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Compact pelvis assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-pelvis", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.29, "height": 0.19, "depth": 0.17, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.585, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_pelvis_4.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_pelvis_4);
  nodes["pelvis"] = node_pelvis_4;
  const mesh_pelvis_4Geometry = endpoint_pelvis_4
    ? new THREE.CylinderGeometry(endpoint_pelvis_4.endRadius, endpoint_pelvis_4.baseRadius, endpoint_pelvis_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pelvis_4) {
    mesh_pelvis_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_pelvis_4 = new THREE.Mesh(
    mesh_pelvis_4Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pelvis_4.name = "Compact pelvis assembly";
  if (endpoint_pelvis_4) {
    mesh_pelvis_4.position.copy(endpoint_pelvis_4.midpoint);
    mesh_pelvis_4.quaternion.copy(endpoint_pelvis_4.quaternion);
  }
  mesh_pelvis_4.castShadow = options.castShadow ?? true;
  mesh_pelvis_4.receiveShadow = options.receiveShadow ?? true;
  mesh_pelvis_4.userData.sculptComponent = {"id": "pelvis", "name": "Compact pelvis assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Compact pelvis assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "root-to-pelvis", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.29, "height": 0.19, "depth": 0.17, "units": "meters", "confidence": 0.88}, "transform": {"position": [0, 0.585, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_pelvis_4.add(mesh_pelvis_4);
  meshes["pelvis"] = mesh_pelvis_4;
  colliders["pelvis"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_pelvis_4);

  const attachment_arm_l_5 = {"parentId": "torso", "parentSocket": "torso-to-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_arm_l_5 = makeAttachmentEndpoint(attachment_arm_l_5);
  const node_arm_l_5 = new THREE.Group();
  node_arm_l_5.name = "Left arm assembly__pivot";
  node_arm_l_5.scale.set(1, 1, 1);
  if (endpoint_arm_l_5) {
    node_arm_l_5.position.copy(endpoint_arm_l_5.start);
    node_arm_l_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arm_l_5.position.set(-0.25, 0.88, 0.0);
    node_arm_l_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_arm_l_5.userData.sculptComponent = {"id": "arm-l", "name": "Left arm assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Left arm assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "torso", "attachment": {"parentId": "torso", "parentSocket": "torso-to-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.13, "height": 0.6, "depth": 0.14, "units": "meters", "confidence": 0.88}, "transform": {"position": [-0.25, 0.88, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_arm_l_5.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["torso"] ?? root).add(node_arm_l_5);
  nodes["arm-l"] = node_arm_l_5;
  const mesh_arm_l_5Geometry = endpoint_arm_l_5
    ? new THREE.CylinderGeometry(endpoint_arm_l_5.endRadius, endpoint_arm_l_5.baseRadius, endpoint_arm_l_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_arm_l_5) {
    mesh_arm_l_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_arm_l_5 = new THREE.Mesh(
    mesh_arm_l_5Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_l_5.name = "Left arm assembly";
  if (endpoint_arm_l_5) {
    mesh_arm_l_5.position.copy(endpoint_arm_l_5.midpoint);
    mesh_arm_l_5.quaternion.copy(endpoint_arm_l_5.quaternion);
  }
  mesh_arm_l_5.castShadow = options.castShadow ?? true;
  mesh_arm_l_5.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_l_5.userData.sculptComponent = {"id": "arm-l", "name": "Left arm assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Left arm assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "torso", "attachment": {"parentId": "torso", "parentSocket": "torso-to-arm-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.13, "height": 0.6, "depth": 0.14, "units": "meters", "confidence": 0.88}, "transform": {"position": [-0.25, 0.88, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_arm_l_5.add(mesh_arm_l_5);
  meshes["arm-l"] = mesh_arm_l_5;
  colliders["arm-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_arm_l_5);

  const attachment_arm_r_6 = {"parentId": "torso", "parentSocket": "torso-to-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_arm_r_6 = makeAttachmentEndpoint(attachment_arm_r_6);
  const node_arm_r_6 = new THREE.Group();
  node_arm_r_6.name = "Right arm assembly__pivot";
  node_arm_r_6.scale.set(1, 1, 1);
  if (endpoint_arm_r_6) {
    node_arm_r_6.position.copy(endpoint_arm_r_6.start);
    node_arm_r_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_arm_r_6.position.set(0.25, 0.88, 0.0);
    node_arm_r_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_arm_r_6.userData.sculptComponent = {"id": "arm-r", "name": "Right arm assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Right arm assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "torso", "attachment": {"parentId": "torso", "parentSocket": "torso-to-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.13, "height": 0.6, "depth": 0.14, "units": "meters", "confidence": 0.88}, "transform": {"position": [0.25, 0.88, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_arm_r_6.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["torso"] ?? root).add(node_arm_r_6);
  nodes["arm-r"] = node_arm_r_6;
  const mesh_arm_r_6Geometry = endpoint_arm_r_6
    ? new THREE.CylinderGeometry(endpoint_arm_r_6.endRadius, endpoint_arm_r_6.baseRadius, endpoint_arm_r_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_arm_r_6) {
    mesh_arm_r_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_arm_r_6 = new THREE.Mesh(
    mesh_arm_r_6Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_arm_r_6.name = "Right arm assembly";
  if (endpoint_arm_r_6) {
    mesh_arm_r_6.position.copy(endpoint_arm_r_6.midpoint);
    mesh_arm_r_6.quaternion.copy(endpoint_arm_r_6.quaternion);
  }
  mesh_arm_r_6.castShadow = options.castShadow ?? true;
  mesh_arm_r_6.receiveShadow = options.receiveShadow ?? true;
  mesh_arm_r_6.userData.sculptComponent = {"id": "arm-r", "name": "Right arm assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Right arm assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "torso", "attachment": {"parentId": "torso", "parentSocket": "torso-to-arm-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.13, "height": 0.6, "depth": 0.14, "units": "meters", "confidence": 0.88}, "transform": {"position": [0.25, 0.88, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_arm_r_6.add(mesh_arm_r_6);
  meshes["arm-r"] = mesh_arm_r_6;
  colliders["arm-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_arm_r_6);

  const attachment_leg_l_7 = {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_leg_l_7 = makeAttachmentEndpoint(attachment_leg_l_7);
  const node_leg_l_7 = new THREE.Group();
  node_leg_l_7.name = "Left leg assembly__pivot";
  node_leg_l_7.scale.set(1, 1, 1);
  if (endpoint_leg_l_7) {
    node_leg_l_7.position.copy(endpoint_leg_l_7.start);
    node_leg_l_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leg_l_7.position.set(-0.105, 0.28, 0.0);
    node_leg_l_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_leg_l_7.userData.sculptComponent = {"id": "leg-l", "name": "Left leg assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Left leg assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.16, "height": 0.67, "depth": 0.19, "units": "meters", "confidence": 0.88}, "transform": {"position": [-0.105, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_leg_l_7.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["pelvis"] ?? root).add(node_leg_l_7);
  nodes["leg-l"] = node_leg_l_7;
  const mesh_leg_l_7Geometry = endpoint_leg_l_7
    ? new THREE.CylinderGeometry(endpoint_leg_l_7.endRadius, endpoint_leg_l_7.baseRadius, endpoint_leg_l_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leg_l_7) {
    mesh_leg_l_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_leg_l_7 = new THREE.Mesh(
    mesh_leg_l_7Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_l_7.name = "Left leg assembly";
  if (endpoint_leg_l_7) {
    mesh_leg_l_7.position.copy(endpoint_leg_l_7.midpoint);
    mesh_leg_l_7.quaternion.copy(endpoint_leg_l_7.quaternion);
  }
  mesh_leg_l_7.castShadow = options.castShadow ?? true;
  mesh_leg_l_7.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_l_7.userData.sculptComponent = {"id": "leg-l", "name": "Left leg assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Left leg assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-l", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.16, "height": 0.67, "depth": 0.19, "units": "meters", "confidence": 0.88}, "transform": {"position": [-0.105, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_leg_l_7.add(mesh_leg_l_7);
  meshes["leg-l"] = mesh_leg_l_7;
  colliders["leg-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_leg_l_7);

  const attachment_leg_r_8 = {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]};
  const endpoint_leg_r_8 = makeAttachmentEndpoint(attachment_leg_r_8);
  const node_leg_r_8 = new THREE.Group();
  node_leg_r_8.name = "Right leg assembly__pivot";
  node_leg_r_8.scale.set(1, 1, 1);
  if (endpoint_leg_r_8) {
    node_leg_r_8.position.copy(endpoint_leg_r_8.start);
    node_leg_r_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_leg_r_8.position.set(0.105, 0.28, 0.0);
    node_leg_r_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_leg_r_8.userData.sculptComponent = {"id": "leg-r", "name": "Right leg assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Right leg assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.16, "height": 0.67, "depth": 0.19, "units": "meters", "confidence": 0.88}, "transform": {"position": [0.105, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_leg_r_8.userData.actionProfile = {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["pelvis"] ?? root).add(node_leg_r_8);
  nodes["leg-r"] = node_leg_r_8;
  const mesh_leg_r_8Geometry = endpoint_leg_r_8
    ? new THREE.CylinderGeometry(endpoint_leg_r_8.endRadius, endpoint_leg_r_8.baseRadius, endpoint_leg_r_8.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_leg_r_8) {
    mesh_leg_r_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_leg_r_8 = new THREE.Mesh(
    mesh_leg_r_8Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_r_8.name = "Right leg assembly";
  if (endpoint_leg_r_8) {
    mesh_leg_r_8.position.copy(endpoint_leg_r_8.midpoint);
    mesh_leg_r_8.quaternion.copy(endpoint_leg_r_8.quaternion);
  }
  mesh_leg_r_8.castShadow = options.castShadow ?? true;
  mesh_leg_r_8.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_r_8.userData.sculptComponent = {"id": "leg-r", "name": "Right leg assembly", "level": "macro", "role": "articulated-assembly", "importance": 0.97, "confidence": 0.94, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Official G1 references show Right leg assembly as a distinct manufactured volume with readable seams and joint boundaries.", "geometryDescriptor": {"topologyIntent": "assembled-solid", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "stable object-space procedural coordinates", "normalStrategy": "weighted smooth normals with hard seam boundaries"}, "parent": "pelvis", "attachment": {"parentId": "pelvis", "parentSocket": "pelvis-to-leg-r", "localStart": [0, 0, 0], "localEnd": [0, 0.05, 0], "contactType": "mechanical-joint", "embedDepth": 0.008, "overlap": 0.006, "gapTolerance": 0.003, "contactNormal": [0, 1, 0], "evidenceRefs": ["g1-03-rgb.png"]}, "dimensions": {"width": 0.16, "height": 0.67, "depth": 0.19, "units": "meters", "confidence": 0.88}, "transform": {"position": [0.105, 0.28, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "rigid-part", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.5}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "hidden", "materialLayers": ["hidden"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "structural", "colorMaterialRecipe": {"dominantAlbedo": "rgba(0, 0, 0, 0)", "secondaryAlbedo": "rgba(0, 0, 0, 0)", "materialClass": "unknown", "materialClassConfidence": 1.0, "evidenceRef": "full-object", "implementation": "Independent PBR channels; never infer roughness from albedo."}};
  node_leg_r_8.add(mesh_leg_r_8);
  meshes["leg-r"] = mesh_leg_r_8;
  colliders["leg-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Replace with sphere/capsule/compound proxy when the object shape demands it."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_leg_r_8);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createUnitreeG1EDU2LookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Unitree G1 EDU2 look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "rect-area", "position": [2.4, 3.2, 3.8], "intensity": 3.2, "color": "#F6F8FF", "purpose": "camera-left key light matching clean official studio highlights"}, {"id": "fill", "type": "rect-area", "position": [-2.8, 2.2, 2.2], "intensity": 1.45, "color": "#DDE6FF", "purpose": "broad camera-right fill preserving graphite mechanism detail"}, {"id": "rim-environment", "type": "hemisphere-plus-rim", "position": [0, 2.8, -3.0], "intensity": 1.1, "color": "#B9D8FF", "purpose": "separate helmet and silver shell edges; cyan emission remains unclipped"}, {"id": "display", "exposure": 1.0, "toneMapping": "ACES Filmic", "background": "#E9ECF2", "contactShadow": "soft ground shadow plus SSAO at shell/actuator contacts"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createUnitreeG1EDU2Environment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameUnitreeG1EDU2Camera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createUnitreeG1EDU2PresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureUnitreeG1EDU2Renderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createUnitreeG1EDU2InspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
