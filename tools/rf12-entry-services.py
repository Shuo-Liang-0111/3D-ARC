import bpy
import math
from pathlib import Path
from mathutils import Vector

root = Path('./public/local-assets/cardinal/rf12-v2')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root / 'models/runtime/kitchen_environment_surfaces.glb'))
bpy.context.view_layer.update()
for name in ['RF12_ENTRY_LANDING', 'RF12_ENTRY_RETURN_-1', 'RF12_ENTRY_RETURN_1', 'RF12_ENTRY_LANDING_END']:
    obj = bpy.data.objects.get(name)
    transform = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world.identity()
    obj.data.transform(transform)
    for vertex in obj.data.vertices:
        if name.endswith('END'):
            vertex.co.y -= 2.25
        else:
            vertex.co.y = -(3.3 + (-vertex.co.y - 3.3) * (3.6 / 1.35))

def surface(name, color, metalness, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metalness
    shader.inputs['Roughness'].default_value = roughness
    return material

plaster = surface('Hall warm white plaster', (0.72, 0.70, 0.65), 0, 0.85)
metal = surface('Gas pipe coated steel', (0.67, 0.64, 0.49), 0.3, 0.45)
trim = surface('Hall skirting', (0.52, 0.50, 0.45), 0, 0.55)

def block(name, size, position, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    modifier = obj.modifiers.new('Architectural edge', 'BEVEL')
    modifier.width = 0.002
    modifier.segments = 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

block('RF12_HALL_CEILING', (2.06, 0.1, 3.6), (0, 2.85, 5.1), plaster)
for side in [-1, 1]:
    block(f'RF12_HALL_SKIRT_{side}', (0.016, 0.08, 3.5), (side * 0.94, 0.04, 5.05), trim)
block('RF12_HALL_END_SKIRT', (1.9, 0.08, 0.016), (0, 0.04, 6.81), trim)
block('RF12_HALL_LIGHT', (0.42, 0.03, 0.42), (0, 2.78, 5.1), plaster)
door_finish = surface('Warm painted interior door', (0.35, 0.30, 0.23), 0, 0.5)
door_gap = surface('Door reveal shadow', (0.055, 0.05, 0.04), 0, 0.85)
block('RF12_HALL_DOOR_REVEAL', (0.94, 2.13, 0.02), (0, 1.065, 6.807), door_gap)
block('RF12_HALL_INTERIOR_DOOR', (0.87, 2.08, 0.035), (0, 1.045, 6.78), door_finish)
for side in [-1, 1]:
    block(f'RF12_HALL_DOOR_JAMB_{side}', (0.065, 2.20, 0.06), (side * 0.49, 1.10, 6.775), plaster)
block('RF12_HALL_DOOR_HEAD', (1.045, 0.065, 0.06), (0, 2.17, 6.775), plaster)
for height, panel_height in [(0.52, 0.70), (1.49, 0.93)]:
    block(f'RF12_HALL_DOOR_PANEL_{height}', (0.68, panel_height, 0.012), (0, height, 6.755), door_finish)
block('RF12_HALL_DOOR_ROSETTE', (0.045, 0.14, 0.018), (-0.32, 1.0, 6.745), metal)
block('RF12_HALL_DOOR_LEVER', (0.13, 0.018, 0.05), (-0.27, 1.02, 6.717), metal)

def pipe(name, start, end, radius=0.014):
    origin = Vector((start[0], -start[2], start[1]))
    target = Vector((end[0], -end[2], end[1]))
    vector = target - origin
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=vector.length, location=(origin + target) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = vector.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(metal)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4

pipe('RF12_GAS_RISER_UPPER', (3.94, 1.06, -2.3), (3.94, 2.8, -2.3))
pipe('RF12_GAS_RISER_LOWER', (3.94, 0.12, -2.3), (3.94, 0.82, -2.3))
pipe('RF12_GAS_COOKTOP_FEED', (3.94, 0.55, -2.3), (2.25, 0.55, -2.3))
pipe('RF12_GAS_COOKTOP_ELBOW', (2.25, 0.55, -2.3), (2.25, 0.91, -2.3))
for height in [0.25, 1.4, 2.4]:
    block(f'RF12_GAS_PIPE_CLIP_{height}', (0.11, 0.035, 0.045), (3.99, height, -2.3), metal)
bpy.ops.export_scene.gltf(filepath=str(root / 'models/runtime/kitchen_environment_installed.glb'), export_format='GLB', export_yup=True, export_apply=True)
print('RF12_ENTRY_SERVICES_COMPLETE')
