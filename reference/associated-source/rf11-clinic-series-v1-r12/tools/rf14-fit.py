import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--asset', required=True)
parser.add_argument('--length', type=float, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
production = args.project / 'production/rf14/realism-v0.1'
output = production / 'normalized-v2'
output.mkdir(exist_ok=True)
target = output / (args.asset + '.glb')
if target.exists():
    raise RuntimeError('Normalized asset already exists')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(production / 'source' / (args.asset + '.glb')))
objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in objects:
    matrix = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = matrix
bpy.context.view_layer.update()
points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
size = maximum - minimum
scale = args.length / max(size.x, size.y)
offset = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
for obj in objects:
    for vertex in obj.data.vertices:
        point = (obj.matrix_world @ vertex.co - offset) * scale
        if size.y > size.x:
            point = Vector((point.y, -point.x, point.z))
        vertex.co = point
    obj.matrix_world.identity()
    for material in obj.data.materials:
        if material and material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    node.image.pack()
    if len(obj.data.polygons) > 70000:
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('runtime reduction', 'DECIMATE')
        modifier.ratio = 70000 / len(obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_animations=False)
points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
result = {'asset': args.asset, 'sourceSizeBlender': list(size), 'uniformScale': scale, 'sizeBlender': [max(point[axis] for point in points) - min(point[axis] for point in points) for axis in range(3)], 'triangles': sum(len(obj.data.polygons) for obj in objects), 'frontReview': 'pending'}
(output / (args.asset + '.json')).write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
