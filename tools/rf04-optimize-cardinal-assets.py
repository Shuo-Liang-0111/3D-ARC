import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--source-task-id", required=True)
    parser.add_argument("--target-x", type=float, required=True, help="Target glTF X size in meters.")
    parser.add_argument("--target-y", type=float, required=True, help="Target glTF Y size in meters.")
    parser.add_argument("--target-z", type=float, required=True, help="Target glTF Z size in meters.")
    parser.add_argument("--rotate-y-degrees", type=float, default=0.0, help="Rotation around glTF Y / Blender Z.")
    parser.add_argument("--decimate", type=float, default=0.08)
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--material-kind", choices=("cloth", "steel", "furnishing"), required=True)
    return parser.parse_args(values)


def bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


args = parse_args()
source = Path(args.input).resolve()
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError(f"{source} contains no mesh")

for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)

bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
model = bpy.context.view_layer.objects.active
model.name = f"rf04_cardinal_{args.asset_id}"

model.rotation_euler.z += math.radians(args.rotate_y_degrees)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

minimum, maximum = bounds(model)
source_size = maximum - minimum
target_blender = Vector((args.target_x, args.target_z, args.target_y))
model.scale = Vector(tuple(target_blender[index] / max(source_size[index], 1e-6) for index in range(3)))
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

minimum, maximum = bounds(model)
center = (minimum + maximum) * 0.5
model.location.x -= center.x
model.location.y -= center.y
model.location.z -= minimum.z
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

modifier = model.modifiers.new("runtime_decimate", "DECIMATE")
modifier.decimate_type = "COLLAPSE"
modifier.ratio = args.decimate
modifier.use_collapse_triangulate = True
bpy.context.view_layer.objects.active = model
bpy.ops.object.modifier_apply(modifier=modifier.name)

for material in model.data.materials:
    if not material:
        continue
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if not shader:
        continue
    if args.material_kind == "cloth":
        shader.inputs["Metallic"].default_value = 0.0
        shader.inputs["Roughness"].default_value = 0.9
    elif args.material_kind == "steel":
        shader.inputs["Metallic"].default_value = 0.72
        shader.inputs["Roughness"].default_value = 0.32

for image in bpy.data.images:
    if image.source != "FILE" or not image.has_data:
        continue
    width, height = image.size
    largest = max(width, height)
    if largest > args.texture_size:
        ratio = args.texture_size / largest
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))

model["assetId"] = args.asset_id
model["sourceTaskId"] = args.source_task_id
model["frontAxis"] = "+Z"
model["pivot"] = "bottom-center"
model["targetSizeMeters"] = [args.target_x, args.target_y, args.target_z]
model["decimateRatio"] = args.decimate

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = model
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_image_format="WEBP",
    export_image_quality=78,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
)

minimum, maximum = bounds(model)
