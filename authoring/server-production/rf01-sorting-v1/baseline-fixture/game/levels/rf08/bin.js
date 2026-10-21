import * as THREE from 'three';

export const OFFICE_BIN = Object.freeze({ x: -0.82, z: 2.01, radius: 0.16, height: 0.31, reach: 0.85 });
export function createBinModel() {
  const root = new THREE.Group();
  root.name = 'rf08-interactive-wastebasket';
  root.userData.robotScale = 1;
  const material = new THREE.MeshStandardMaterial({ color: 0x171817, roughness: 0.9, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.105, OFFICE_BIN.height, 48, 1, true), material);
  shell.position.y = OFFICE_BIN.height / 2;
  root.add(shell);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 48), material);
  bottom.position.y = 0.006;
  root.add(bottom);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.009, 8, 48), material);
  lip.rotation.x = Math.PI / 2; lip.position.y = OFFICE_BIN.height; root.add(lip);
  root.userData.assetReady = Promise.resolve({ loaded: true, mode: 'static-mesh' });
  return root;
}
export function syncOfficeBin(world, state) {
  world.binRoot.visible = state.bin.location === 'floor';
  world.binRoot.position.set(state.bin.x, 0, state.bin.z);
  world.binRoot.rotation.y = state.bin.yaw ?? 0;
}
