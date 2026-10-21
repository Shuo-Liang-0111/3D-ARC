import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--yaw', required=True, type=float)
parser.add_argument('--width', required=True, type=float)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
if args.output.exists():
    raise RuntimeError('Use a new immutable output path')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.source))
meshes = [mesh for mesh in bpy.context.scene.objects if mesh.type == 'MESH']
rotation = Matrix.Rotation(args.yaw * 3.141592653589793 / 180, 4, 'Z')
for mesh in meshes:
    transform = rotation @ mesh.matrix_world
    mesh.parent = None
    for vertex in mesh.data.vertices:
        vertex.co = transform @ vertex.co
    mesh.matrix_world.identity()
points = [vertex.co for mesh in meshes for vertex in mesh.data.vertices]
minimum = Vector([min(point[axis] for point in points) for axis in range(3)])
maximum = Vector([max(point[axis] for point in points) for axis in range(3)])
scale = args.width / (maximum.x - minimum.x)
center = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
for mesh in meshes:
    for vertex in mesh.data.vertices:
        vertex.co = (vertex.co - center) * scale
    if len(mesh.data.polygons) > 30000:
        bpy.context.view_layer.objects.active = mesh
        modifier = mesh.modifiers.new('runtime decimation', 'DECIMATE')
        modifier.ratio = 30000 / len(mesh.data.polygons)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
for image in bpy.data.images:
    if max(image.size) > 2048:
        ratio = 2048 / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output), export_format='GLB', export_yup=True, export_cameras=False, export_lights=False)
points = [vertex.co for mesh in meshes for vertex in mesh.data.vertices]
size = [max(point[axis] for point in points) - min(point[axis] for point in points) for axis in (0, 2, 1)]
report = {'provider': 'Cardinal', 'processing': 'Blender', 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(), 'runtimeSha256': hashlib.sha256(args.output.read_bytes()).hexdigest(), 'yawDegrees': args.yaw, 'uniformScale': scale, 'functionalWidthMeters': args.width, 'actualSizeMeters': size, 'runtimeFaces': sum(len(mesh.data.polygons) for mesh in meshes), 'visualReview': 'pending'}
args.output.with_suffix('.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
