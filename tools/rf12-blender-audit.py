import bpy
import json
from mathutils import Vector
from pathlib import Path

root = Path('./public/local-assets/cardinal/rf12-v2/models')
for filename in ['runtime/kitchen_environment_refined.glb', 'runtime/kitchen_sink.glb', 'runtime/refrigerator.glb', 'source/kitchen_window_new.highpoly.glb']:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(root / filename))
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    print('ASSET_BOUNDS', filename, [(min(point[axis] for point in points), max(point[axis] for point in points)) for axis in range(3)])
    if 'environment' in filename:
        for obj in meshes:
            if 'BASE_' in obj.name and ('BODY' in obj.name or 'TOP' in obj.name):
                print('COUNTER', obj.name, tuple(obj.matrix_world.translation), tuple(obj.dimensions), len(obj.data.polygons))
        for position in [(-0.45, 2.55, 2), (-0.4, 2.5, 2), (-0.6, 2.7, 2)]:
            hit = bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector(position), Vector((0, 0, -1)))
            print('RAY', position, hit[0], tuple(hit[1]), hit[4].name if hit[4] else None)
