import * as THREE from "three";

// Procedural canvas textures for the small office. Everything here is generated
// at runtime so the level has no binary asset dependency; nothing touches the DOM
// at import time, which keeps the module importable from node tests.

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampByte = (value) => Math.max(0, Math.min(255, value));

function toTexture(canvas, { repeat = [1, 1], srgb = true, anisotropy = 8, wrap = THREE.RepeatWrapping } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.repeat.set(...repeat);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function addNoise(context, width, height, amount, random) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const noise = (random() - 0.5) * amount;
    data[index] = clampByte(data[index] + noise);
    data[index + 1] = clampByte(data[index + 1] + noise);
    data[index + 2] = clampByte(data[index + 2] + noise);
  }
  context.putImageData(image, 0, 0);
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

// ---------------------------------------------------------------------------
// Laminate plank floor (warm oak, satin finish). One 2048 px canvas covers
// 4.8 m x 4.8 m so the 4.1 m x 4.4 m room never repeats the texture.
export const FLOOR_TILE_METERS = 4.8;

export function createWoodFloorMaterial() {
  const size = 2048;
  const random = mulberry32(20260826);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  const roughCanvas = createCanvas(size, size);
  const roughContext = roughCanvas.getContext("2d");
  const pxPerMeter = size / FLOOR_TILE_METERS;
  const rowHeight = 0.125 * pxPerMeter;
  const plankLength = 1.2 * pxPerMeter;
  context.fillStyle = "#3a2412";
  context.fillRect(0, 0, size, size);
  roughContext.fillStyle = "#dcdcdc";
  roughContext.fillRect(0, 0, size, size);
  const rows = Math.ceil(size / rowHeight);
  const staggers = [0, 0.38, 0.72, 0.2, 0.55, 0.9];
  for (let row = 0; row < rows; row += 1) {
    const y = row * rowHeight;
    const offset = -(staggers[row % staggers.length] + random() * 0.08) * plankLength;
    for (let x = offset; x < size; x += plankLength) {
      const hue = 24 + random() * 10;
      const sat = 44 + random() * 14;
      const light = 37 + random() * 13;
      context.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
      context.fillRect(x + 1, y + 1, plankLength - 2, rowHeight - 2);
      const grainCount = 16 + Math.floor(random() * 10);
      for (let grain = 0; grain < grainCount; grain += 1) {
        const gy = y + 2 + random() * (rowHeight - 4);
        const amplitude = 0.5 + random() * 2.4;
        const frequency = 0.003 + random() * 0.011;
        const phase = random() * Math.PI * 2;
        const dark = random() < 0.66;
        context.strokeStyle = dark
          ? `hsla(${hue - 4}, ${sat + 8}%, ${light - 16 - random() * 10}%, ${0.16 + random() * 0.24})`
          : `hsla(${hue + 3}, ${sat}%, ${light + 12}%, ${0.1 + random() * 0.16})`;
        context.lineWidth = 0.6 + random() * 1.8;
        context.beginPath();
        for (let px = x; px <= x + plankLength; px += 6) {
          const py = gy + Math.sin(px * frequency + phase) * amplitude + Math.sin(px * frequency * 3.1 + phase * 1.7) * amplitude * 0.35;
          if (px === x) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.stroke();
      }
      if (random() < 0.24) {
        const kx = x + plankLength * (0.15 + random() * 0.7);
        const ky = y + rowHeight * (0.3 + random() * 0.4);
        const kr = 3 + random() * 7;
        const gradient = context.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.2);
        gradient.addColorStop(0, `hsla(${hue - 6}, 55%, ${light - 22}%, 0.72)`);
        gradient.addColorStop(0.5, `hsla(${hue - 2}, 50%, ${light - 10}%, 0.32)`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.ellipse(kx, ky, kr * 2.2, kr * 1.2, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = "rgba(255,255,255,0.10)";
      context.fillRect(x + 1, y + 1, plankLength - 2, 1.5);
      context.fillStyle = "rgba(0,0,0,0.24)";
      context.fillRect(x + 1, y + rowHeight - 3, plankLength - 2, 2);
      context.fillStyle = "rgba(0,0,0,0.28)";
      context.fillRect(x + plankLength - 2.5, y + 1, 1.5, rowHeight - 2);
      const roughness = 172 + random() * 34;
      roughContext.fillStyle = `rgb(${roughness},${roughness},${roughness})`;
      roughContext.fillRect(x + 1, y + 1, plankLength - 2, rowHeight - 2);
    }
  }
  addNoise(context, size, size, 14, random);
  const map = toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 });
  const roughnessMap = toTexture(roughCanvas, { wrap: THREE.ClampToEdgeWrapping, srgb: false });
  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 1,
    metalness: 0,
    bumpMap: map,
    bumpScale: 0.0018,
    color: 0xd9c6b0,
  });
}

// Straight-grain wood veneer. Used for the pale maple desk top and the walnut door.
function createWoodGrainMaterial({ seed, base, grain, tint, roughness, lines = 420, noise = 10 }) {
  const size = 1024;
  const random = mulberry32(seed);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);
  for (let line = 0; line < lines; line += 1) {
    const y = random() * size;
    const [r, g, b] = grain;
    context.strokeStyle = `rgba(${r + random() * 40}, ${g + random() * 30}, ${b + random() * 25}, ${0.05 + random() * 0.12})`;
    context.lineWidth = 0.5 + random() * 1.5;
    context.beginPath();
    const amplitude = random() * 3;
    const frequency = 0.002 + random() * 0.004;
    for (let x = 0; x <= size; x += 8) {
      const py = y + Math.sin(x * frequency) * amplitude;
      if (x === 0) context.moveTo(x, py);
      else context.lineTo(x, py);
    }
    context.stroke();
  }
  addNoise(context, size, size, noise, random);
  const map = toTexture(canvas, { repeat: [2.2, 1] });
  return new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, color: tint, bumpMap: map, bumpScale: 0.0015 });
}

export function createMapleMaterial() {
  return createWoodGrainMaterial({ seed: 11, base: "#e6d3ad", grain: [150, 115, 70], tint: 0xf1e6d2, roughness: 0.55 });
}

export function createWalnutMaterial() {
  return createWoodGrainMaterial({ seed: 17, base: "#7a5236", grain: [52, 30, 16], tint: 0xf2e6da, roughness: 0.5, lines: 620, noise: 14 });
}

// Painted plaster wall (off white, slightly uneven).
export function createPlasterMaterial(widthMeters, heightMeters, tint = 0xe6e3dc) {
  const size = 512;
  const random = mulberry32(3);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#f3f1ec";
  context.fillRect(0, 0, size, size);
  for (let blotch = 0; blotch < 26; blotch += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = 40 + random() * 120;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${200 + random() * 40}, ${196 + random() * 40}, ${186 + random() * 40}, 0.07)`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  addNoise(context, size, size, 12, random);
  const map = toTexture(canvas, { repeat: [Math.max(1, widthMeters / 1.6), Math.max(1, heightMeters / 1.6)] });
  return new THREE.MeshStandardMaterial({ map, color: tint, roughness: 0.88, metalness: 0, bumpMap: map, bumpScale: 0.0025 });
}

// Low-pile grey carpet tiles for the corridor and vestibule.
export function createCarpetMaterial(widthMeters, depthMeters) {
  const size = 256;
  const random = mulberry32(5);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#8d8f8c";
  context.fillRect(0, 0, size, size);
  addNoise(context, size, size, 40, random);
  context.strokeStyle = "rgba(0,0,0,0.22)";
  context.lineWidth = 2;
  context.strokeRect(1, 1, size - 2, size - 2);
  const map = toTexture(canvas, { repeat: [widthMeters / 0.5, depthMeters / 0.5] });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0, bumpMap: map, bumpScale: 0.004 });
}

// Roller sunscreen fabric: soft grey weave, semi transparent.
export function createBlindMaterial() {
  const size = 256;
  const random = mulberry32(9);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#cbc8c2";
  context.fillRect(0, 0, size, size);
  addNoise(context, size, size, 26, random);
  context.strokeStyle = "rgba(60,60,60,0.16)";
  context.lineWidth = 1;
  for (let x = 0; x < size; x += 4) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke(); }
  for (let y = 0; y < size; y += 4) { context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke(); }
  const map = toTexture(canvas, { repeat: [6, 10] });
  return new THREE.MeshStandardMaterial({
    map,
    color: 0x8f8d88,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Whiteboard: hand-written benchmark planning notes recreated from the photo.
const MARKER_FONT = "'Bradley Hand', 'Segoe Print', 'Marker Felt', 'Comic Sans MS', 'Noto Sans CJK SC', 'PingFang SC', cursive, sans-serif";

export function createWhiteboardTexture() {
  const width = 1024;
  const height = 768;
  const random = mulberry32(42);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7f7f5";
  context.fillRect(0, 0, width, height);
  for (let smudge = 0; smudge < 30; smudge += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 30 + random() * 90;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(120,120,125,0.07)");
    gradient.addColorStop(1, "rgba(120,120,125,0)");
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const ink = (alpha = 0.9) => `rgba(28,28,30,${alpha})`;
  const jitter = (value, amount = 1.6) => value + (random() - 0.5) * amount;
  const write = (text, x, y, size = 30, angle = 0) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle + (random() - 0.5) * 0.03);
    context.font = `${size}px ${MARKER_FONT}`;
    context.fillStyle = ink(0.86 + random() * 0.1);
    context.textBaseline = "alphabetic";
    context.fillText(text, 0, 0);
    context.restore();
  };
  const stroke = (points, lineWidth = 3.2) => {
    context.strokeStyle = ink(0.84);
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(jitter(x), jitter(y));
      else context.lineTo(jitter(x), jitter(y));
    });
    context.stroke();
  };
  const box = (x, y, w, h) => stroke([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);
  const oval = (x, y, rx, ry) => {
    context.strokeStyle = ink(0.84);
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(x, y, rx, ry, (random() - 0.5) * 0.2, 0, Math.PI * 2);
    context.stroke();
  };
  const arrow = (x1, y1, x2, y2) => {
    stroke([[x1, y1], [x2, y2]]);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    stroke([[x2 - Math.cos(angle - 0.5) * 14, y2 - Math.sin(angle - 0.5) * 14], [x2, y2], [x2 - Math.cos(angle + 0.5) * 14, y2 - Math.sin(angle + 0.5) * 14]]);
  };

  // Left block — dataset counts.
  write("总分: 1 ~ 5", 34, 96, 40);
  write("Dev: 480", 34, 158, 40);
  oval(198, 122, 42, 22);
  write("42 类", 168, 132, 26);
  write("open-test: 210 (每类 5 个)", 34, 218, 30);
  write("close-test: 210", 34, 274, 34);
  stroke([[332, 60], [346, 130], [340, 220], [352, 300]], 2.6);
  oval(120, 62, 96, 26);
  write("GameDev Bench", 42, 72, 30);
  box(30, 356, 118, 82);
  write("full set", 40, 388, 26);
  write("1,001", 46, 428, 34);
  oval(214, 400, 40, 22);
  write("gemini", 184, 408, 24);
  arrow(258, 400, 292, 386);
  box(300, 352, 118, 78);
  write("results", 314, 384, 26);
  write("1,001", 318, 420, 32);
  write("hard", 432, 366, 22);
  write("top", 432, 404, 22);
  write("(4 类)", 424, 432, 20);
  arrow(420, 386, 486, 376);
  box(488, 344, 154, 82);
  write("challenge set", 494, 370, 22);
  write("420", 522, 418, 44);
  write("remaining", 372, 470, 24);
  arrow(440, 452, 470, 446);
  box(470, 428, 224, 60);
  write("Dev | 681 (纯 gemini)", 480, 466, 24);
  write("+ 3 个模型", 706, 470, 24);

  // Center block — dataset plan.
  box(586, 28, 158, 44);
  write("100,000", 602, 62, 32);
  write("dataset: Dev + OpenTest(challenge/extended) + Close", 452, 116, 24);
  write("Large-scale", 460, 176, 34);
  write("Model:  ID / OOD", 520, 242, 32);
  write("(4)", 604, 274, 22);
  write("(3)", 690, 274, 22);
  write("全 7 模型评测", 690, 322, 26);
  stroke([[720, 296], [712, 280]], 2.6);
  arrow(760, 334, 760, 358);
  box(700, 362, 88, 56);
  write("open-test", 706, 382, 18);
  write("(210)", 712, 408, 22);
  box(790, 362, 74, 56);
  write("close-test", 792, 382, 16);
  write("210.", 800, 408, 22);
  write("最难 top1 类", 880, 392, 20);
  arrow(900, 402, 900, 430);
  box(846, 434, 104, 50);
  write("challenge set", 852, 452, 15);
  write("42", 880, 478, 24);
  oval(990, 462, 28, 20);
  write("SDK?", 970, 470, 20);

  // Right block — model roster.
  write("Three.js: Arena: 评 coding 能力", 700, 88, 20);
  stroke([[812, 148], [800, 200], [808, 260], [798, 320]], 2.6);
  write("7", 776, 210, 22);
  write("个", 774, 236, 20);
  write("模", 774, 262, 20);
  write("型", 774, 288, 20);
  const roster = ["fable5: 50 ✓", "opus5: 25", "GPT5.5-sol: 30 ✓", "Gemini3.7-flash: 3.75 ✓", "Kimi-K3: 15", "GLM-5.3: 5", "DeepSeek V4-flash: 0.3 ✓"];
  roster.forEach((line, index) => write(line, 820, 154 + index * 30, 21));
  write("2", 990, 184, 20);
  write("5", 990, 214, 20);
  write("5", 990, 326, 20);
  write("2026.8 · 每类 5 · 1,001 全量", 34, 706, 22);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping, anisotropy: 16 });
}

// ---------------------------------------------------------------------------
// Exterior seen through the window: office block facade and a parking lot.
export function createFacadeTexture() {
  const size = 1024; // 12 m x 12 m
  const random = mulberry32(77);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#d3ccc1";
  context.fillRect(0, 0, size, size);
  addNoise(context, size, size, 18, random);
  const floorPx = size / 3;
  for (let floor = 0; floor < 3; floor += 1) {
    const y = floor * floorPx;
    context.fillStyle = "#bdb4a6";
    context.fillRect(0, y, size, 22);
    for (let bay = 0; bay < 5; bay += 1) {
      const x = bay * (size / 5) + 28;
      const w = size / 5 - 56;
      const h = floorPx * 0.58;
      const wy = y + floorPx * 0.24;
      context.fillStyle = "#8e8a84";
      context.fillRect(x - 6, wy - 6, w + 12, h + 12);
      const glass = context.createLinearGradient(x, wy, x + w, wy + h);
      glass.addColorStop(0, "#5f6f7d");
      glass.addColorStop(0.5, "#4a5866");
      glass.addColorStop(1, "#6c7c8a");
      context.fillStyle = glass;
      context.fillRect(x, wy, w, h);
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(x + 6, wy + 6, w * 0.4, h * 0.3);
      context.fillStyle = "#8e8a84";
      context.fillRect(x + w / 2 - 3, wy, 6, h);
    }
  }
  return toTexture(canvas, { repeat: [3.4, 1.9] });
}

export function createParkingLotTexture() {
  const size = 1024; // 32 m x 32 m, x from -8..24, z from -16..16
  const random = mulberry32(31);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  const px = (meters) => ((meters + 8) / 32) * size;
  const pz = (meters) => ((meters + 16) / 32) * size;
  context.fillStyle = "#47494c";
  context.fillRect(0, 0, size, size);
  addNoise(context, size, size, 26, random);
  context.strokeStyle = "rgba(240,240,236,0.9)";
  context.lineWidth = 4;
  for (let bay = 0; bay <= 8; bay += 1) {
    const z = -10.4 + bay * 2.6;
    context.beginPath();
    context.moveTo(px(8.5), pz(z));
    context.lineTo(px(13.5), pz(z));
    context.stroke();
  }
  context.beginPath();
  context.moveTo(px(8.5), pz(-10.4));
  context.lineTo(px(8.5), pz(10.4));
  context.stroke();
  context.fillStyle = "#b9b5ad";
  context.fillRect(px(13.5), 0, px(16) - px(13.5), size);
  context.strokeStyle = "rgba(232,196,60,0.85)";
  context.lineWidth = 3;
  for (let line = 0; line < 9; line += 1) {
    const offset = line * 0.7;
    context.beginPath();
    context.moveTo(px(2 + offset), pz(0.5));
    context.lineTo(px(2), pz(0.5 + offset));
    context.stroke();
    context.beginPath();
    context.moveTo(px(2 + offset), pz(5.5));
    context.lineTo(px(7), pz(0.5 + offset));
    context.stroke();
  }
  context.strokeRect(px(2), pz(0.5), px(7) - px(2), pz(5.5) - pz(0.5));
  context.setLineDash([26, 22]);
  context.beginPath();
  context.moveTo(px(4.5), 0);
  context.lineTo(px(4.5), size);
  context.stroke();
  context.setLineDash([]);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

// ---------------------------------------------------------------------------
// Small props.
export function createCardboardTexture(kind = "plain") {
  const size = 512;
  const random = mulberry32(kind === "aircon" ? 12 : 13);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#b68b5b";
  context.fillRect(0, 0, size, size);
  context.strokeStyle = "rgba(90,60,30,0.08)";
  context.lineWidth = 1;
  for (let x = 0; x < size; x += 3) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size); context.stroke(); }
  addNoise(context, size, size, 16, random);
  if (kind === "aircon") {
    context.strokeStyle = "rgba(40,30,20,0.75)";
    context.lineWidth = 5;
    roundedRectPath(context, 150, 90, 200, 330, 26);
    context.stroke();
    context.lineWidth = 3;
    for (let slat = 0; slat < 7; slat += 1) {
      context.beginPath();
      context.moveTo(180, 300 + slat * 14);
      context.lineTo(320, 300 + slat * 14);
      context.stroke();
    }
    context.fillStyle = "rgba(40,30,20,0.75)";
    context.font = "700 26px sans-serif";
    context.textAlign = "center";
    context.fillText("PORTABLE AIR CONDITIONER", 256, 62);
    context.font = "500 18px sans-serif";
    context.fillText("From Ningpu", 256, 460);
  } else {
    context.fillStyle = "rgba(60,40,20,0.7)";
    context.font = "700 54px sans-serif";
    context.textAlign = "center";
    context.fillText("AEPO", 256, 290);
  }
  context.fillStyle = "rgba(120,86,46,0.55)";
  context.fillRect(0, 232, size, 48);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

export function createMonitorBoxTexture() {
  const width = 1024;
  const height = 640;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#c4262c";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#f1e9d8";
  roundedRectPath(context, 640, 70, 330, 500, 40);
  context.fill();
  context.strokeStyle = "#1a1a1a";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(690, 210);
  context.quadraticCurveTo(805, 160, 920, 210);
  context.lineTo(920, 420);
  context.quadraticCurveTo(805, 370, 690, 420);
  context.closePath();
  context.stroke();
  context.beginPath();
  context.moveTo(805, 420);
  context.lineTo(805, 500);
  context.moveTo(750, 500);
  context.lineTo(860, 500);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "900 92px sans-serif";
  context.fillText("LED MONITOR", 56, 150);
  context.font = "700 40px sans-serif";
  context.fillText("GI SERIES GAMING", 60, 230);
  context.fillStyle = "#f5e6c8";
  context.font = "900 64px sans-serif";
  context.fillText("EXPAND", 60, 330);
  context.fillText("YOUR WORLD", 60, 405);
  context.fillStyle = "#ffffff";
  context.font = "700 34px sans-serif";
  context.fillText("CURVE   ·   HDMI   ·   165Hz", 60, 540);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

export function createFloralTexture() {
  const size = 512;
  const random = mulberry32(88);
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#c9dcea";
  context.fillRect(0, 0, size, size);
  const petals = ["#e6b3d3", "#f0d27a", "#b79ccf", "#f2c2a6", "#e8a4b8"];
  for (let flower = 0; flower < 16; flower += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = 26 + random() * 30;
    for (let leaf = 0; leaf < 3; leaf += 1) {
      context.fillStyle = "#7f9c62";
      context.beginPath();
      context.ellipse(x + (random() - 0.5) * r * 2.6, y + (random() - 0.5) * r * 2.6, r * 0.7, r * 0.28, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    const color = petals[Math.floor(random() * petals.length)];
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = (petal / 6) * Math.PI * 2 + random() * 0.4;
      context.fillStyle = color;
      context.beginPath();
      context.ellipse(x + Math.cos(angle) * r * 0.55, y + Math.sin(angle) * r * 0.55, r * 0.5, r * 0.3, angle, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#e9d58a";
    context.beginPath();
    context.arc(x, y, r * 0.22, 0, Math.PI * 2);
    context.fill();
  }
  addNoise(context, size, size, 10, random);
  return toTexture(canvas, { repeat: [1.4, 1] });
}

export function createGrilleTexture() {
  const width = 256;
  const height = 128;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#2b2c2e";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#e8e8e6";
  for (let slat = 0; slat < 8; slat += 1) context.fillRect(6, 8 + slat * 15, width - 12, 7);
  for (let bar = 0; bar < 4; bar += 1) context.fillRect(20 + bar * 62, 4, 6, height - 8);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

export function createDisplayTexture(text, on) {
  const canvas = createCanvas(256, 128);
  const context = canvas.getContext("2d");
  context.fillStyle = on ? "#0b1f16" : "#0e1012";
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = on ? "#5dff8c" : "#1a2a22";
  context.font = "700 92px 'DIN Alternate', 'Courier New', monospace";
  context.textAlign = "center";
  context.fillText(text, 128, 100);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

export function createLabelTexture(text, { background = "#ffffff", color = "#2b2b2b", font = "700 64px sans-serif", width = 512, height = 128 } = {}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = color;
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2);
  return toTexture(canvas, { wrap: THREE.ClampToEdgeWrapping });
}

export function createRibbedTexture() {
  const canvas = createCanvas(256, 64);
  const context = canvas.getContext("2d");
  context.fillStyle = "#d9d7d1";
  context.fillRect(0, 0, 256, 64);
  for (let rib = 0; rib < 16; rib += 1) {
    context.fillStyle = "#b9b7b1";
    context.fillRect(rib * 16, 0, 6, 64);
    context.fillStyle = "#ecebe7";
    context.fillRect(rib * 16 + 8, 0, 3, 64);
  }
  return toTexture(canvas, { repeat: [40, 1] });
}

export function createMeshFabricTexture() {
  const size = 128;
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  context.fillStyle = "#222325";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#5a5c60";
  for (let y = 0; y < size; y += 4) context.fillRect(0, y, size, 1);
  for (let x = 0; x < size; x += 4) context.fillRect(x, 0, 1, size);
  return toTexture(canvas, { repeat: [10, 10] });
}
