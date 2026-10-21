import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path('./public/local-assets/cardinal/rf12-v2')
RUNTIME = ROOT / 'models/runtime'
REPORT = {}

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0.0, roughness=0.4):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = roughness
    return result

def block(name, size, position, surface=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if surface:
        obj.data.materials.append(surface)
    if bevel:
        modifier = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(RUNTIME / name), export_format='GLB', export_yup=True, export_apply=True)

def bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    converted = [(point.x, point.z, -point.y) for point in points]
    return {'min': [min(point[axis] for point in converted) for axis in range(3)], 'max': [max(point[axis] for point in converted) for axis in range(3)]}

clear_scene()
bpy.ops.import_scene.gltf(filepath=str(RUNTIME / 'kitchen_environment.glb'))
cutter = block('SINK_INSTALLATION_VOID', [0.80, 0.50, 0.54], [-0.45, 0.84, -2.55])
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH' or obj == cutter:
        continue
    if obj.name in ['RF12_BASE_WEST_BODY', 'RF12_BASE_WEST_TOP', 'RF12_BASE_EAST_BODY', 'RF12_BASE_EAST_TOP']:
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Actual sink opening', 'BOOLEAN')
        modifier.operation = 'DIFFERENCE'
        modifier.object = cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if any(token in obj.name for token in ['_DOOR_', '_HANDLE_', 'ENTRY_STILE', 'ENTRY_CROSSBAR']):
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Finished edge', 'BEVEL')
        modifier.width = 0.002
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(cutter, do_unlink=True)
stone = material('Honed stone sill', (0.73, 0.72, 0.68), roughness=0.32)
block('RF12_WINDOW_STONE_SILL', [1.43, 0.035, 0.25], [-0.75, 1.13, -3.265], stone, 0.004)
plaster = material('Warm doorway reveal', (0.75, 0.73, 0.68), roughness=0.8)
block('RF12_ENTRY_LINTEL', [1.91, 0.55, 0.16], [0, 2.525, 3.32], plaster, 0.003)
block('RF12_ENTRY_LANDING', [1.90, 0.12, 1.35], [0, -0.06, 3.975], stone)
for side in [-1, 1]:
    block(f'RF12_ENTRY_RETURN_{side}', [0.16, 2.8, 1.35], [side * 1.03, 1.4, 3.975], plaster)
block('RF12_ENTRY_LANDING_END', [2.22, 2.8, 0.16], [0, 1.4, 4.65], plaster)
REPORT['environment'] = {obj.name: bounds(obj) for obj in bpy.context.scene.objects if obj.type == 'MESH'}
export('kitchen_environment_refined.glb')

clear_scene()
bpy.ops.import_scene.gltf(filepath=str(RUNTIME / 'kitchen_window_fitted.glb'))
rubber = material('EPDM glazing seal', (0.025, 0.028, 0.027), roughness=0.86)
aluminum = material('Anodized brushed aluminum', (0.63, 0.66, 0.67), metal=0.72, roughness=0.32)
for side, center, depth in [('FIXED', -0.3025, -0.025), ('MOVING', 0.3025, 0.025)]:
    parent = bpy.data.objects.get(f'RF12_WINDOW_{side}_SASH')
    for edge in [center - 0.274, center + 0.274]:
        obj = block(f'RF12_WINDOW_{side}_GASKET_{edge}', [0.009, 1.075, 0.012], [edge, 0.625, depth + 0.009], rubber, 0.001)
        obj.parent = parent
    for height in [0.095, 1.155]:
        obj = block(f'RF12_WINDOW_{side}_SEAL_{height}', [0.55, 0.009, 0.012], [center, height, depth + 0.009], rubber, 0.001)
        obj.parent = parent
    for height in [0.016, 0.044]:
        block(f'RF12_WINDOW_{side}_CHANNEL_{height}', [1.23, 0.006, 0.007], [0, height, depth], aluminum, 0.001)
latch = block('RF12_WINDOW_CRESCENT_LATCH', [0.032, 0.095, 0.029], [0.02, 0.63, 0.06], aluminum, 0.007)
latch.parent = bpy.data.objects.get('RF12_WINDOW_MOVING_SASH')
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH' and any(token in obj.name for token in ['JAMB', 'STILE', 'RAIL', 'TRACK']):
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Profile edge radius', 'BEVEL')
        modifier.width = 0.0015
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
export('kitchen_window_refined.glb')
REPORT['window'] = {'provider': 'Blender', 'details': ['extrusion channels', 'EPDM seals', 'crescent latch', 'beveled edges']}
(ROOT / 'manifests/blender-layout-report.json').write_text(json.dumps(REPORT, indent=2))
print('RF12_BLENDER_REFINEMENT_COMPLETE')
