import * as pc from "playcanvas";
import * as THREE from "three";
const RF10_GAUSSIAN_ASSET = "/local-assets/gaussian/rf10/rf10-room-full.ply";
const RF10_GAUSSIAN_ROTATION_Z = Math.PI;

function copyCamera(source, target) {
  const position = source.getWorldPosition(new THREE.Vector3());
  const quaternion = source.getWorldQuaternion(new THREE.Quaternion());
  target.setPosition(position.x, position.y, position.z);
  target.setRotation(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  target.camera.fov = source.fov;
  target.camera.nearClip = source.near;
  target.camera.farClip = source.far;
}

function applyViewport(camera, view, width, height) {
  camera.camera.rect = new pc.Vec4(
    view.x / width,
    view.y / height,
    view.width / width,
    view.height / height,
  );
  camera.camera.scissorRect = camera.camera.rect;
  camera.camera.aspectRatio = view.width / Math.max(1, view.height);
}

export function createPlayCanvasGaussianLayer(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "rf10-playcanvas-gaussian";
  canvas.setAttribute("aria-hidden", "true");
  const startedAt = performance.now();
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "0",
    pointerEvents: "none",
  });
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.insertBefore(canvas, container.firstChild);

  const app = new pc.Application(canvas, {
    graphicsDeviceOptions: {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
    },
  });
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.scene.backgroundColor = new pc.Color(0, 0, 0, 0);

  const asset = new pc.Asset("rf10-room-full", "gsplat", { url: RF10_GAUSSIAN_ASSET });
  app.assets.add(asset);
  const room = new pc.Entity("rf10-room-gaussian");
  room.addComponent("gsplat", { asset });
  room.setEulerAngles(0, 0, THREE.MathUtils.radToDeg(RF10_GAUSSIAN_ROTATION_Z));
  app.root.addChild(room);

  const firstCamera = new pc.Entity("rf10-first-camera");
  firstCamera.addComponent("camera", {
    clearColor: new pc.Color(0, 0, 0, 0),
    clearColorBuffer: true,
    clearDepthBuffer: true,
    fov: 58,
    nearClip: 0.1,
    farClip: 100,
    priority: 0,
  });
  app.root.addChild(firstCamera);

  const thirdCamera = new pc.Entity("rf10-third-camera");
  thirdCamera.addComponent("camera", {
    clearColor: new pc.Color(0, 0, 0, 0),
    clearColorBuffer: true,
    clearDepthBuffer: true,
    fov: 58,
    nearClip: 0.1,
    farClip: 100,
    priority: 1,
  });
  app.root.addChild(thirdCamera);

  let currentViews = [];
  let currentCameras = null;
  const sync = () => {
    if (!currentCameras || currentViews.length === 0) return;
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    firstCamera.enabled = false;
    thirdCamera.enabled = false;
    for (const view of currentViews) {
      const camera = view.view === "first" ? firstCamera : thirdCamera;
      const source = view.view === "first" ? currentCameras.first : currentCameras.third;
      if (!source) continue;
      copyCamera(source, camera);
      applyViewport(camera, view, width, height);
      camera.enabled = true;
    }
  };
  app.on("update", sync);

  app.start();
  const ready = new Promise((resolve) => {
    const finish = (loaded, error = null) => resolve({
      loaded,
      url: RF10_GAUSSIAN_ASSET,
      loadMs: performance.now() - startedAt,
      error,
    });
    asset.once("load", () => finish(true));
    asset.once("error", (error) => finish(false, error));
    app.assets.load(asset);
  });

  return {
    canvas,
    app,
    room,
    ready,
    syncViews(views, cameras) {
      currentViews = views;
      currentCameras = cameras;
      sync();
    },
    dispose() {
      app.destroy();
      canvas.remove();
    },
  };
}
