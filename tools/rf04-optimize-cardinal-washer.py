import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args(values)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
objects = [object for object in bpy.context.scene.objects if object.type == "MESH"]
if not objects:
    raise RuntimeError("Cardinal washer source contains no mesh")

for object in objects:
    bpy.context.view_layer.objects.active = object
    object.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    object.select_set(False)

points = [object.matrix_world @ Vector(corner) for object in objects for corner in object.bound_box]
minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
size = maximum - minimum
scale = 0.85 / max(size.z, 1e-6)
for object in objects:
    object.scale *= scale
    bpy.context.view_layer.objects.active = object
    object.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    object.select_set(False)

points = [object.matrix_world @ Vector(corner) for object in objects for corner in object.bound_box]
minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
center = (minimum + maximum) * 0.5
for object in objects:
    object.location.x -= center.x
    object.location.y -= center.y
    object.location.z -= minimum.z

for object in objects:
    bpy.context.view_layer.objects.active = object
    object.select_set(True)
    modifier = object.modifiers.new("runtime_decimate", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = 0.12
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    object.select_set(False)
    material = bpy.data.materials.new("rf04_cardinal_washer_enamel")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.86, 0.86, 0.82, 1.0)
    shader.inputs["Roughness"].default_value = 0.38
    shader.inputs["Metallic"].default_value = 0.08
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    object.data.materials.clear()
    object.data.materials.append(material)
    object.name = "rf04_cardinal_washer_body"
    object["frontAxis"] = "-Z"
    object["pivot"] = "bottom-center"
    object["sourceTaskId"] = "aigc_de8c8d0463cb49e289760deafc9ac04f"

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=str(Path(args.output).resolve()), export_format="GLB", export_image_format="NONE", export_apply=True)
print(f"exported {args.output} from {size.x:.4f} x {size.y:.4f} x {size.z:.4f} source meters")
