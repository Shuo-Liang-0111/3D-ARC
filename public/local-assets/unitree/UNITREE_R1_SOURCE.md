# Unitree R1 Official Simulation Asset

`unitree-r1-official-mujoco.glb` is converted from Unitree Robotics' official
`unitree_mujoco` repository:

- Repository: https://github.com/unitreerobotics/unitree_mujoco
- Revision: `4134cb5dc7ff1ba7f484deda48b5274b58694519`
- Source directory: `unitree_robots/r1`
- Source scene: `R1_C++.xml`
- Source meshes: `meshes/*.STL`
- Source license: BSD 3-Clause
- Conversion script: `tools/convert-unitree-r1-mujoco.mjs`

The GLB preserves the official MuJoCo body hierarchy, visible STL meshes,
per-geom transforms, and published MuJoCo color values. Collision-only meshes
are excluded where an official visual mesh exists. The MuJoCo box visuals used
for the torso and feet are retained.

The public R1 MuJoCo model includes fixed hand geometry within each wrist STL,
but it does not expose independently articulated finger links.

The runtime colorway references Unitree's official R1 product page:
https://www.unitree.com/R1/. It replaces MuJoCo visualization colors with the
published pearl-white, navy, graphite, blue, and red appearance while keeping
the official converted geometry and kinematic hierarchy unchanged.
