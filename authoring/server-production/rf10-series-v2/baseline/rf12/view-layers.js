import * as THREE from "three";

export function addKitchenViewLayers(world) {
  const root = new THREE.Group();
  root.name = "rf10-kitchen-ceiling-view-layer";
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(8.1, 0.08, 6.5),
    new THREE.MeshStandardMaterial({ color: 0xe4e0d7, roughness: 0.88, metalness: 0.01 }),
  );
  ceiling.position.set(0, 2.76, 0);
  ceiling.receiveShadow = true;
  root.add(ceiling);
  for (const x of [-2.1, 0, 2.1]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.035, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xf7f0d8, emissive: 0xffedba, emissiveIntensity: 1.8, roughness: 0.32 }),
    );
    light.position.set(x, 2.70, 0.45);
    root.add(light);
  }
  root.visible = false;
  world.scene.add(root);
  world.ceilingRoot = root;
  return world;
}
