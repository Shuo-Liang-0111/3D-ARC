# RF-02 fixture lighting v8

RF-02, RF-02-2 and RF-02-3 use the same twelve suspended library lamps. The previous six point lights did not align with those fixtures and illuminated isolated spots on the ceiling. They are removed. The existing lamp diffuser faces now have a warm-white emissive material; each fixture contains two downward glTF spot lights inside its footprint, 6 mm below the diffuser. Housing and suspension geometry remain unchanged.

The loader initially hides imported lights. `activateLibraryFixtureLights` enables only explicitly tagged RF-02 tube lights and rebinds each cloned spotlight to its own child target. This keeps every clone pointing down; unrelated asset lights remain hidden. Existing daylight, ambient light, robot, gameplay, cameras and collision layout are unchanged.

Validation: the lamp build confirms no mesh vertices moved; the focused glTF audit checks all 12 fixtures / 24 emitters, downward cones, attachment targets and diffuser emission. Source syntax, all six staged bundle syntax checks and the production JS build passed. First-person screenshots show lit diffusers and no central ceiling hotspot; the third-person cutaway remains visible. Online RF-02 first-person was also inspected. HTTP bytes match the candidate HTML, lamp GLB and six changed bundles. No full route, movement-budget or unrelated interaction tests were run.

Asset: `/local-assets/cardinal/rf02/models/runtime/library-lighting-v8/suspended-linear-light.glb`.
Production: `./authoring/server-production/rf02-lighting-v8/release`, port 4192.
Rollback: `./authoring/server-production/rf02-surfaces-v7/release`.
Evidence and audit outputs: `./authoring/server-production/rf02-lighting-v8/`.

`stage-lighting-release.mjs` applies only the four lighting source changes and the shared activation helper to the verified v7 bundle, then rehashes importing bundles. It preserves the previous deployed gameplay and excludes unrelated working-tree changes. Rebuild the lamp with Blender using `build-library-lights.py -- <task-directory>`, run `check-library-lights.mjs`, and stage to a new output directory. Assets and generated output stay on the server outside Git.
