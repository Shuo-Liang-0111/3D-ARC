import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const RF01_VISUAL_SPEC = Object.freeze({
  revision: "cardinal-vertical-slice-20260814",
  surfaceChannels: Object.freeze(["base-color", "roughness", "height", "contact-occlusion"]),
  environmentLayers: Object.freeze(["playable-yard", "installed-details", "atmosphere"]),
  deterministicSeed: 60101,
});

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, painter, { colorSpace = THREE.NoColorSpace, repeat = [1, 1] } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  painter(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makeAggregateMaps(seed, palette, repeat) {
  const random = seededRandom(seed);
  const baseColor = canvasTexture(512, 512, (context, width, height) => {
    context.fillStyle = palette.base;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 90; index += 1) {
      const radius = 18 + random() * 75;
      const gradient = context.createRadialGradient(
        random() * width,
        random() * height,
        0,
        random() * width,
        random() * height,
        radius,
      );
      gradient.addColorStop(0, `${random() > 0.52 ? palette.light : palette.dark}28`);
      gradient.addColorStop(1, `${palette.base}00`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    for (let index = 0; index < 2600; index += 1) {
      const value = Math.floor(100 + random() * 80);
      context.fillStyle = `rgba(${value}, ${value + 2}, ${value}, ${0.03 + random() * 0.16})`;
      const size = 0.4 + random() * 1.8;
      context.fillRect(random() * width, random() * height, size, size);
    }
  }, { colorSpace: THREE.SRGBColorSpace, repeat });

  const height = canvasTexture(512, 512, (context, width, canvasHeight) => {
    context.fillStyle = "#848484";
    context.fillRect(0, 0, width, canvasHeight);
    for (let index = 0; index < 3200; index += 1) {
      const value = Math.floor(90 + random() * 80);
      context.fillStyle = `rgba(${value}, ${value}, ${value}, ${0.16 + random() * 0.38})`;
      const size = 0.5 + random() * 2.4;
      context.fillRect(random() * width, random() * canvasHeight, size, size);
    }
  }, { repeat });

  const roughness = canvasTexture(256, 256, (context, width, heightValue) => {
    context.fillStyle = palette.roughness;
    context.fillRect(0, 0, width, heightValue);
    for (let index = 0; index < 420; index += 1) {
      const shade = Math.floor(160 + random() * 78);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.1 + random() * 0.25})`;
      context.beginPath();
      context.arc(random() * width, random() * heightValue, 1 + random() * 8, 0, Math.PI * 2);
      context.fill();
    }
  }, { repeat });

  return { baseColor, height, roughness };
}

function makeCladdingMaps() {
  const baseColor = canvasTexture(256, 256, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#80979b");
    gradient.addColorStop(0.55, "#71888d");
    gradient.addColorStop(1, "#61777b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x += 16) {
      context.fillStyle = "rgba(225, 239, 239, 0.16)";
      context.fillRect(x, 0, 2, height);
      context.fillStyle = "rgba(20, 35, 39, 0.18)";
      context.fillRect(x + 12, 0, 3, height);
    }
    context.fillStyle = "rgba(48, 55, 50, 0.18)";
    context.fillRect(0, height - 24, width, 24);
  }, { colorSpace: THREE.SRGBColorSpace, repeat: [6, 2] });
  const height = canvasTexture(256, 256, (context, width, canvasHeight) => {
    context.fillStyle = "#868686";
    context.fillRect(0, 0, width, canvasHeight);
    for (let x = 0; x < width; x += 16) {
      context.fillStyle = "#b5b5b5";
      context.fillRect(x, 0, 3, canvasHeight);
      context.fillStyle = "#5f5f5f";
      context.fillRect(x + 12, 0, 3, canvasHeight);
    }
  }, { repeat: [6, 2] });
  return { baseColor, height };
}

function makeRadialTexture(inner, outer) {
  return canvasTexture(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.55, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}

export function createRF01SurfaceLibrary() {
  const concreteMaps = makeAggregateMaps(60101, {
    base: "#777d79",
    light: "#aeb4ae",
    dark: "#444b47",
    roughness: "#dddddd",
  }, [6, 5]);
  const asphaltMaps = makeAggregateMaps(60102, {
    base: "#343a38",
    light: "#68706c",
    dark: "#181d1c",
    roughness: "#eeeeee",
  }, [8, 3]);
  const claddingMaps = makeCladdingMaps();

  return Object.freeze({
    concrete: new THREE.MeshStandardMaterial({
      map: concreteMaps.baseColor,
      roughnessMap: concreteMaps.roughness,
      bumpMap: concreteMaps.height,
      bumpScale: 0.032,
      color: 0xf2f2ee,
      metalness: 0,
      roughness: 0.88,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      map: asphaltMaps.baseColor,
      roughnessMap: asphaltMaps.roughness,
      bumpMap: asphaltMaps.height,
      bumpScale: 0.052,
      color: 0xd6d9d5,
      metalness: 0,
      roughness: 0.96,
    }),
    cladding: new THREE.MeshStandardMaterial({
      map: claddingMaps.baseColor,
      bumpMap: claddingMaps.height,
      bumpScale: 0.026,
      color: 0xe8eeec,
      metalness: 0.34,
      roughness: 0.54,
    }),
    galvanized: new THREE.MeshStandardMaterial({ color: 0x788783, metalness: 0.68, roughness: 0.42 }),
    paintedSteel: new THREE.MeshStandardMaterial({ color: 0x344d54, metalness: 0.42, roughness: 0.5 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x27302f, metalness: 0.72, roughness: 0.34 }),
    concreteEdge: new THREE.MeshStandardMaterial({ color: 0x888e89, metalness: 0, roughness: 0.92 }),
    safetyYellow: new THREE.MeshStandardMaterial({ color: 0xd3a12e, metalness: 0.04, roughness: 0.68 }),
    kioskWall: new THREE.MeshStandardMaterial({ color: 0xa5aaa2, metalness: 0.02, roughness: 0.82 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x39565d, metalness: 0.5, roughness: 0.46 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x345a61,
      metalness: 0.05,
      roughness: 0.18,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x202523, metalness: 0, roughness: 0.94 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x4b4335, metalness: 0, roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x5c4935, metalness: 0, roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x496947, metalness: 0, roughness: 0.92 }),
    contactTexture: makeRadialTexture("rgba(25, 32, 29, 0.34)", "rgba(25, 32, 29, 0)"),
    stainTexture: makeRadialTexture("rgba(36, 43, 39, 0.54)", "rgba(36, 43, 39, 0)"),
  });
}

export function enhanceRF01Environment(model, surfaces) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    const materialNames = (Array.isArray(object.material) ? object.material : [object.material])
      .filter(Boolean)
      .map((entry) => entry.name)
      .join(" ");
    const semanticName = `${object.name} ${materialNames}`;
    if (/ConcreteYard/i.test(semanticName)) object.material = surfaces.concrete;
    else if (/SouthServiceRoad|road asphalt/i.test(semanticName)) object.material = surfaces.asphalt;
    else if (/WorkshopCladding|box profile metal/i.test(semanticName)) object.material = surfaces.cladding;
    else if (/GuardKioskRoof/i.test(semanticName)) object.material = surfaces.roof;
    else if (/GuardKiosk(?!Roof)/i.test(semanticName)) object.material = surfaces.kioskWall;
    else if (/GuardWindow/i.test(semanticName)) object.material = surfaces.glass;
    else if (/GatePost|GateHead|GateHeader/i.test(semanticName)) object.material = surfaces.galvanized;
    else if (/ElectricalPad/i.test(semanticName)) object.material = surfaces.concreteEdge;
    else if (/WorkshopHedge/i.test(semanticName)) object.material = surfaces.foliage;
    object.castShadow = !/ConcreteYard|SouthServiceRoad|ParkingStripe|GateLaneMarking/i.test(semanticName);
    object.receiveShadow = true;
  });
  model.userData.visualRevision = RF01_VISUAL_SPEC.revision;
  return model;
}

function box(parent, size, position, material, { rotation = [0, 0, 0], castShadow = true } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedBox(parent, size, position, material, radius = 0.06) {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 4, radius);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, material, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function horizontalDecal(parent, texture, position, size, opacity) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.renderOrder = 2;
  parent.add(mesh);
  return mesh;
}

function createSign(parent, text, position, size, colors = { background: "#163f48", foreground: "#e8efe9" }) {
  const texture = canvasTexture(512, 160, (context, width, height) => {
    context.fillStyle = colors.background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(235, 240, 232, 0.78)";
    context.lineWidth = 8;
    context.strokeRect(10, 10, width - 20, height - 20);
    context.fillStyle = colors.foreground;
    context.font = "700 62px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2 + 4);
  }, { colorSpace: THREE.SRGBColorSpace });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(...size),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
  );
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function createWorkshopDetails(root, surfaces) {
  const facade = new THREE.Group();
  facade.name = "rf01-workshop-installed-details";
  root.add(facade);

  box(facade, [10.45, 0.18, 0.2], [0, 0.16, -0.82], surfaces.concreteEdge);
  [-4.25, -2.1, 0, 2.1, 4.25].forEach((x) => {
    box(facade, [0.08, 3.55, 0.12], [x, 2.0, -0.79], surfaces.galvanized);
  });
  box(facade, [4.25, 3.0, 0.1], [-1.0, 1.72, -0.72], surfaces.darkSteel);
  for (let x = -2.95; x <= 0.95; x += 0.33) {
    box(facade, [0.035, 2.72, 0.035], [x, 1.72, -0.66], surfaces.paintedSteel, { castShadow: false });
  }
  box(facade, [1.2, 2.2, 0.08], [3.72, 1.26, -0.71], surfaces.darkSteel);
  box(facade, [0.9, 0.58, 0.035], [3.72, 1.72, -0.65], surfaces.glass, { castShadow: false });
  box(facade, [10.8, 0.16, 0.18], [0, 4.12, -0.75], surfaces.galvanized);
  [-4.7, 4.7].forEach((x) => {
    const downpipe = cylinder(facade, 0.055, 3.8, [x, 2.05, -0.64], surfaces.galvanized, 14);
    downpipe.rotation.z = 0.01;
  });
  createSign(facade, "A01  SERVICE WORKSHOP", [1.8, 3.42, -0.62], [2.9, 0.62]);

  const pallet = new THREE.Group();
  pallet.position.set(-4.35, 0, -1.12);
  root.add(pallet);
  for (let index = 0; index < 4; index += 1) {
    box(pallet, [0.18, 0.12, 1.0], [-0.43 + index * 0.29, 0.08, 0], surfaces.rubber);
  }
  for (let level = 0; level < 2; level += 1) {
    roundedBox(pallet, [0.68, 0.48, 0.54], [0, 0.42 + level * 0.5, 0], surfaces.paintedSteel, 0.035);
  }
  horizontalDecal(root, surfaces.contactTexture, [-4.35, 0.018, -1.1], [2.0, 1.6], 0.58);
}

function createBatteryBay(root, surfaces) {
  const bay = new THREE.Group();
  bay.name = "rf01-battery-service-bay";
  bay.position.set(-6.8, 0, -0.42);
  root.add(bay);
  box(bay, [1.45, 0.12, 1.05], [0, 0.06, 0], surfaces.concreteEdge);
  [-0.62, 0.62].forEach((x) => {
    [-0.42, 0.42].forEach((z) => cylinder(bay, 0.045, 1.55, [x, 0.82, z], surfaces.galvanized, 14));
  });
  box(bay, [1.5, 0.08, 1.1], [0, 1.56, 0], surfaces.roof);
  box(bay, [1.3, 0.07, 0.82], [0, 0.43, 0], surfaces.galvanized);
  createSign(bay, "ENERGY MODULE", [0, 1.23, 0.45], [1.18, 0.32], { background: "#b48422", foreground: "#141b19" });
  horizontalDecal(root, surfaces.contactTexture, [-6.8, 0.02, -0.42], [2.2, 1.8], 0.62);
  [-7.75, -5.85].forEach((x) => {
    cylinder(root, 0.09, 0.72, [x, 0.36, 0.12], surfaces.safetyYellow, 18);
    cylinder(root, 0.095, 0.12, [x, 0.2, 0.12], surfaces.rubber, 18);
  });
}

function createElectricalCompound(root, surfaces) {
  const compound = new THREE.Group();
  compound.name = "rf01-electrical-installed-equipment";
  root.add(compound);
  box(compound, [3.15, 0.14, 2.05], [6.6, 0.08, -1.8], surfaces.concreteEdge);
  roundedBox(compound, [0.95, 1.62, 0.62], [6.55, 0.9, -1.92], surfaces.paintedSteel, 0.075);
  roundedBox(compound, [0.72, 1.25, 0.58], [7.55, 0.7, -1.92], surfaces.galvanized, 0.055);
  [6.2, 6.55, 6.9].forEach((x) => {
    box(compound, [0.026, 0.82, 0.64], [x, 0.98, -1.6], surfaces.darkSteel, { castShadow: false });
  });
  box(compound, [0.42, 0.32, 0.025], [6.55, 1.28, -1.6], surfaces.safetyYellow, { castShadow: false });
  const conduitMaterial = surfaces.galvanized;
  [6.25, 6.85, 7.45].forEach((x) => {
    const conduit = cylinder(compound, 0.035, 1.15, [x, 0.58, -2.55], conduitMaterial, 12);
    conduit.rotation.x = Math.PI / 2;
  });
  horizontalDecal(root, surfaces.contactTexture, [6.6, 0.02, -1.8], [4.2, 3.0], 0.58);
  horizontalDecal(root, surfaces.stainTexture, [6.25, 0.025, -1.15], [1.2, 0.8], 0.3);
}

function createGatehouseDetails(root, surfaces) {
  const kiosk = new THREE.Group();
  kiosk.name = "rf01-gatehouse-installed-details";
  root.add(kiosk);
  box(kiosk, [2.38, 0.12, 2.06], [6.5, 2.32, 5.0], surfaces.roof);
  box(kiosk, [1.35, 0.66, 0.035], [5.28, 1.45, 5.0], surfaces.glass, { castShadow: false });
  box(kiosk, [0.96, 1.92, 0.05], [6.5, 1.02, 3.94], surfaces.darkSteel);
  box(kiosk, [0.5, 0.36, 0.1], [6.5, 0.72, 3.87], surfaces.glass, { castShadow: false });
  roundedBox(kiosk, [0.72, 0.38, 0.55], [6.95, 2.54, 5.15], surfaces.kioskWall, 0.045);
  for (let x = 6.68; x <= 7.22; x += 0.12) {
    box(kiosk, [0.035, 0.28, 0.58], [x, 2.54, 5.15], surfaces.galvanized, { castShadow: false });
  }
  createSign(kiosk, "门岗  GATEHOUSE", [6.5, 2.02, 3.9], [1.5, 0.4]);
  horizontalDecal(root, surfaces.contactTexture, [6.5, 0.02, 5.0], [3.3, 2.9], 0.52);
}

function createDrainageAndWear(root, surfaces) {
  const drainMaterial = surfaces.darkSteel;
  const drainageGrates = new THREE.Group();
  drainageGrates.name = "rf01-procedural-drainage-grates";
  root.add(drainageGrates);
  [-4.7, 0, 4.7].forEach((x) => {
    box(drainageGrates, [1.25, 0.035, 0.42], [x, 0.018, 2.2], drainMaterial, { castShadow: false });
    for (let slot = -0.48; slot <= 0.48; slot += 0.12) {
      box(drainageGrates, [0.035, 0.025, 0.36], [x + slot, 0.041, 2.2], surfaces.galvanized, { castShadow: false });
    }
  });
  const crackMaterial = new THREE.LineBasicMaterial({ color: 0x3c4541, transparent: true, opacity: 0.56 });
  const cracks = [
    [[-8.6, 0.032, 1.1], [-7.4, 0.034, 1.4], [-6.2, 0.031, 1.15]],
    [[2.4, 0.032, -0.2], [2.0, 0.034, 0.8], [2.6, 0.032, 1.7], [2.2, 0.034, 2.3]],
    [[7.8, 0.032, 2.2], [8.4, 0.034, 2.8], [8.1, 0.032, 3.6]],
  ];
  cracks.forEach((points) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
    root.add(new THREE.Line(geometry, crackMaterial));
  });
  [[-7.8, 1.7, 1.1, 0.45], [-1.8, 3.2, 1.6, 0.22], [4.1, 1.0, 1.4, 0.32], [8.4, 3.0, 1.1, 0.25]].forEach(([x, z, scale, opacity]) => {
    const decal = horizontalDecal(root, surfaces.stainTexture, [x, 0.026, z], [1.7 * scale, scale], opacity);
    decal.rotation.z = x * 0.17;
  });
  [-0.75, 0.75].forEach((x) => {
    box(root, [0.18, 0.018, 4.9], [x, 0.032, 4.45], surfaces.rubber, { castShadow: false });
  });
}

export function createRF01EnvironmentDetails(surfaces) {
  const root = new THREE.Group();
  root.name = "rf01-realism-environment-details";
  root.userData.visualSpec = RF01_VISUAL_SPEC;
  createDrainageAndWear(root, surfaces);
  return root;
}

export function createRF01Sky() {
  const texture = canvasTexture(32, 512, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#7294a6");
    gradient.addColorStop(0.45, "#b8ced4");
    gradient.addColorStop(0.72, "#e3e6df");
    gradient.addColorStop(1, "#aebcb9");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }, { colorSpace: THREE.SRGBColorSpace });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(70, 36, 24),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  sky.position.y = -8;
  sky.name = "rf01-sky-atmosphere";
  return sky;
}
