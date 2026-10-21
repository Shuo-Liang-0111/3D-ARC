import bpy
import json
from pathlib import Path

root = Path('./public/local-assets/cardinal/rf12-v2')
records = json.loads(Path('./tools/rf12-collision-records.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for entry in records:
    height = 2.8 if 'wall' in entry['id'] or 'return' in entry['id'] else 0.9
    if entry['id'] == 'refrigerator':
        height = 1.9
    if entry['id'] == 'entry-cabinet':
        height = 1.08
    bpy.ops.mesh.primitive_cube_add(size=1, location=((entry['minX'] + entry['maxX']) / 2, -(entry['minZ'] + entry['maxZ']) / 2, height / 2))
    obj = bpy.context.object
    obj.name = 'COLLIDER_' + entry['id']
    obj['collision'] = True
    obj['shape'] = 'box'
    obj.dimensions = (entry['maxX'] - entry['minX'], entry['maxZ'] - entry['minZ'], height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.75, -0.06))
floor = bpy.context.object
floor.name = 'COLLIDER_FLOOR'
floor.dimensions = (8.4, 10.3, 0.12)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.export_scene.gltf(filepath=str(root / 'models/runtime/kitchen_collision.glb'), export_format='GLB', export_yup=True, export_apply=True, export_extras=True)
print('COLLISION_GLB_SYNCHRONIZED')
