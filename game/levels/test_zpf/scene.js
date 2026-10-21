import * as THREE from "three";

const ROOM = Object.freeze({ width: 3.5, depth: 3.6, height: 2.7 });

function mesh(parent, geometry, material, position, rotation = [0, 0, 0], name = "") {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, position, material, name = "", rotation = [0, 0, 0]) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, position, rotation, name);
}

function cylinder(parent, radius, height, position, material, rotation = [0, 0, 0], segments = 20, name = "") {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation, name);
}

function plane(parent, size, position, rotation, material, name = "") {
  return mesh(parent, new THREE.PlaneGeometry(...size), material, position, rotation, name);
}

function createCanvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  paint(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function createFloorTexture() {
  return createCanvasTexture(1024, 1024, (context, width, height) => {
    context.fillStyle = "#876244";
    context.fillRect(0, 0, width, height);
    const rowHeight = 96;
    for (let row = 0; row <= Math.ceil(height / rowHeight); row += 1) {
      const y = row * rowHeight;
      const offset = row % 2 ? 150 : 0;
      context.strokeStyle = "rgba(52,30,20,.62)";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      for (let x = -offset; x < width; x += 330) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + rowHeight);
        context.stroke();
      }
      for (let grain = 0; grain < 7; grain += 1) {
        const waveY = y + 12 + grain * 11;
        context.strokeStyle = `rgba(${grain % 2 ? 65 : 238},${grain % 2 ? 39 : 176},${grain % 2 ? 25 : 116},.12)`;
        context.lineWidth = 2;
        context.beginPath();
        for (let x = 0; x <= width; x += 16) {
          const yy = waveY + Math.sin(x * 0.025 + row * 1.7 + grain) * 3;
          if (x === 0) context.moveTo(x, yy);
          else context.lineTo(x, yy);
        }
        context.stroke();
      }
    }
  });
}

function createWhiteboardTexture() {
  return createCanvasTexture(1200, 700, (context, width, height) => {
    context.fillStyle = "#eeeeda";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(120,130,125,.12)";
    context.lineWidth = 18;
    for (let y = 80; y < height; y += 120) {
      context.beginPath();
      context.moveTo(20, y);
      context.bezierCurveTo(310, y - 22, 720, y + 24, width - 20, y - 5);
      context.stroke();
    }
    context.fillStyle = "#202421";
    context.textBaseline = "middle";
    context.font = "italic 64px cursive";
    context.fillText("Game Dev Bench", 365, 75);
    context.strokeStyle = "#202421";
    context.lineWidth = 5;
    context.strokeRect(335, 35, 520, 82);
    context.font = "italic 40px cursive";
    context.fillText("Large-scale", 465, 175);
    context.fillText("dataset: open-test + close", 300, 235);
    context.font = "34px cursive";
    context.fillText("Model: 10 / 20D", 415, 315);
    context.fillText("open-test  210", 785, 390);
    context.fillText("challenge set", 405, 480);
    context.fillText("remaining 20 / 651", 575, 590);
    const boxes = [
      [60, 410, 200, 105], [330, 410, 250, 105], [650, 345, 245, 105], [930, 440, 190, 100],
    ];
    boxes.forEach(([x, y, w, h]) => context.strokeRect(x, y, w, h));
    const arrows = [[260, 462, 330, 462], [580, 462, 650, 410], [895, 410, 980, 455]];
    arrows.forEach(([x1, y1, x2, y2]) => {
      context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
      context.beginPath(); context.moveTo(x2 - 18, y2 - 8); context.lineTo(x2, y2); context.lineTo(x2 - 12, y2 + 16); context.stroke();
    });
    context.font = "30px sans-serif";
    context.fillText("1–5   42   480", 60, 190);
    context.fillText("tables 50  ·  opus 25", 900, 170);
    for (let index = 0; index < 28; index += 1) {
      const x = 35 + ((index * 127) % 1110);
      const y = 145 + ((index * 83) % 500);
      context.beginPath();
      context.arc(x, y, 5 + (index % 5) * 3, 0, Math.PI * (1.2 + (index % 3) * 0.2));
      context.stroke();
    }
  });
}

function createMeshTexture() {
  return createCanvasTexture(128, 128, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(75,80,80,.94)";
    context.lineWidth = 3;
    for (let y = 3; y < height; y += 7) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    context.strokeStyle = "rgba(24,27,28,.48)";
    context.lineWidth = 1;
    for (let x = 4; x < width; x += 9) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
  });
}

function createBlindTexture() {
  return createCanvasTexture(128, 256, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(218,220,216,.76)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(125,132,130,.24)";
    for (let y = 1; y < height; y += 4) context.fillRect(0, y, width, 1);
    context.fillStyle = "rgba(245,245,239,.18)";
    for (let x = 2; x < width; x += 5) context.fillRect(x, 0, 1, height);
  });
}

function createFloralTexture() {
  return createCanvasTexture(512, 512, (context, width, height) => {
    context.fillStyle = "#b8d8df";
    context.fillRect(0, 0, width, height);
    const flowers = [
      [105, 105, "#b28dbb", "#efd67a"], [360, 145, "#e0bd5f", "#7c608d"],
      [225, 330, "#cf8fae", "#f0d06c"], [430, 400, "#8068a6", "#e7ca58"],
      [25, 440, "#d2b04e", "#876a9d"],
    ];
    flowers.forEach(([cx, cy, petal, core], flowerIndex) => {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2 + flowerIndex * 0.2;
        context.save();
        context.translate(cx + Math.cos(angle) * 38, cy + Math.sin(angle) * 38);
        context.rotate(angle);
        context.fillStyle = petal;
        context.beginPath(); context.ellipse(0, 0, 29, 15, 0, 0, Math.PI * 2); context.fill();
        context.restore();
      }
      context.fillStyle = core;
      context.beginPath(); context.arc(cx, cy, 24, 0, Math.PI * 2); context.fill();
    });
    context.strokeStyle = "rgba(68,112,75,.7)";
    context.lineWidth = 12;
    context.beginPath(); context.moveTo(0, 260); context.bezierCurveTo(150, 210, 300, 470, 512, 260); context.stroke();
  });
}

function createFacadeTexture() {
  return createCanvasTexture(900, 620, (context, width, height) => {
    context.fillStyle = "#92999a";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#747c7e";
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const x = 34 + column * 98;
        const y = 36 + row * 112;
        context.fillRect(x, y, 62, 72);
        context.fillStyle = (row + column) % 4 === 0 ? "#c3c0ae" : "#667174";
        context.fillRect(x + 4, y + 4, 54, 64);
        context.fillStyle = "#747c7e";
      }
    }
    context.fillStyle = "rgba(54,63,65,.35)";
    context.fillRect(0, 450, width, 170);
  });
}

function createLabelTexture(title, subtitle, background, foreground) {
  return createCanvasTexture(640, 360, (context, width, height) => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = foreground;
    context.lineWidth = 12;
    context.strokeRect(18, 18, width - 36, height - 36);
    context.fillStyle = foreground;
    context.textAlign = "center";
    context.font = "700 76px sans-serif";
    context.fillText(title, width / 2, 165);
    context.font = "600 34px sans-serif";
    context.fillText(subtitle, width / 2, 235);
  });
}

function createMaterials() {
  const floorMap = createFloorTexture();
  floorMap.repeat.set(1.4, 1.5);
  const floralMap = createFloralTexture();
  floralMap.repeat.set(1, 1);
  const blindMap = createBlindTexture();
  blindMap.repeat.set(5, 6);
  const meshMap = createMeshTexture();
  meshMap.repeat.set(4, 5);
  const facadeMap = createFacadeTexture();
  return {
    wall: new THREE.MeshStandardMaterial({ color: 0xf1f0eb, roughness: 0.9, side: THREE.FrontSide }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.92, side: THREE.FrontSide }),
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorMap, roughness: 0.72 }),
    baseboard: new THREE.MeshStandardMaterial({ color: 0x171a1a, roughness: 0.55, metalness: 0.18 }),
    black: new THREE.MeshStandardMaterial({ color: 0x121516, roughness: 0.42, metalness: 0.28 }),
    softBlack: new THREE.MeshStandardMaterial({ color: 0x303435, roughness: 0.88 }),
    whiteMetal: new THREE.MeshStandardMaterial({ color: 0xe7e8e4, roughness: 0.38, metalness: 0.42 }),
    whitePlastic: new THREE.MeshStandardMaterial({ color: 0xe9ebe6, roughness: 0.52 }),
    cabinet: new THREE.MeshStandardMaterial({ color: 0x9da09b, roughness: 0.64, metalness: 0.16 }),
    lightWood: new THREE.MeshStandardMaterial({ color: 0xd8c08e, roughness: 0.61 }),
    redFabric: new THREE.MeshStandardMaterial({ color: 0xb80623, roughness: 0.82 }),
    chairMesh: new THREE.MeshStandardMaterial({ color: 0x666a69, map: meshMap, alphaMap: meshMap, alphaTest: 0.28, side: THREE.DoubleSide, roughness: 0.8 }),
    floral: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floralMap, roughness: 0.86, side: THREE.DoubleSide }),
    cardboard: new THREE.MeshStandardMaterial({ color: 0x9a6940, roughness: 0.92 }),
    redBox: new THREE.MeshStandardMaterial({ color: 0xa51f20, roughness: 0.82 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xa7a7a0, roughness: 0.24, metalness: 0.86 }),
    darkChrome: new THREE.MeshStandardMaterial({ color: 0x514d48, roughness: 0.3, metalness: 0.78 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbccacb, roughness: 0.08, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    frosted: new THREE.MeshStandardMaterial({ color: 0xd5dad7, roughness: 0.72, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    blinds: new THREE.MeshStandardMaterial({ color: 0xd9dbd7, map: blindMap, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, roughness: 0.95 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x152226, roughness: 0.2, metalness: 0.12, emissive: 0x07161a, emissiveIntensity: 0.38, side: THREE.FrontSide }),
    facade: new THREE.MeshBasicMaterial({ color: 0x9ca3a4, map: facadeMap, fog: true }),
    warmLight: new THREE.MeshStandardMaterial({ color: 0xffdca1, emissive: 0xffb450, emissiveIntensity: 2.4, toneMapped: false }),
  };
}

function curvedPanelGeometry(width, height, curve = 0.06, segments = 18) {
  const geometry = new THREE.PlaneGeometry(width, height, segments, 4);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const normalized = positions.getX(index) / (width * 0.5);
    positions.setZ(index, curve * normalized * normalized);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createRoomShell(scene, materials) {
  const root = new THREE.Group();
  root.name = "test-zpf-architecture";
  scene.add(root);
  box(root, [ROOM.width, 0.08, ROOM.depth], [1.75, -0.04, 1.8], materials.floor, "wood-plank-floor").castShadow = false;
  plane(root, [ROOM.width, ROOM.height], [1.75, 1.35, 3.59], [0, Math.PI, 0], materials.wall, "north-wall");
  plane(root, [0.22, ROOM.height], [0.11, 1.35, 0.01], [0, 0, 0], materials.wall, "south-wall-west");
  plane(root, [2.42, ROOM.height], [2.29, 1.35, 0.01], [0, 0, 0], materials.wall, "south-wall-east");
  plane(root, [0.86, 0.55], [0.65, 2.425, 0.01], [0, 0, 0], materials.wall, "south-door-header");
  plane(root, [ROOM.width, ROOM.depth], [1.75, 2.69, 1.8], [Math.PI / 2, 0, 0], materials.ceiling, "cutaway-ceiling");

  box(root, [ROOM.width, 0.07, 0.06], [1.75, 0.035, 3.55], materials.baseboard);
  box(root, [2.42, 0.07, 0.06], [2.29, 0.035, 0.05], materials.baseboard);
  box(root, [0.06, 0.07, ROOM.depth], [0.06, 0.035, 1.8], materials.baseboard);

  const door = new THREE.Group();
  door.name = "entry-door";
  door.position.set(0.65, 0, 0.025);
  root.add(door);
  plane(door, [0.84, 2.08], [0, 1.04, 0], [0, 0, 0], new THREE.MeshStandardMaterial({ color: 0xbda67d, roughness: 0.66, side: THREE.FrontSide }), "light-oak-door");
  box(door, [0.04, 2.16, 0.08], [-0.45, 1.08, 0], materials.black);
  box(door, [0.04, 2.16, 0.08], [0.45, 1.08, 0], materials.black);
  box(door, [0.94, 0.04, 0.08], [0, 2.14, 0], materials.black);
  box(door, [0.035, 1.1, 0.08], [0.28, 1.1, -0.055], materials.black, "door-long-pull");

  const switchPanel = box(root, [0.26, 0.18, 0.025], [2.15, 1.35, 0.035], materials.whitePlastic, "wall-control-panel");
  box(root, [0.08, 0.1, 0.012], [2.1, 1.35, 0.018], materials.cabinet);
  box(root, [0.08, 0.1, 0.012], [2.2, 1.35, 0.018], materials.cabinet);
  switchPanel.castShadow = false;

  [[0.18, 0.18, 1.8], [3.32, 0.18, 1.8], [1.75, 0.18, 0.18], [1.75, 0.18, 3.42]].forEach(([x, _w, z], index) => {
    if (index === 2) return;
    const size = index < 2 ? [0.22, 0.16, 3.25] : [3.15, 0.16, 0.22];
    box(root, size, [x, 2.58, z], materials.ceiling, `ceiling-cove-${index}`);
  });
  box(root, [2.55, 0.025, 0.035], [1.75, 2.49, 3.38], materials.warmLight, "warm-cove-strip").castShadow = false;
  box(root, [0.035, 0.025, 2.5], [0.18, 2.49, 1.8], materials.warmLight, "warm-cove-strip-west").castShadow = false;
  const downlightMaterial = new THREE.MeshStandardMaterial({ color: 0xf9f4df, emissive: 0xffe8b4, emissiveIntensity: 1.8, toneMapped: false });
  [[0.9, 0.9], [2.5, 0.8], [1.85, 2.35]].forEach(([x, z]) => {
    cylinder(root, 0.075, 0.018, [x, 2.585, z], downlightMaterial, [0, 0, 0], 24).castShadow = false;
  });
  box(root, [0.7, 0.025, 0.18], [1.05, 2.57, 2.55], materials.cabinet, "ceiling-return-vent").castShadow = false;
  box(root, [0.42, 0.025, 0.42], [2.55, 2.57, 2.5], materials.whitePlastic, "ceiling-supply-vent").castShadow = false;
  return root;
}

function createGlassWalls(scene, materials) {
  const root = new THREE.Group();
  root.name = "test-zpf-glass-and-windows";
  scene.add(root);

  plane(root, [ROOM.depth, 2.55], [0.025, 1.35, 1.8], [0, Math.PI / 2, 0], materials.glass, "west-glass-partition").renderOrder = 4;
  plane(root, [ROOM.depth, 0.92], [0.04, 1.35, 1.8], [0, Math.PI / 2, 0], materials.frosted, "west-frosted-band").renderOrder = 5;
  [0.04, 1.19, 2.39, 3.56].forEach((z) => box(root, [0.055, 2.7, 0.055], [0.025, 1.35, z], materials.black));
  box(root, [0.055, 0.06, ROOM.depth], [0.025, 2.67, 1.8], materials.black);
  box(root, [0.055, 0.06, ROOM.depth], [0.025, 0.04, 1.8], materials.black);

  const bays = [0.6, 1.8, 3.0];
  bays.forEach((z, index) => {
    plane(root, [1.14, 2.56], [3.49, 1.36, z], [0, -Math.PI / 2, 0], materials.glass, `east-window-${index}`).renderOrder = 4;
    const blind = plane(root, [1.06, index === 1 ? 2.25 : 2.42], [3.455, index === 1 ? 1.5 : 1.41, z], [0, -Math.PI / 2, 0], materials.blinds, `roller-blind-${index}`);
    blind.renderOrder = 6;
    blind.castShadow = false;
    box(root, [0.045, 0.055, 1.1], [3.44, index === 1 ? 2.59 : 2.63, z], materials.whiteMetal, `blind-roller-${index}`);
  });
  [0.02, 1.2, 2.4, 3.58].forEach((z) => box(root, [0.07, 2.7, 0.055], [3.49, 1.35, z], materials.black));
  box(root, [0.07, 0.06, ROOM.depth], [3.49, 2.67, 1.8], materials.black);
  box(root, [0.07, 0.06, ROOM.depth], [3.49, 0.04, 1.8], materials.black);
  for (let index = 0; index < 22; index += 1) {
    const y = 2.46 - index * 0.075;
    cylinder(root, 0.012, 0.016, [3.405, y, 3.42], materials.whitePlastic, [Math.PI / 2, 0, 0], 10, "blind-bead").castShadow = false;
  }
  return root;
}

function createMobileWhiteboard(scene, materials, statusLights) {
  const root = new THREE.Group();
  root.name = "test-zpf-mobile-whiteboard";
  scene.add(root);
  const boardMap = createWhiteboardTexture();
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardMap, roughness: 0.58, side: THREE.DoubleSide });
  const x = 0.27;
  plane(root, [1.82, 1.05], [x + 0.022, 1.35, 1.73], [0, Math.PI / 2, 0], boardMaterial, "handwritten-whiteboard");
  box(root, [0.055, 1.14, 1.94], [x, 1.35, 1.73], materials.black, "whiteboard-back").castShadow = false;
  plane(root, [1.82, 1.05], [x + 0.031, 1.35, 1.73], [0, Math.PI / 2, 0], boardMaterial, "whiteboard-writing");
  box(root, [0.065, 1.16, 0.045], [x + 0.045, 1.35, 0.75], materials.black);
  box(root, [0.065, 1.16, 0.045], [x + 0.045, 1.35, 2.71], materials.black);
  box(root, [0.065, 0.045, 1.95], [x + 0.045, 1.94, 1.73], materials.black);
  box(root, [0.065, 0.045, 1.95], [x + 0.045, 0.77, 1.73], materials.black);
  box(root, [0.14, 0.035, 1.45], [x + 0.12, 0.72, 1.73], materials.black, "marker-tray");
  [0.93, 2.53].forEach((z) => box(root, [0.055, 0.75, 0.055], [x, 0.39, z], materials.black));
  box(root, [0.055, 0.06, 1.85], [x, 0.17, 1.73], materials.black);
  [0.82, 1.04, 2.42, 2.64].forEach((z) => {
    const wheel = cylinder(root, 0.055, 0.035, [x + 0.08, 0.07, z], materials.black, [0, 0, Math.PI / 2], 16, "whiteboard-caster");
    wheel.castShadow = false;
  });
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3030, emissive: 0x000000, emissiveIntensity: 0 });
  statusLights.whiteboard = cylinder(root, 0.038, 0.015, [x + 0.06, 1.65, 2.5], ledMaterial, [0, 0, Math.PI / 2], 18, "whiteboard-check-magnet");
  cylinder(root, 0.032, 0.015, [x + 0.06, 1.05, 1.02], new THREE.MeshStandardMaterial({ color: 0x222222 }), [0, 0, Math.PI / 2], 18);
  return root;
}

function createChair(parent, materials, position, yaw, kind = "mesh") {
  const root = new THREE.Group();
  root.position.set(...position);
  root.rotation.y = yaw;
  root.name = kind === "red" ? "red-executive-chair" : "gray-mesh-visitor-chair";
  parent.add(root);
  const upholstery = kind === "red" ? materials.redFabric : materials.chairMesh;
  box(root, [kind === "red" ? 0.58 : 0.52, 0.1, 0.5], [0, 0.52, 0], kind === "red" ? materials.redFabric : materials.softBlack, "chair-seat");
  const backGeometry = curvedPanelGeometry(kind === "red" ? 0.6 : 0.54, kind === "red" ? 0.82 : 0.68, 0.045, 10);
  const back = mesh(root, backGeometry, upholstery, [0, kind === "red" ? 1.08 : 1.0, -0.24], [-0.08, 0, 0], "chair-back");
  back.castShadow = true;
  [-0.29, 0.29].forEach((x) => box(root, [0.045, kind === "red" ? 0.84 : 0.7, 0.045], [x, kind === "red" ? 1.08 : 1.0, -0.225], materials.black));
  cylinder(root, 0.055, 0.44, [0, 0.26, 0], materials.black, [0, 0, 0], 18, "chair-column");
  cylinder(root, 0.1, 0.06, [0, 0.13, 0], materials.black, [0, 0, 0], 18);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const leg = box(root, [0.055, 0.04, 0.42], [Math.sin(angle) * 0.17, 0.11, Math.cos(angle) * 0.17], materials.black, "chair-star-leg", [0, angle, 0]);
    leg.castShadow = false;
    const wheel = cylinder(root, 0.045, 0.04, [Math.sin(angle) * 0.37, 0.055, Math.cos(angle) * 0.37], materials.black, [Math.PI / 2, 0, angle], 14, "chair-caster");
    wheel.castShadow = false;
  }
  [-0.36, 0.36].forEach((x) => {
    box(root, [0.04, 0.32, 0.04], [x, 0.72, -0.02], materials.whiteMetal);
    box(root, [0.18, 0.045, 0.06], [x, 0.86, -0.02], kind === "red" ? materials.whitePlastic : materials.black);
  });
  if (kind === "red") {
    const headrest = mesh(root, curvedPanelGeometry(0.43, 0.18, 0.04, 8), materials.redFabric, [0, 1.53, -0.25], [0, 0, 0], "red-headrest");
    headrest.castShadow = true;
  }
  return root;
}

function createMonitor(parent, materials, statusLights) {
  const root = new THREE.Group();
  root.name = "curved-ultrawide-monitor";
  parent.add(root);
  const back = mesh(root, curvedPanelGeometry(0.94, 0.39, 0.07, 24), materials.black, [2.42, 1.16, 2.63], [0, Math.PI, 0], "curved-monitor-back");
  back.material.side = THREE.DoubleSide;
  const screen = mesh(root, curvedPanelGeometry(0.88, 0.34, 0.065, 24), materials.screen, [2.42, 1.16, 2.65], [0, 0, 0], "curved-monitor-screen");
  screen.castShadow = false;
  box(root, [0.08, 0.32, 0.06], [2.42, 0.95, 2.68], materials.black, "monitor-stand");
  const leftFoot = box(root, [0.36, 0.035, 0.055], [2.26, 0.795, 2.58], materials.black, "monitor-v-foot", [0, -0.42, 0]);
  const rightFoot = box(root, [0.36, 0.035, 0.055], [2.58, 0.795, 2.58], materials.black, "monitor-v-foot", [0, 0.42, 0]);
  leftFoot.castShadow = false;
  rightFoot.castShadow = false;
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x252b2a, emissive: 0x000000, emissiveIntensity: 0 });
  statusLights.workbench = box(root, [0.035, 0.018, 0.012], [2.76, 0.99, 2.57], ledMaterial, "monitor-status-led");
  statusLights.workbench.castShadow = false;
  return root;
}

function createSkull(parent, materials) {
  const root = new THREE.Group();
  root.name = "mechanical-skull-bust";
  root.position.set(0.53, 0.79, 2.83);
  root.rotation.y = -0.12;
  parent.add(root);
  const cranium = mesh(root, new THREE.SphereGeometry(0.18, 24, 16), materials.chrome, [0, 0.24, 0], [0, 0, 0], "chrome-skull-cranium");
  cranium.scale.set(0.9, 1.08, 0.86);
  box(root, [0.25, 0.16, 0.22], [0, 0.1, 0.025], materials.chrome, "skull-jaw");
  [-0.075, 0.075].forEach((x, index) => {
    const socket = mesh(root, new THREE.SphereGeometry(0.062, 16, 10), materials.black, [x, 0.24, -0.135], [0, 0, 0], "skull-eye-socket");
    socket.scale.z = 0.38;
    if (index === 1) {
      const eye = mesh(root, new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: 0x7d0c0c, emissive: 0xff1d10, emissiveIntensity: 1.4 }), [x, 0.24, -0.17], [0, 0, 0], "skull-red-eye");
      eye.castShadow = false;
    }
  });
  for (let index = 0; index < 8; index += 1) {
    box(root, [0.024, 0.055, 0.04], [-0.095 + index * 0.027, 0.095, -0.12], materials.whitePlastic, "skull-tooth").castShadow = false;
  }
  [-1, 1].forEach((side) => {
    cylinder(root, 0.022, 0.23, [side * 0.16, 0.15, 0.015], materials.darkChrome, [0.35, 0, side * 0.12], 12, "skull-mechanical-strut");
    mesh(root, new THREE.TorusGeometry(0.07, 0.012, 8, 20), materials.darkChrome, [side * 0.14, 0.32, 0], [0, Math.PI / 2, 0], "skull-temple-ring");
  });
  box(root, [0.28, 0.08, 0.24], [0, -0.025, 0.02], materials.darkChrome, "skull-plinth");
  return root;
}

function createWorkspace(scene, materials, statusLights) {
  const root = new THREE.Group();
  root.name = "test-zpf-workspace";
  scene.add(root);

  box(root, [0.9, 1.18, 0.4], [0.53, 0.59, 3.36], materials.cabinet, "gray-double-door-cabinet");
  box(root, [0.015, 1.05, 0.41], [0.53, 0.62, 3.145], materials.baseboard);
  [-0.12, 0.12].forEach((offset) => cylinder(root, 0.018, 0.018, [0.53 + offset, 0.63, 3.14], materials.chrome, [Math.PI / 2, 0, 0], 14));
  box(root, [0.46, 0.74, 0.52], [0.53, 0.37, 2.83], materials.whitePlastic, "white-three-drawer-cabinet");
  [0.22, 0.42, 0.62].forEach((y) => {
    box(root, [0.4, 0.012, 0.012], [0.53, y, 2.56], materials.baseboard);
    box(root, [0.19, 0.035, 0.018], [0.53, y + 0.04, 2.55], new THREE.MeshStandardMaterial({ color: 0x1c8a92, roughness: 0.48 }));
  });
  createSkull(root, materials);
  cylinder(root, 0.14, 0.38, [1.08, 0.19, 3.3], materials.softBlack, [0, 0, 0], 24, "black-waste-bin");
  mesh(root, new THREE.TorusGeometry(0.14, 0.012, 8, 24), materials.black, [1.08, 0.39, 3.3], [Math.PI / 2, 0, 0], "waste-bin-rim");

  box(root, [1.65, 0.075, 0.78], [2.42, 0.77, 2.66], materials.lightWood, "light-oak-desk");
  [[1.69, 2.36], [3.15, 2.36], [1.69, 2.96], [3.15, 2.96]].forEach(([x, z]) => box(root, [0.065, 0.74, 0.065], [x, 0.37, z], materials.whiteMetal, "white-desk-leg"));
  [1.74, 3.08].forEach((x) => cylinder(root, 0.052, 0.012, [x, 0.815, 2.42], materials.cardboard, [0, 0, 0], 24, "desk-cable-grommet"));
  createMonitor(root, materials, statusLights);
  createChair(root, materials, [2.42, 0, 3.23], Math.PI, "red");
  createChair(root, materials, [2.1, 0, 1.78], 0.08, "mesh");
  createChair(root, materials, [2.88, 0, 1.73], -0.12, "mesh");

  box(root, [0.36, 0.15, 0.28], [2.97, 0.88, 2.48], materials.softBlack, "black-hard-shell-case");
  box(root, [0.12, 0.035, 0.12], [2.78, 0.825, 2.78], new THREE.MeshStandardMaterial({ color: 0xe45524, roughness: 0.58 }), "orange-tool-holder");
  for (let index = 0; index < 5; index += 1) {
    cylinder(root, 0.008, 0.16, [2.74 + index * 0.022, 0.91, 2.77], index % 2 ? materials.chrome : materials.black, [0, 0, 0], 8, "desk-tool");
  }
  box(root, [0.09, 0.12, 0.055], [2.63, 0.875, 2.48], materials.whitePlastic, "white-usb-charger");
  plane(root, [0.28, 0.18], [2.85, 0.817, 2.93], [-Math.PI / 2, 0.2, 0], new THREE.MeshStandardMaterial({ color: 0xeee9dc, roughness: 0.92, side: THREE.DoubleSide }), "loose-paper").castShadow = false;
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x171a1a, roughness: 0.54 });
  const cables = [
    [[2.45, 0.82, 2.7], [2.58, 0.84, 2.9], [3.08, 0.82, 2.84]],
    [[2.31, 0.82, 2.69], [2.08, 0.83, 2.55], [1.86, 0.82, 2.46]],
  ];
  cables.forEach((points) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const cable = mesh(root, new THREE.TubeGeometry(curve, 28, 0.008, 6, false), cableMaterial, [0, 0, 0], [0, 0, 0], "desk-cable");
    cable.castShadow = false;
  });
  return root;
}

function createCorrugatedHose(parent, materials) {
  const points = [
    new THREE.Vector3(3.17, 0.77, 1.72),
    new THREE.Vector3(3.22, 1.08, 1.72),
    new THREE.Vector3(3.29, 1.48, 1.82),
    new THREE.Vector3(3.42, 1.85, 1.9),
    new THREE.Vector3(3.47, 2.1, 1.91),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const hoseMaterial = new THREE.MeshStandardMaterial({ color: 0xc7c7c1, roughness: 0.68 });
  const hose = mesh(parent, new THREE.TubeGeometry(curve, 64, 0.095, 10, false), hoseMaterial, [0, 0, 0], [0, 0, 0], "portable-ac-exhaust-hose");
  hose.castShadow = true;
  const normal = new THREE.Vector3(0, 0, 1);
  for (let index = 1; index < 22; index += 1) {
    const t = index / 23;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const ring = mesh(parent, new THREE.TorusGeometry(0.102, 0.008, 6, 18), materials.whitePlastic, [point.x, point.y, point.z], [0, 0, 0], "hose-corrugation");
    ring.quaternion.setFromUnitVectors(normal, tangent);
    ring.castShadow = false;
  }
}

function createChaise(parent, materials) {
  const root = new THREE.Group();
  root.name = "window-folding-chaise";
  parent.add(root);
  box(root, [0.68, 0.1, 1.5], [3.08, 0.34, 0.79], materials.softBlack, "chaise-cushion");
  box(root, [0.68, 0.1, 0.62], [3.08, 0.56, 0.28], materials.softBlack, "chaise-raised-back", [-0.32, 0, 0]);
  [-0.28, 0.28].forEach((xOffset) => {
    box(root, [0.035, 0.035, 1.55], [3.08 + xOffset, 0.24, 0.8], materials.black, "chaise-frame");
    [[0.28, 0.32], [1.28, 0.32]].forEach(([z, _y]) => box(root, [0.035, 0.3, 0.035], [3.08 + xOffset, 0.15, z], materials.black, "chaise-leg", [0, 0, xOffset > 0 ? -0.18 : 0.18]));
  });
  const pillowGeometry = new THREE.SphereGeometry(0.28, 18, 12);
  const pillow = mesh(root, pillowGeometry, materials.floral, [3.06, 0.58, 0.65], [0.18, 0, 0.16], "floral-pillow");
  pillow.scale.set(1.05, 0.35, 0.72);
  const darkPillow = mesh(root, new THREE.SphereGeometry(0.25, 16, 10), materials.softBlack, [3.08, 0.67, 0.27], [0, 0, -0.1], "dark-chaise-pillow");
  darkPillow.scale.set(1.1, 0.38, 0.8);
  const blanketGeometry = new THREE.PlaneGeometry(0.64, 0.74, 8, 8);
  const positions = blanketGeometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    positions.setZ(index, 0.018 * Math.sin(x * 18) + 0.014 * Math.cos(y * 15));
  }
  positions.needsUpdate = true;
  blanketGeometry.computeVertexNormals();
  const blanket = mesh(root, blanketGeometry, materials.floral, [3.08, 0.405, 0.92], [-Math.PI / 2, 0, 0.05], "floral-blanket");
  blanket.castShadow = false;
  return root;
}

function createWindowZone(scene, materials, statusLights) {
  const root = new THREE.Group();
  root.name = "test-zpf-window-lounge";
  scene.add(root);
  box(root, [0.42, 0.78, 0.38], [3.16, 0.39, 1.72], materials.whitePlastic, "portable-air-conditioner");
  const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x171b1b, roughness: 0.58 });
  plane(root, [0.28, 0.28], [2.944, 0.48, 1.72], [0, -Math.PI / 2, 0], ventMaterial, "ac-front-vent");
  for (let index = -3; index <= 3; index += 1) {
    box(root, [0.012, 0.018, 0.26], [2.934, 0.48 + index * 0.035, 1.72], materials.whiteMetal, "ac-vent-slat").castShadow = false;
  }
  const acStatusMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2422, emissive: 0x342b0c, emissiveIntensity: 0.35 });
  statusLights.window_ac = plane(root, [0.22, 0.09], [3.09, 0.788, 1.72], [-Math.PI / 2, 0, 0], acStatusMaterial, "ac-control-display");
  statusLights.window_ac.castShadow = false;
  createCorrugatedHose(root, materials);
  createChaise(root, materials);
  box(root, [0.55, 0.48, 0.28], [2.96, 0.24, 2.28], materials.black, "black-equipment-case");
  return root;
}

function createOpenBox(parent, materials, position) {
  const root = new THREE.Group();
  root.name = "open-cardboard-box";
  root.position.set(...position);
  parent.add(root);
  box(root, [0.62, 0.48, 0.035], [0, 0.26, -0.29], materials.cardboard);
  box(root, [0.62, 0.48, 0.035], [0, 0.26, 0.29], materials.cardboard);
  box(root, [0.035, 0.48, 0.55], [-0.29, 0.26, 0], materials.cardboard);
  box(root, [0.035, 0.48, 0.55], [0.29, 0.26, 0], materials.cardboard);
  box(root, [0.62, 0.035, 0.55], [0, 0.02, 0], materials.cardboard);
  box(root, [0.62, 0.025, 0.24], [0, 0.55, -0.4], materials.cardboard, "box-flap", [-0.55, 0, 0]);
  box(root, [0.62, 0.025, 0.24], [0, 0.55, 0.4], materials.cardboard, "box-flap", [0.55, 0, 0]);
  box(root, [0.24, 0.025, 0.55], [-0.4, 0.55, 0], materials.cardboard, "box-flap", [0, 0, 0.55]);
  box(root, [0.24, 0.025, 0.55], [0.4, 0.55, 0], materials.cardboard, "box-flap", [0, 0, -0.55]);
  return root;
}

function createSouthClutter(scene, materials) {
  const root = new THREE.Group();
  root.name = "test-zpf-south-storage-and-boxes";
  scene.add(root);
  [2.46, 2.89, 3.32].forEach((x, index) => {
    box(root, [0.41, 0.64, 0.44], [x, 0.32, 0.23], materials.whitePlastic, `low-storage-module-${index}`);
    box(root, [0.012, 0.6, 0.02], [x + 0.19, 0.32, 0.005], materials.cabinet).castShadow = false;
  });
  const redLabel = createLabelTexture("LED MONITOR", "GI SERIES GAMING", "#a81c1f", "#e8cfbb");
  const redLabelMaterial = new THREE.MeshBasicMaterial({ map: redLabel, side: THREE.DoubleSide, toneMapped: false });
  box(root, [0.7, 0.48, 0.22], [1.82, 0.25, 0.53], materials.redBox, "red-monitor-box-lower", [0, -0.08, 0]);
  plane(root, [0.58, 0.32], [1.81, 0.27, 0.405], [0, Math.PI, 0], redLabelMaterial, "monitor-box-label-lower").castShadow = false;
  box(root, [0.72, 0.5, 0.22], [1.88, 0.72, 0.56], materials.redBox, "red-monitor-box-upper", [0, 0.08, -0.05]);
  plane(root, [0.58, 0.32], [1.86, 0.74, 0.43], [0, Math.PI, -0.05], redLabelMaterial, "monitor-box-label-upper").castShadow = false;
  createOpenBox(root, materials, [2.24, 0, 0.78]);
  box(root, [0.28, 0.055, 0.09], [1.91, 1.01, 0.56], materials.whitePlastic, "white-power-strip");
  [1.83, 1.91, 1.99].forEach((x) => cylinder(root, 0.018, 0.01, [x, 1.045, 0.56], materials.cabinet, [0, 0, 0], 12));
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.03, 1.02, 0.56), new THREE.Vector3(2.13, 1.0, 0.46),
    new THREE.Vector3(1.97, 0.96, 0.39), new THREE.Vector3(1.82, 0.97, 0.48),
  ]);
  const cord = mesh(root, new THREE.TubeGeometry(cordCurve, 24, 0.012, 6, false), materials.whitePlastic, [0, 0, 0], [0, 0, 0], "coiled-power-cord");
  cord.castShadow = false;
  return root;
}

function createExterior(scene, materials) {
  const root = new THREE.Group();
  root.name = "test-zpf-muted-exterior";
  scene.add(root);
  box(root, [3.4, 0.04, 5.5], [6, -0.02, 1.8], new THREE.MeshBasicMaterial({ color: 0x5e6260, fog: true }), "parking-deck").castShadow = false;
  plane(root, [5.5, 4.2], [7.4, 2.05, 1.8], [0, -Math.PI / 2, 0], materials.facade, "opposite-building-facade").castShadow = false;
  const railMaterial = new THREE.MeshBasicMaterial({ color: 0x7c8586, fog: true });
  for (let index = 0; index < 7; index += 1) box(root, [0.06, 0.06, 3.4], [5.9, 0.35 + index * 0.28, 1.8], railMaterial, "exterior-fire-stair").castShadow = false;
  return root;
}

function createLighting(scene, materials) {
  scene.add(new THREE.HemisphereLight(0xe8eff0, 0x6f533d, 1.25));
  scene.add(new THREE.AmbientLight(0xf3eadb, 0.2));
  const daylight = new THREE.DirectionalLight(0xf1f5ef, 2.35);
  daylight.position.set(6.5, 7.5, 0.5);
  daylight.target.position.set(1.3, 0, 2.2);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.camera.left = -4.2;
  daylight.shadow.camera.right = 4.2;
  daylight.shadow.camera.top = 4.2;
  daylight.shadow.camera.bottom = -4.2;
  daylight.shadow.camera.near = 0.2;
  daylight.shadow.camera.far = 16;
  daylight.shadow.bias = -0.0004;
  scene.add(daylight, daylight.target);
  const warmFill = new THREE.PointLight(0xffc36c, 0.82, 6.5, 2);
  warmFill.position.set(0.55, 2.42, 0.6);
  scene.add(warmFill);
  const deskFill = new THREE.PointLight(0xffe1ad, 0.34, 4.5, 2);
  deskFill.position.set(2.15, 2.35, 2.45);
  scene.add(deskFill);
}

export function createTestZpfScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc4cbc9);
  scene.fog = new THREE.Fog(0xc4cbc9, 15, 31);
  const materials = createMaterials();
  const statusLights = {};

  createExterior(scene, materials);
  createRoomShell(scene, materials);
  createGlassWalls(scene, materials);
  createMobileWhiteboard(scene, materials, statusLights);
  createWorkspace(scene, materials, statusLights);
  createWindowZone(scene, materials, statusLights);
  createSouthClutter(scene, materials);
  createLighting(scene, materials);

  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (object.material?.transparent) object.castShadow = false;
  });

  return {
    scene,
    statusLights,
    assetReady: Promise.resolve([{ loaded: true, name: "test-zpf-procedural-office" }]),
  };
}

export function syncTestZpfVisuals(world, state) {
  Object.entries(world.statusLights).forEach(([id, light]) => {
    const checked = Boolean(state.inspected[id]);
    light.material.color.setHex(checked ? 0x84b999 : 0x28302f);
    light.material.emissive.setHex(checked ? 0x2fbe76 : id === "window_ac" ? 0x342b0c : 0x000000);
    light.material.emissiveIntensity = checked ? 1.35 : id === "window_ac" ? 0.35 : 0;
  });
}
