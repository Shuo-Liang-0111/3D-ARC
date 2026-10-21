import bpy
import hashlib
import json
import math
import pathlib
import sys
from mathutils import Vector

root = pathlib.Path(".")
production = root / "production/rf13/realism-v0.3"
output = root / "public/local-assets/levels/rf13/cardinal-v0.3"
layout = json.loads((production / "layout.json").read_text())
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, roughness=0.65, metallic=0, texture=None):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes["Principled BSDF"]
    values = [int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in values]
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if texture:
        image = bpy.data.images.load(str(production / "source" / (texture + ".png")), check_existing=True)
        image.pack()
        node = result.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        result.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    return result

paint = material("warm washable plaster", "#e5e7df")
white = material("white solid surface", "#e4e8e5", 0.3)
teal = material("sage enamel", "#527d76", 0.48)
dark = material("charcoal plinth", "#303b39")
metal = material("satin stainless", "#afb9b6", 0.35, 0.6)
oak = material("oak laminate", "#cbb69a", 0.48, texture="oak")
floor = material("hospital vinyl", "#c0c4bc", 0.72, texture="floor")
glass = material("frosted daylight glazing", "#aacbd0", 0.32)
shade = material("roller shade linen", "#dcd9cb")
trim = material("anodized frame", "#849591", 0.42, 0.4)

def group(name):
    result = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(result)
    return result

def cube(name, size, position, surface, parent=None, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    result = bpy.context.object
    result.name = name
    result.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    result.data.materials.append(surface)
    result.parent = parent
    layer = result.data.uv_layers.active
    for polygon in result.data.polygons:
        normal = polygon.normal
        axes = (0, 1) if abs(normal.z) > 0.5 else (0, 2) if abs(normal.y) > 0.5 else (1, 2)
        for loop_index in polygon.loop_indices:
            point = result.data.vertices[result.data.loops[loop_index].vertex_index].co + result.location
            layer.data[loop_index].uv = (point[axes[0]], point[axes[1]])
    if bevel:
        modifier = result.modifiers.new("manufactured edge", "BEVEL")
        modifier.width = min(bevel, min(size) / 4)
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = result.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return result

def rod(name, start, end, radius, surface, parent):
    first = Vector((start[0], -start[2], start[1]))
    second = Vector((end[0], -end[2], end[1]))
    vector = second - first
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=vector.length, location=(first + second) / 2)
    result = bpy.context.object
    result.name = name
    result.rotation_euler = vector.to_track_quat("Z", "Y").to_euler()
    result.data.materials.append(surface)
    result.parent = parent
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    return result

def cabinet(entry):
    parent = group(entry["id"])
    width, height, depth = entry["size"]
    center_x, center_y, center_z = entry["position"]
    base = center_y - height / 2
    cube("carcass", [width, height - 0.15, depth - 0.055], [center_x, base + 0.09 + (height - 0.15) / 2, center_z - 0.0275], oak, parent, 0.012)
    cube("countertop", [width, 0.045, depth], [center_x, base + height - 0.0225, center_z], white, parent, 0.01)
    cube("kickboard", [width - 0.05, 0.085, 0.012], [center_x, base + 0.045, center_z + depth / 2 - 0.012], dark, parent)
    count = max(1, round(width / 0.6))
    for index in range(count):
        panel_x = center_x - width / 2 + (index + 0.5) * width / count
        panel_width = width / count - 0.016
        cube("door panel", [panel_width, height - 0.37, 0.018], [panel_x, base + (height - 0.37) / 2 + 0.105, center_z + depth / 2 - 0.015], teal, parent)
        cube("drawer", [panel_width, 0.18, 0.018], [panel_x, base + height - 0.16, center_z + depth / 2 - 0.015], white, parent)
        rod("drawer pull", [panel_x - 0.08, base + height - 0.16, center_z + depth / 2 - 0.003], [panel_x + 0.08, base + height - 0.16, center_z + depth / 2 - 0.003], 0.005, metal, parent)
    return parent

def imported(name, position, parent):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(output / (name + ".glb")))
    added = set(bpy.data.objects) - before
    offset = Vector((position[0], -position[2], position[1]))
    for obj in added:
        if obj.parent not in added:
            obj.location += offset
            obj.parent = parent

def examination_couch(entry):
    parent = group(entry["id"])
    center_x, _, center_z = entry["position"]
    cube("upholstered seat", [0.75, 0.09, 1.32], [center_x, 0.605, center_z + 0.285], teal, parent, 0.04)
    cube("head cushion", [0.75, 0.09, 0.56], [center_x, 0.605, center_z - 0.67], teal, parent, 0.04)
    cube("upholstery seam", [0.74, 0.003, 0.005], [center_x, 0.648, center_z - 0.39], dark, parent, 0)
    cube("steel couch frame", [0.69, 0.07, 1.82], [center_x, 0.525, center_z], white, parent, 0.015)
    for side in [-1, 1]:
        for end in [-1, 1]:
            rod("couch leg", [center_x + side * 0.3, 0.045, center_z + end * 0.78], [center_x + side * 0.3, 0.51, center_z + end * 0.78], 0.024, metal, parent)
            cube("rubber foot", [0.068, 0.045, 0.068], [center_x + side * 0.3, 0.0225, center_z + end * 0.78], dark, parent, 0.012)
        rod("couch stretcher", [center_x + side * 0.3, 0.18, center_z - 0.78], [center_x + side * 0.3, 0.18, center_z + 0.78], 0.018, metal, parent)
    rod("paper roll spindle", [center_x - 0.31, 0.4, center_z - 0.84], [center_x + 0.31, 0.4, center_z - 0.84], 0.018, metal, parent)
    rod("examination paper", [center_x - 0.27, 0.4, center_z - 0.84], [center_x + 0.27, 0.4, center_z - 0.84], 0.055, white, parent)
    return parent

def countertop_equipment(entry):
    center_x, _, center_z = entry["position"]
    cube("monitor base", [0.24, 0.025, 0.18], [center_x, 0.913, center_z - 0.20], dark)
    rod("monitor support", [center_x, 0.925, center_z - 0.20], [center_x, 1.13, center_z - 0.20], 0.018, metal, None)
    cube("monitor bezel", [0.36, 0.23, 0.025], [center_x, 1.19, center_z - 0.22], dark, bevel=0.012)
    cube("monitor display", [0.325, 0.192, 0.002], [center_x, 1.19, center_z - 0.205], glass)
    cube("keyboard", [0.28, 0.012, 0.08], [center_x, 0.906, center_z + 0.1], dark)
    for row in range(3):
        for column in range(10):
            cube("keycap", [0.019, 0.004, 0.014], [center_x - 0.115 + column * 0.025, 0.914, center_z + 0.075 + row * 0.021], trim, bevel=0.001)

for entry in layout["boxes"]:
    name = entry["id"]
    size = entry["size"]
    position = entry["position"]
    if name.startswith("exam-bed-"):
        parent = examination_couch(entry)
    elif name.startswith("waiting-seat-"):
        imported("chair", [position[0], 0, position[2]], group(name))
    elif entry["category"] == "fixture":
        cabinet(entry)
        if name.startswith("counter-"):
            countertop_equipment(entry)
    elif name == "north-wall":
        parent = group(name)
        cube("window sill wall", [14, 1.55, 0.16], [0, 0.775, -5], paint, parent)
        cube("window head wall", [14, 0.45, 0.16], [0, 2.575, -5], paint, parent)
        boundaries = [-7, -6.25, -4.25, -2.75, -0.75, 0.75, 2.75, 4.25, 6.25, 7]
        for index in range(0, len(boundaries) - 1, 2):
            left, right = boundaries[index:index + 2]
            cube("window pier", [right - left, 0.8, 0.16], [(left + right) / 2, 1.95, -5], paint, parent)
        for center in [-5.25, -1.75, 1.75, 5.25]:
            cube("glazing", [1.93, 0.74, 0.018], [center, 1.95, -5], glass, parent)
            for offset in [-0.98, 0, 0.98]:
                cube("window upright", [0.035, 0.8, 0.12], [center + offset, 1.95, -5], trim, parent)
            for height in [1.565, 2.335]:
                cube("window rail", [2, 0.03, 0.12], [center, height, -5], trim, parent)
            cube("rolled blind", [1.9, 0.055, 0.06], [center, 2.31, -4.95], shade, parent)
            cube("blind fabric", [1.89, 0.15, 0.008], [center, 2.22, -4.935], shade, parent)
    else:
        parent = group(name)
        surface = floor if name == "floor" else paint
        cube(name + " surface", size, position, surface, parent, 0 if name == "floor" else 0.002)
    if entry["category"] == "wall":
        width, height, depth = size
        center_x, center_y, center_z = position
        if width > depth:
            for side in [-1, 1]:
                cube("washable wall lower band", [width, 0.75, 0.006], [center_x, 0.44, center_z + side * (depth / 2 + 0.002)], teal, parent)
                cube("skirting", [width, 0.065, 0.008], [center_x, 0.0325, center_z + side * (depth / 2 + 0.002)], dark, parent)
        else:
            for side in [-1, 1]:
                cube("washable wall lower band", [0.006, 0.75, depth], [center_x + side * (width / 2 + 0.002), 0.44, center_z], teal, parent)
                cube("skirting", [0.008, 0.065, depth], [center_x + side * (width / 2 + 0.002), 0.0325, center_z], dark, parent)
for center in [-5.25, -1.75, 1.75, 5.25]:
    for side in [-1, 1]:
        cube("door jamb", [0.048, 2.2, 0.115], [center + side * 0.725, 1.1, -1], oak)
    cube("door head", [1.5, 0.06, 0.115], [center, 2.23, -1], oak)
    cube("door threshold", [1.4, 0.004, 0.11], [center, 0.002, -1], trim)

bpy.context.view_layer.update()
measurements = {}
for parent in bpy.context.scene.objects:
    if parent.type != "EMPTY":
        continue
    meshes = [obj for obj in parent.children_recursive if obj.type == "MESH"]
    points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    if not points:
        continue
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    measurements[parent.name] = {"min": [minimum[0], minimum[2], -maximum[1]], "max": [maximum[0], maximum[2], -minimum[1]]}
(output / "environment-measurements.json").write_text(json.dumps(measurements, indent=2))
bpy.ops.export_scene.gltf(filepath=str(output / "environment.glb"), export_format="GLB", export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(production / "environment.blend"))
print("Exported environment", hashlib.sha256((output / "environment.glb").read_bytes()).hexdigest())
