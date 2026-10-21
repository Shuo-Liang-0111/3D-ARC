import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createLibraryScene } from "./scene.js";
import { LEVEL } from "./level.js";
import { ASSET_ROOT, BOOKS, CART, CHAIRS, REVISION, shelfPose } from "./series-layout.js";

export function createArchiveScene() {
  const world = createLibraryScene();
  world.revision = REVISION;
  world.archiveRoots = { ...world.bookRoots };
  world.fallenBooks = new Set();
  world.collisionRoots = new Map();
  const originalReady = world.assetReady;
  const collisionReady = new Promise((resolve) => new GLTFLoader().load(ASSET_ROOT + "/library-collision.glb", (gltf) => {
    gltf.scene.visible = false;
    world.scene.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    const boxes = new Map();
    gltf.scene.traverse((node) => {
      if (node.userData.collision && node.isMesh) {
        boxes.set(node.name, new THREE.Box3().setFromObject(node));
        world.collisionRoots.set(node.name.replace("COLLIDER_", ""), node);
      }
    });
    const valid = LEVEL.staticColliders.every((rect) => {
      const bounds = boxes.get("COLLIDER_" + rect.id);
      return bounds && Math.abs(bounds.min.x - rect.minX) < 0.001 && Math.abs(bounds.max.x - rect.maxX) < 0.001
        && Math.abs(bounds.min.z - rect.minZ) < 0.001 && Math.abs(bounds.max.z - rect.maxZ) < 0.001;
    });
    resolve({ loaded: valid, name: "shared-library-collision", url: ASSET_ROOT + "/library-collision.glb" });
  }, undefined, () => resolve({ loaded: false, name: "shared-library-collision" })));
  world.collisionReady = collisionReady;
  const fixturesReady = new Promise((resolve) => new GLTFLoader().load(ASSET_ROOT + "/ceiling-fixtures.glb", (gltf) => {
    world.scene.add(gltf.scene);
    resolve({ loaded: true, name: "ceiling-fixtures", url: ASSET_ROOT + "/ceiling-fixtures.glb" });
  }, undefined, () => resolve({ loaded: false, name: "ceiling-fixtures" })));
  const operationsReady = new Promise((resolve) => new GLTFLoader().load(ASSET_ROOT + "/closing-fixtures.glb", (gltf) => {
    world.scene.add(gltf.scene);
    resolve({ loaded: Boolean(gltf.scene.getObjectByName("parking-side-1")), name: "closing-fixtures", url: ASSET_ROOT + "/closing-fixtures.glb" });
  }, undefined, () => resolve({ loaded: false, name: "closing-fixtures" })));
  const label = document.createElement("canvas");
  label.width = 1024; label.height = 256;
  const context = label.getContext("2d");
  context.fillStyle = "#e6bd31"; context.fillRect(0, 0, 1024, 256);
  context.strokeStyle = "#282a21"; context.lineWidth = 18; context.strokeRect(10, 10, 1004, 236);
  context.fillStyle = "#20241e"; context.textAlign = "center"; context.textBaseline = "middle";
  context.font = "bold 82px sans-serif"; context.fillText("还书车停放区", 512, 108);
  context.font = "36px sans-serif"; context.fillText("BOOK CART PARKING", 512, 197);
  const signMaterial = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(label), roughness: 0.9, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.625), signMaterial);
  sign.name = "cart-parking-wall-sign";
  sign.position.set(11.73, 1.7, CART.parking.z);
  sign.rotation.y = -Math.PI / 2;
  world.scene.add(sign);
  const floorLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.4125), signMaterial);
  floorLabel.name = "cart-parking-floor-label";
  floorLabel.rotation.x = -Math.PI / 2;
  floorLabel.position.set(CART.parking.x, 0.012, CART.parking.z + 0.4);
  world.scene.add(floorLabel);
  world.assetReady = Promise.all([originalReady, collisionReady, fixturesReady, operationsReady]).then(([results, collision, fixtures, operations]) => {
    for (const book of BOOKS.filter((entry) => !world.archiveRoots[entry.id])) {
      const root = new THREE.Group();
      root.name = "archive-book-" + book.id;
      root.add(world.assetRoots.books[book.color].clone(true));
      world.scene.add(root);
      world.archiveRoots[book.id] = root;
    }
    world.chairRoots = Object.fromEntries(CHAIRS.map((chair) => [chair.id, world.assetRoots.staticSlice.getObjectByName(chair.model)]));
    world.cartRoot = world.assetRoots.staticSlice.getObjectByName("returnCart");
    const furnitureValid = Object.values(world.chairRoots).every(Boolean) && Boolean(world.cartRoot);
    return [...results, collision, fixtures, operations, { loaded: furnitureValid, name: "shared-furniture-bindings" }];
  });
  return world;
}

function poseBook(root, book, state) {
  root.visible = book.location !== "carried";
  if (!root.visible) return;
  let pose = book.location === "shelved" ? shelfPose(book.color, book.id) : book;
  let tilt = 0;
  if (book.location === "table" && book.support === "return-cart" && state.cart) pose = { ...pose, x: state.cart.x, z: state.cart.z, rotation: state.cart.yaw - CART.yaw };
  if (book.location === "falling") {
    const source = shelfPose(book.color, book.id);
    const progress = Math.min(1, book.fallElapsed / 0.95);
    const travel = Math.min(1, progress / 0.8), falling = Math.max(0, (progress - 0.24) / 0.76);
    pose = {
      x: source.x + (book.landing.x - source.x) * travel,
      z: source.z + (book.landing.z - source.z) * travel,
      y: Math.max(0.012, source.y * (1 - falling * falling)), rotation: source.rotation,
    };
    tilt = Math.sin(Math.PI * falling) * 0.65;
  }
  root.position.set(pose.x, pose.y ?? 0.78, pose.z);
  root.rotation.set(tilt, pose.rotation ?? 0, 0);
}

export function syncArchiveVisuals(world, state) {
  for (const definition of BOOKS) {
    const root = world.archiveRoots[definition.id];
    if (!root) continue;
    const book = state.books[definition.id] ? { ...definition, ...state.books[definition.id] } : definition;
    poseBook(root, book, state);
    if (book.fallen && book.location === "ground" && !world.fallenBooks.has(book.id)) {
      world.fallenBooks.add(book.id);
      if (world.bookImpact) { world.bookImpact.currentTime = 0; world.bookImpact.play().catch(() => {}); }
    }
  }
  if (!state.incident || state.incident.drops === 0) world.fallenBooks.clear();
  for (const definition of CHAIRS) {
    const chair = state.chairs?.[definition.id] ?? definition;
    const root = world.chairRoots?.[definition.id];
    if (root) { root.position.set(chair.x, 0, chair.z); root.rotation.y = definition.modelYaw + chair.yaw; }
    const collision = world.collisionRoots.get(definition.id);
    if (collision) { collision.position.x = chair.x; collision.position.z = chair.z; collision.rotation.y = chair.yaw; }
  }
  const cart = state.cart ?? CART;
  if (world.cartRoot) { world.cartRoot.position.set(cart.x, 0, cart.z); world.cartRoot.rotation.y = cart.yaw - CART.yaw; }
  const cartCollision = world.collisionRoots.get("return-cart");
  if (cartCollision) { cartCollision.position.x = cart.x; cartCollision.position.z = cart.z; cartCollision.rotation.y = cart.yaw - CART.yaw; }
}
