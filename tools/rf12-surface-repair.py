import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path('./public/local-assets/cardinal/rf12-v2')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root / 'models/runtime/kitchen_environment_refined.glb'))
bpy.context.view_layer.update()
report = {}
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    if obj.name.startswith('RF12_UPPER_WEST'):
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            point.x = -3.775 + (point.x + 3.775) * (2.15 / 2.45)
            point.y = 3.24 + (point.y - 3.24) * (0.34 / 0.42)
            point.z += 0.14
            vertex.co = obj.matrix_world.inverted() @ point
    name = obj.name.lower()
    is_wall = 'wall' in name or 'backsplash' in name
    is_floor = 'floor' in name or 'landing' in name and 'end' not in name
    is_wood = any(token in name for token in ['base_', 'upper_', 'backboard']) and 'handle' not in name and not name.endswith('_top')
    if is_wall or is_floor or is_wood:
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='PhysicalMeters')
        for polygon in obj.data.polygons:
            normal = obj.matrix_world.to_3x3().inverted().transposed() @ polygon.normal
            axis = max(range(3), key=lambda value: abs(normal[value]))
            for loop_index in polygon.loop_indices:
                point = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                if is_floor:
                    horizontal, vertical = point.x, point.y
                    scale = 2.4
                elif is_wall:
                    horizontal, vertical = (point.y, point.z) if axis == 0 else (point.x, point.z)
                    scale = 2.4
                else:
                    horizontal, vertical = (point.y, point.z) if axis == 0 else (point.x, point.z)
                    scale = 1.5
                uv.data[loop_index].uv = (horizontal / scale, vertical / scale)
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    report[obj.name] = {'min': [min(point[axis] for point in points) for axis in range(3)], 'max': [max(point[axis] for point in points) for axis in range(3)]}
bpy.ops.export_scene.gltf(filepath=str(root / 'models/runtime/kitchen_environment_surfaces.glb'), export_format='GLB', export_yup=True, export_apply=True)
(root / 'manifests/surface-repair-bounds.json').write_text(json.dumps(report, indent=2))
print('RF12_SURFACE_REPAIR_COMPLETE')
