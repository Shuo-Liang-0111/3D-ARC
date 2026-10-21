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
    return parser.parse_args(values)


def look_at(obj, point):
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def scene_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("Imported GLB does not contain a mesh.")
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


args = parse_args()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
imported = list(bpy.context.scene.objects)
minimum, maximum = scene_bounds(imported)
center = (minimum + maximum) * 0.5
size = maximum - minimum

floor_size = max(size.x, size.y, 1.0) * 2.8
bpy.ops.mesh.primitive_plane_add(size=floor_size, location=(center.x, center.y, minimum.z - 0.002))
floor = bpy.context.object
floor.name = "review floor"
floor_material = bpy.data.materials.new("neutral review floor")
floor_material.diffuse_color = (0.16, 0.17, 0.17, 1.0)
floor_material.use_nodes = True
floor_shader = floor_material.node_tree.nodes.get("Principled BSDF")
floor_shader.inputs["Base Color"].default_value = (0.16, 0.17, 0.17, 1.0)
floor_shader.inputs["Roughness"].default_value = 0.86
floor.data.materials.append(floor_material)

radius = max(size.x, size.y, size.z, 0.5)
target = Vector((center.x, center.y, minimum.z + size.z * 0.46))
bpy.ops.object.camera_add(location=target + Vector((1.35, -1.55, 0.92)).normalized() * radius * 2.8)
camera = bpy.context.object
camera.data.lens = 58
look_at(camera, target)
bpy.context.scene.camera = camera

for location, energy, size_meters, color in (
    (target + Vector((-radius * 1.2, -radius * 1.4, radius * 1.8)), 1050, radius * 1.4, (1.0, 0.91, 0.80)),
    (target + Vector((radius * 1.4, radius * 1.0, radius * 0.9)), 780, radius * 1.1, (0.70, 0.83, 1.0)),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = max(size_meters, 1.0)
    light.data.color = color
    look_at(light, target)

bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.context.scene.render.resolution_x = 720
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.filepath = str(Path(args.output).resolve())
bpy.context.scene.render.film_transparent = False
bpy.context.scene.world.color = (0.045, 0.05, 0.055)
bpy.context.scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)

print(f"rendered {args.output} from {args.input} at {size.x:.4f} x {size.z:.4f} x {size.y:.4f} glTF meters")
