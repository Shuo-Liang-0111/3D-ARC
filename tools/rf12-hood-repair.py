import bpy
import math
from pathlib import Path

root = Path('./public/local-assets/cardinal/rf12-v2')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def surface(name, color, metalness, roughness):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metalness
    shader.inputs['Roughness'].default_value = roughness
    return result

steel = surface('Brushed stainless steel hood', (0.32, 0.35, 0.37), 0.82, 0.32)
dark = surface('Black glass control panel', (0.018, 0.022, 0.024), 0.15, 0.22)
filter_material = surface('Washable stainless baffle', (0.13, 0.15, 0.16), 0.75, 0.4)

def finish(obj, name, material, bevel=0.002):
    obj.name = name
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Folded sheet edge radius', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 4
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj

def block(name, size, position, material, bevel=0.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.dimensions = size
    return finish(obj, name, material, bevel)

block('RF12_HOOD_CANOPY', (0.98, 0.50, 0.07), (0, 0, 0.07), steel, 0.008)
vertices = [(-0.47, -0.22, 0.105), (0.47, -0.22, 0.105), (0.47, 0.22, 0.105), (-0.47, 0.22, 0.105), (-0.22, -0.11, 0.25), (0.22, -0.11, 0.25), (0.22, 0.22, 0.25), (-0.22, 0.22, 0.25)]
faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
mesh = bpy.data.meshes.new('Folded hood extractor shell')
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new('RF12_HOOD_SLOPED_HOUSING', mesh)
bpy.context.collection.objects.link(obj)
finish(obj, obj.name, steel, 0.004)
block('RF12_HOOD_CHIMNEY', (0.30, 0.27, 0.90), (0, 0.105, 0.65), steel, 0.006)
block('RF12_HOOD_CHIMNEY_SEAM', (0.304, 0.274, 0.008), (0, 0.105, 0.72), steel, 0.001)
block('RF12_HOOD_CONTROL_STRIP', (0.44, 0.005, 0.035), (0, -0.253, 0.072), dark)
for index in range(5):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.008, depth=0.004, location=(-0.12 + index * 0.06, -0.258, 0.072), rotation=(math.pi / 2, 0, 0))
    finish(bpy.context.object, f'RF12_HOOD_BUTTON_{index}', steel, 0.001)
for panel in [-1, 1]:
    block(f'RF12_HOOD_FILTER_FRAME_{panel}', (0.35, 0.32, 0.018), (panel * 0.22, 0, 0.025), dark)
    for index in range(13):
        block(f'RF12_HOOD_BAFFLE_{panel}_{index}', (0.018, 0.29, 0.008), (panel * 0.22 - 0.145 + index * 0.024, 0, 0.012), filter_material)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.025, depth=0.006, location=(panel * 0.405, -0.15, 0.028))
    finish(bpy.context.object, f'RF12_HOOD_LAMP_{panel}', steel)
bpy.ops.export_scene.gltf(filepath=str(root / 'models/runtime/range_hood_repaired.glb'), export_format='GLB', export_yup=True, export_apply=True)
print('RF12_HOOD_REPAIR_COMPLETE')
