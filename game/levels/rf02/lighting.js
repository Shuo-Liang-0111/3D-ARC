// The fixture carries both its emissive diffuser and downward light sources.
export const LIBRARY_LAMP_ASSET = "/local-assets/cardinal/rf02/models/runtime/library-lighting-v8/suspended-linear-light.glb";
export const LIBRARY_LAMP_PLACEMENTS = Object.freeze(
  [-9, -3, 3, 9].flatMap(x => [-4.8, 0.2, 5.2].map(z => Object.freeze([x, 3.24, z, 0]))),
);

export function activateLibraryFixtureLights(root) {
  root.traverse(object => {
    if (!object.isSpotLight || !object.userData.rf02TubeLight) return;
    // SpotLight.clone() copies target separately from its cloned children.
    // Bind to the GLTFLoader target that actually belongs to this instance.
    const target = object.children.find(child => !child.isMesh && !child.isLight);
    if (!target) throw new Error("RF-02 lamp is missing its downward light target");
    object.target = target;
    object.visible = true;
    object.castShadow = false;
  });
}
