import bpy
import json
import pathlib
import sys

arguments = sys.argv[sys.argv.index("--") + 1:]
layout = json.loads(pathlib.Path(arguments[0]).read_text())
output = pathlib.Path(arguments[1])
output.mkdir(parents=True, exist_ok=True)

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

def material(color):
    key = "RF13_" + color
    existing = bpy.data.materials.get(key)
    if existing:
        return existing
    result = bpy.data.materials.new(key)
    result.diffuse_color = tuple(int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)) + (1,)
    result.use_nodes = True
    result.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = result.diffuse_color
    result.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    return result

def box(name, size, position, color, collision=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    mesh = bpy.context.object
    mesh.name = name
    mesh.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mesh.data.materials.append(material(color))
    if collision:
        mesh["collision"] = True
        mesh["shape"] = "box"
    return mesh

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(output / (name + ".glb")), export_format="GLB", export_yup=True, export_extras=True, export_cameras=False, export_lights=False)

reset()
for entry in layout["boxes"]:
    box(entry["id"], entry["size"], entry["position"], entry["color"])
box("opening-terminal", [0.3, 0.22, 0.15], [3.5, 1.01, 2.5], "#59766e")
export("environment")
reset()
for entry in layout["boxes"]:
    box("COLLIDER_" + entry["id"], entry["size"], entry["position"], "#aaaaaa", True)
export("collision")
for entry in layout["supplies"]:
    reset()
    box(entry["id"], [0.38, 0.22, 0.28], [0, 0.11, 0], entry["color"])
    box("lid", [0.39, 0.025, 0.29], [0, 0.2225, 0], "#e5e8e2")
    export(entry["id"])
reset()
box("empty-base", [0.38, 0.025, 0.28], [0, 0.0125, 0], "#b4a184")
for side in [-1, 1]:
    box("side", [0.025, 0.19, 0.28], [side * 0.1775, 0.12, 0], "#b4a184")
    box("end", [0.33, 0.19, 0.025], [0, 0.12, side * 0.1275], "#b4a184")
export("empty-box")
reset()
box("seat", [0.6, 0.08, 0.55], [0, 0.46, 0], "#8da9a2")
box("back", [0.6, 0.45, 0.08], [0, 0.675, 0.285], "#8da9a2")
for offset_x in [-0.24, 0.24]:
    for offset_z in [-0.22, 0.22]:
        box("leg", [0.045, 0.42, 0.045], [offset_x, 0.21, offset_z], "#6f7c77")
export("chair")
reset()
for height in [0.22, 0.72]:
    box("tray", [0.65, 0.06, 0.55], [0, height, 0], "#91a7a2")
for offset_x in [-0.28, 0.28]:
    for offset_z in [-0.23, 0.23]:
        box("upright", [0.035, 0.86, 0.035], [offset_x, 0.45, offset_z], "#6f7c77")
export("trolley")
