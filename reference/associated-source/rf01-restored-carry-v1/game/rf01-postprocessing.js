import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export const RF01_RENDER_PROFILE = Object.freeze({
  target: "desktop-1080p-30fps",
  effects: Object.freeze(["gtao", "smaa", "selective-threshold-bloom", "aces"]),
  gtao: Object.freeze({ radius: 0.34, distanceExponent: 1.6, thickness: 0.85, distanceFallOff: 1.0, scale: 1, samples: 16 }),
  bloom: Object.freeze({ strength: 0.16, radius: 0.22, threshold: 1.2 }),
});

export function createRF01PostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtaoPass.output = GTAOPass.OUTPUT.Default;
  gtaoPass.blendIntensity = 0.82;
  gtaoPass.updateGtaoMaterial(RF01_RENDER_PROFILE.gtao);
  gtaoPass.updatePdMaterial({ lumaPhi: 8, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 2, rings: 2, samples: 16 });
  gtaoPass.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-24, -1, -24), new THREE.Vector3(24, 9, 22)));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    RF01_RENDER_PROFILE.bloom.strength,
    RF01_RENDER_PROFILE.bloom.radius,
    RF01_RENDER_PROFILE.bloom.threshold,
  );
  const smaaPass = new SMAAPass();
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(gtaoPass);
  composer.addPass(bloomPass);
  composer.addPass(smaaPass);
  composer.addPass(outputPass);

  return {
    profile: RF01_RENDER_PROFILE,
    render(activeCamera = camera) {
      renderPass.camera = activeCamera;
      gtaoPass.camera = activeCamera;
      gtaoPass.gtaoMaterial.defines.PERSPECTIVE_CAMERA = activeCamera.isPerspectiveCamera ? 1 : 0;
      composer.render();
    },
    setSize(width, height) {
      composer.setSize(width, height);
    },
  };
}
