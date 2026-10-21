import argparse
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output-dir', required=True)
    values = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return parser.parse_args(values)


def bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in corners) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in corners) for index in range(3)))
    return minimum, maximum


def add_area(location, energy, size):
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    return light


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.input))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    minimum, maximum = bounds(meshes)
    center = (minimum + maximum) * 0.5
    extents = maximum - minimum
    radius = max(extents) * 2.3

    bpy.ops.mesh.primitive_plane_add(size=max(extents.x, extents.y) * 5, location=(center.x, center.y, minimum.z - 0.002))
    plane = bpy.context.object
    ground = bpy.data.materials.new('Review Ground')
    ground.diffuse_color = (0.16, 0.17, 0.18, 1)
    ground.use_nodes = True
    ground.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.16, 0.17, 0.18, 1)
    ground.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    plane.data.materials.append(ground)

    add_area((center.x - radius, center.y - radius, maximum.z + radius), 1300, radius)
    add_area((center.x + radius, center.y + radius * 0.4, maximum.z + radius * 0.5), 900, radius * 0.8)
    add_area((center.x, center.y + radius, center.z + radius), 700, radius * 0.7)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.lens = 62
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.04, 0.045)
    target = Vector((center.x, center.y, minimum.z + extents.z * 0.48))
    views = [('front', 0), ('right', math.pi / 2), ('back', math.pi), ('left', math.pi * 1.5)]
    for name, azimuth in views:
        camera.location = (
            center.x + math.sin(azimuth) * radius,
            center.y - math.cos(azimuth) * radius,
            minimum.z + extents.z * 0.62,
        )
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(args.output_dir, f'{name}.png')
        bpy.ops.render.render(write_still=True)


main()
