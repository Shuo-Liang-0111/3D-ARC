import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--project', required=True, type=Path)
parser.add_argument('--revision', default='realism-v0.4')
arguments = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = arguments.project
production = root / 'production/rf13' / arguments.revision
output = root / 'public/local-assets/levels/rf13' / arguments.revision
layout = json.loads((production / 'layout.json').read_text())
if (output / 'environment.glb').exists():
    raise RuntimeError('Choose a new candidate revision; live assets are immutable')
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def color(hexadecimal):
    values = [int(hexadecimal[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return tuple(value / 12.92 if value < 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in values)

def image_from_array(name, pixels, linear=False):
    image = bpy.data.images.new(name, width=pixels.shape[1], height=pixels.shape[0])
    image.colorspace_settings.name = 'Non-Color' if linear else 'sRGB'
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.filepath_raw = str(production / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

def material(name, shade, roughness=0.65, metallic=0, texture=None, normal=None, emission=0):
    surface = bpy.data.materials.new(name)
    surface.use_nodes = True
    shader = surface.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color(shade), 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*color(shade), 1)
        shader.inputs['Emission Strength'].default_value = emission
    if texture:
        image = bpy.data.images.load(str(texture), check_existing=True) if isinstance(texture, Path) else texture
        image.pack()
        node = surface.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        surface.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    if normal:
        texture_node = surface.node_tree.nodes.new('ShaderNodeTexImage')
        texture_node.image = normal
        normal_node = surface.node_tree.nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = 0.18
        surface.node_tree.links.new(texture_node.outputs['Color'], normal_node.inputs['Color'])
        surface.node_tree.links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])
    return surface

rng = np.random.default_rng(1304)
noise = rng.normal(0, 0.004, (512, 512))
pixels = np.ones((512, 512, 4))
for channel, base in enumerate([0.72, 0.74, 0.71]):
    pixels[:, :, channel] = np.clip(base + noise, 0, 1)
speckles = rng.random((512, 512)) > 0.985
pixels[speckles, :3] -= 0.025
vinyl_image = image_from_array('clinic-vinyl-albedo', pixels)
normal_pixels = np.ones((512, 512, 4))
normal_pixels[:, :, 0] = 0.5 + np.gradient(noise, axis=0) * 0.4
normal_pixels[:, :, 1] = 0.5 + np.gradient(noise, axis=1) * 0.4
normal_image = image_from_array('clinic-micro-normal', normal_pixels, True)
paint = material('warm washable mineral paint', '#e9e9e2', 0.78, normal=normal_image)
white = material('solid surface ivory', '#ecece5', 0.32)
sage = material('medical vinyl sage', '#658a81', 0.52, normal=normal_image)
light_sage = material('pale sage washable wall', '#b6c8bd', 0.58)
dark = material('graphite rubber', '#303a38', 0.8)
steel = material('brushed stainless steel', '#b5bebc', 0.27, 0.82)
chrome = material('chrome plated hardware', '#d1d7d3', 0.19, 0.95)
oak = material('real oak laminate', '#c8b696', 0.5, texture=root / 'production/rf13/realism-v0.3/source/oak.png')
vinyl = material('fine homogeneous clinic vinyl', '#bac1b9', 0.46, texture=vinyl_image, normal=normal_image)
glass = material('daylit frosted privacy glass', '#c5d9d9', 0.25, 0.08, emission=0.2)
linen = material('cream privacy textile', '#e0e4d7', 0.88, normal=normal_image)
light_face = material('neutral LED diffuser', '#fff4dd', 0.5, emission=1.8)
paper = material('medical paper', '#f3f1e5', 0.9)
blue = material('blue medical polymer', '#91aeb9', 0.55)
amber = material('amber medicine container', '#685137', 0.27)
clear_glass = material('clear cabinet glazing', '#d8e9e5', 0.15, 0.05)
clear_glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.16
clear_glass.surface_render_method = 'DITHERED'

def group(name):
    parent = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(parent)
    return parent

def box(name, size, position, surface, parent=None, bevel=0.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    mesh = bpy.context.object
    mesh.name = name
    mesh.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mesh.data.materials.append(surface)
    mesh.parent = parent
    layer = mesh.data.uv_layers.active
    for polygon in mesh.data.polygons:
        normal = polygon.normal
        axes = (0, 1) if abs(normal.z) > 0.5 else (0, 2) if abs(normal.y) > 0.5 else (1, 2)
        for loop_index in polygon.loop_indices:
            point = mesh.data.vertices[mesh.data.loops[loop_index].vertex_index].co + mesh.location
            layer.data[loop_index].uv = (point[axes[0]], point[axes[1]])
    if bevel:
        modifier = mesh.modifiers.new('manufactured radius', 'BEVEL')
        modifier.width = min(bevel, min(size) / 3)
        modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = mesh.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return mesh

def rod(name, start, end, radius, surface, parent=None, vertices=16):
    first = Vector((start[0], -start[2], start[1]))
    second = Vector((end[0], -end[2], end[1]))
    direction = second - first
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(first + second) / 2)
    mesh = bpy.context.object
    mesh.name = name
    mesh.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    mesh.data.materials.append(surface)
    mesh.parent = parent
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
    return mesh

def underside(name, width, depth, position, surface, parent):
    center_x, center_y, center_z = position
    points = [(center_x - width / 2, -center_z - depth / 2, center_y), (center_x - width / 2, -center_z + depth / 2, center_y), (center_x + width / 2, -center_z + depth / 2, center_y), (center_x + width / 2, -center_z - depth / 2, center_y)]
    geometry = bpy.data.meshes.new(name)
    geometry.from_pydata(points, [], [(0, 1, 2, 3)])
    geometry.materials.append(surface)
    mesh = bpy.data.objects.new(name, geometry)
    bpy.context.collection.objects.link(mesh)
    mesh.parent = parent
    mesh['cutawayCeiling'] = True

def import_model(name, path, position, yaw=0, parent=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    added = set(bpy.data.objects) - before
    transform = Matrix.Translation(Vector((position[0], -position[2], position[1]))) @ Matrix.Rotation(yaw, 4, 'Z')
    for mesh in added:
        if mesh.parent not in added:
            mesh.matrix_world = transform @ mesh.matrix_world
            mesh.parent = parent
            mesh.name = name

def cabinet(entry):
    parent = group(entry['id'])
    width, height, depth = entry['size']
    center_x, center_y, center_z = entry['position']
    base = center_y - height / 2
    box('recessed toe kick', [width - 0.07, 0.10, depth - 0.075], [center_x, base + 0.05, center_z - 0.025], dark, parent)
    if entry['id'] == 'handwash-cabinet':
        for side in [-1, 1]:
            box('basin cabinet side', [0.018, height - 0.14, depth - 0.04], [center_x + side * (width / 2 - 0.009), base + 0.1 + (height - 0.14) / 2, center_z - 0.02], oak, parent)
            box('cutout worktop side', [(width - 0.40) / 2, 0.04, depth], [center_x + side * (width + 0.40) / 4, base + height - 0.02, center_z], white, parent, 0.005)
            box('cutout worktop end', [0.40, 0.04, (depth - 0.35) / 2], [center_x, base + height - 0.02, center_z + side * (depth + 0.35) / 4], white, parent, 0.005)
        box('basin cabinet back', [width, height - 0.14, 0.018], [center_x, base + 0.1 + (height - 0.14) / 2, center_z - depth / 2 + 0.009], oak, parent)
    else:
        box('cabinet carcass', [width, height - 0.14, depth - 0.04], [center_x, base + 0.1 + (height - 0.14) / 2, center_z - 0.02], oak, parent, 0.008)
        box('solid surface worktop', [width, 0.04, depth], [center_x, base + height - 0.02, center_z], white, parent, 0.01)
    count = max(1, round(width / 0.55))
    for index in range(count):
        panel_x = center_x - width / 2 + (index + 0.5) * width / count
        panel_width = width / count - 0.009
        front = center_z + depth / 2 - 0.01
        box('lower cabinet door', [panel_width, height - 0.34, 0.018], [panel_x, base + 0.11 + (height - 0.34) / 2, front], light_sage, parent)
        box('upper drawer front', [panel_width, 0.17, 0.018], [panel_x, base + height - 0.134, front], white, parent)
        rod('drawer handle', [panel_x - 0.074, base + height - 0.134, front + 0.012], [panel_x + 0.074, base + height - 0.134, front + 0.012], 0.005, steel, parent)
        rod('cabinet handle', [panel_x + panel_width / 2 - 0.04, base + 0.4, front + 0.012], [panel_x + panel_width / 2 - 0.04, base + 0.54, front + 0.012], 0.005, steel, parent)
    return parent

def medical_cupboard(entry):
    parent = group(entry['id'])
    center_x, _, center_z = entry['position']
    width, height, depth = entry['size']
    box('base plinth', [width - 0.05, 0.10, depth - 0.04], [center_x, 0.05, center_z], dark, parent)
    box('cabinet back', [width, height - 0.1, 0.028], [center_x, 1.0, center_z - depth / 2 + 0.014], white, parent)
    for sign in [-1, 1]:
        box('side panel', [0.022, height - 0.1, depth], [center_x + sign * (width / 2 - 0.011), 1.0, center_z], white, parent)
    for height_value in [0.12, 0.65, 1.05, 1.45, 1.89]:
        box('laminate shelf', [width - 0.025, 0.02, depth], [center_x, height_value, center_z], white, parent)
    for sign in [-1, 1]:
        panel_x = center_x + sign * width / 4
        box('lower solid door', [width / 2 - 0.018, 0.48, 0.022], [panel_x, 0.385, center_z + depth / 2 - 0.011], light_sage, parent)
        for height_value in [0.68, 1.86]:
            box('glazed door horizontal frame', [width / 2 - 0.01, 0.025, 0.025], [panel_x, height_value, center_z + depth / 2 - 0.013], steel, parent)
        for offset in [-width / 4 + 0.018, width / 4 - 0.018]:
            box('glazed door stile', [0.025, 1.18, 0.025], [panel_x + offset, 1.27, center_z + depth / 2 - 0.013], steel, parent)
        rod('cupboard pull', [panel_x - sign * 0.11, 1.08, center_z + depth / 2], [panel_x - sign * 0.11, 1.27, center_z + depth / 2], 0.006, chrome, parent)
        box('transparent cupboard glazing', [width / 2 - 0.06, 1.14, 0.003], [panel_x, 1.27, center_z + depth / 2 - 0.013], clear_glass, parent, 0)
    for shelf_height in [0.665, 1.065, 1.465]:
        for column in range(5):
            item_x = center_x - 0.29 + column * 0.14
            if column % 2:
                rod('medicine bottle', [item_x, shelf_height + 0.015, center_z], [item_x, shelf_height + 0.15, center_z], 0.036, amber, parent)
                rod('bottle cap', [item_x, shelf_height + 0.15, center_z], [item_x, shelf_height + 0.172, center_z], 0.038, white, parent)
                box('bottle label', [0.052, 0.065, 0.005], [item_x, shelf_height + 0.08, center_z + 0.035], paper, parent)
            else:
                box('sealed medical carton', [0.10, 0.18, 0.12], [item_x, shelf_height + 0.09, center_z], paper, parent)
                box('carton blue band', [0.10, 0.035, 0.002], [item_x, shelf_height + 0.13, center_z + 0.061], blue, parent)

def couch(entry):
    parent = group(entry['id'])
    center_x, _, center_z = entry['position']
    box('vinyl upholstered mattress', [0.75, 0.10, 1.32], [center_x, 0.60, center_z + 0.29], sage, parent, 0.03)
    box('headrest cushion', [0.75, 0.10, 0.57], [center_x, 0.60, center_z - 0.665], sage, parent, 0.03)
    box('headrest seam', [0.70, 0.003, 0.003], [center_x, 0.649, center_z - 0.38], dark, parent, 0)
    box('powdercoated couch frame', [0.69, 0.075, 1.82], [center_x, 0.50, center_z], white, parent, 0.009)
    for side in [-1, 1]:
        for end in [-1, 1]:
            rod('chrome leg', [center_x + side * 0.30, 0.035, center_z + end * 0.78], [center_x + side * 0.30, 0.48, center_z + end * 0.78], 0.026, steel, parent)
            box('non slip foot', [0.067, 0.045, 0.067], [center_x + side * 0.30, 0.0225, center_z + end * 0.78], dark, parent, 0.01)
        rod('lower stretcher', [center_x + side * 0.30, 0.18, center_z - 0.78], [center_x + side * 0.30, 0.18, center_z + 0.78], 0.016, steel, parent)
    rod('paper roll', [center_x - 0.27, 0.41, center_z - 0.87], [center_x + 0.27, 0.41, center_z - 0.87], 0.045, paper, parent)
    box('examination paper runner', [0.55, 0.001, 1.82], [center_x, 0.651, center_z], paper, parent, 0)

def equipment(entry):
    center_x, _, center_z = entry['position']
    parent = group('workstation-equipment-' + entry['id'])
    box('monitor foot', [0.22, 0.018, 0.14], [center_x, 0.909, center_z - 0.22], dark, parent)
    rod('monitor column', [center_x, 0.92, center_z - 0.23], [center_x, 1.12, center_z - 0.23], 0.018, steel, parent)
    box('monitor bezel', [0.36, 0.225, 0.028], [center_x, 1.19, center_z - 0.235], dark, parent, 0.009)
    box('inactive pale blue display', [0.33, 0.193, 0.002], [center_x, 1.19, center_z - 0.219], blue, parent)
    box('keyboard body', [0.28, 0.014, 0.08], [center_x, 0.907, center_z + 0.08], white, parent)
    for row in range(3):
        for column in range(10):
            box('keyboard key', [0.021, 0.002, 0.014], [center_x - 0.114 + column * 0.025, 0.915, center_z + 0.057 + row * 0.02], dark, parent, 0)
    for index in range(3):
        box('patient record folder', [0.18, 0.017, 0.24], [center_x + 0.74, 0.908 + index * 0.018, center_z - 0.15], [paper, blue, light_sage][index], parent)

def window_wall(entry):
    parent = group(entry['id'])
    box('continuous sill wall', [14, 1.55, 0.16], [0, 0.775, -5], paint, parent)
    box('window head wall', [14, 0.45, 0.16], [0, 2.575, -5], paint, parent)
    boundaries = [-7, -6.25, -4.25, -2.75, -0.75, 0.75, 2.75, 4.25, 6.25, 7]
    for index in range(0, len(boundaries) - 1, 2):
        left, right = boundaries[index:index + 2]
        box('solid window pier', [right - left, 0.8, 0.16], [(left + right) / 2, 1.95, -5], paint, parent)
    for center in [-5.25, -1.75, 1.75, 5.25]:
        box('frosted daylight pane', [1.93, 0.735, 0.014], [center, 1.95, -5], glass, parent)
        for offset in [-0.98, 0, 0.98]:
            box('aluminium mullion', [0.033, 0.8, 0.13], [center + offset, 1.95, -5], white, parent)
        for height in [1.565, 2.335]:
            box('aluminium rail', [2, 0.03, 0.13], [center, height, -5], white, parent)
        box('window sill', [2, 0.025, 0.18], [center, 1.55, -4.99], white, parent)
        for index in range(5):
            box('partially raised blind slat', [1.89, 0.024, 0.015], [center, 2.30 - index * 0.032, -4.935], linen, parent, 0.002)
    return parent

for entry in layout['boxes']:
    name = entry['id']
    width, height, depth = entry['size']
    center_x, center_y, center_z = entry['position']
    if name.startswith('exam-bed-'):
        couch(entry)
    elif name.startswith('waiting-seat-'):
        import_model(name, root / 'public/local-assets/levels/rf13/cardinal-v0.3/chair.glb', [center_x, 0, center_z], parent=group(name))
    elif name == 'medicine-cabinet':
        medical_cupboard(entry)
    elif name == 'supply-shelf':
        parent = cabinet({**entry, 'size': [depth, height, width], 'position': [0, center_y, 0]})
        parent.location = (center_x, -center_z, 0)
        parent.rotation_euler.z = math.pi / 2
    elif name.startswith('sliding-door-'):
        parent = group(name)
        box('door lower panel', [width, 1.09, depth], [center_x, 0.585, center_z], oak, parent, 0.006)
        box('door upper panel', [width, 0.32, depth], [center_x, 2.01, center_z], oak, parent, 0.006)
        box('door left stile', [0.29, 0.72, depth], [center_x - 0.435, 1.49, center_z], oak, parent)
        box('door right stile', [0.59, 0.72, depth], [center_x + 0.285, 1.49, center_z], oak, parent)
        box('frosted observation insert', [0.28, 0.72, 0.008], [center_x - 0.15, 1.49, center_z], glass, parent)
        for side in [-1, 1]:
            rod('vertical stainless door pull', [center_x - 0.40, 0.9, center_z + side * 0.025], [center_x - 0.40, 1.18, center_z + side * 0.025], 0.012, steel, parent)
        box('door kick plate', [width - 0.04, 0.18, 0.003], [center_x, 0.17, center_z + depth / 2], steel, parent)
    elif name.startswith('privacy-curtain-'):
        parent = group(name)
        for fold in range(9):
            fold_z = center_z + 0.10 - fold * 0.025
            fold_x = center_x + (fold % 2) * 0.018 - 0.009
            rod('gathered privacy curtain fold', [fold_x, 0.40, fold_z], [fold_x, 2.40, fold_z], 0.026, linen, parent)
            rod('curtain carrier', [fold_x, 2.39, fold_z], [center_x, 2.46, fold_z], 0.003, steel, parent)
    elif entry['category'] == 'fixture':
        cabinet(entry)
        if name.startswith('counter-'):
            equipment(entry)
    else:
        parent = window_wall(entry) if name == 'north-wall' else group(name)
        if name != 'north-wall':
            box(name + ' surface', entry['size'], entry['position'], vinyl if name == 'floor' else paint, parent, 0 if name == 'floor' else 0.002)
        if entry['category'] == 'wall':
            for side in [-1, 1]:
                if width > depth:
                    box('washable lower wall', [width, 0.92, 0.008], [center_x, 0.47, center_z + side * (depth / 2 + 0.004)], light_sage, parent)
                    box('coved vinyl skirting', [width, 0.075, 0.012], [center_x, 0.0375, center_z + side * (depth / 2 + 0.007)], sage, parent)
                    box('wall protection rail', [width, 0.035, 0.014], [center_x, 0.95, center_z + side * (depth / 2 + 0.008)], oak, parent)
                else:
                    box('washable lower wall', [0.008, 0.92, depth], [center_x + side * (width / 2 + 0.004), 0.47, center_z], light_sage, parent)
                    box('coved vinyl skirting', [0.012, 0.075, depth], [center_x + side * (width / 2 + 0.007), 0.0375, center_z], sage, parent)
                    box('wall protection rail', [0.014, 0.035, depth], [center_x + side * (width / 2 + 0.008), 0.95, center_z], oak, parent)

frames = group('door-hardware-and-rails')
for center in [-5.25, -1.75, 1.75, 5.25]:
    for side in [-1, 1]:
        box('door jamb', [0.045, 2.2, 0.14], [center + side * 0.721, 1.1, -1], white, frames)
    box('door head', [1.49, 0.048, 0.14], [center, 2.225, -1], white, frames)
    box('sliding door rail cover', [2.62, 0.07, 0.07], [center + 0.59, 2.30, -0.897], steel, frames)

ceiling = group('cutaway-ceiling')
ceiling['cutawayCeiling'] = True
underside('continuous ceiling underside', 13.83, 9.83, [0, 2.785, 0], white, ceiling)
for center_x in np.arange(-6.6, 7, 0.6):
    underside('suspended ceiling grid', 0.015, 9.83, [float(center_x), 2.78, 0], light_sage, ceiling)
for center_z in np.arange(-4.8, 5, 0.6):
    underside('suspended ceiling grid', 13.83, 0.015, [0, 2.78, float(center_z)], light_sage, ceiling)
for center_x, center_z in [(-5.25, -3), (-1.75, -3), (1.75, -3), (5.25, -3), (-3.5, 2), (3.5, 2), (0, 0.1)]:
    underside('recessed luminaire surround', 0.65, 0.65, [center_x, 2.77, center_z], steel, ceiling)
    underside('LED diffuser', 0.58, 0.58, [center_x, 2.765, center_z], light_face, ceiling)

details = group('clinic-fixed-details')
for center in [-1.75, 1.75, 5.25]:
    box('wall power socket', [0.08, 0.08, 0.025], [center + 0.55, 1.23, -4.90], white, details)
    for offset in [-0.015, 0.015]:
        box('socket aperture', [0.006, 0.018, 0.002], [center + 0.55 + offset, 1.23, -4.886], dark, details, 0)
    box('sanitizer dispenser', [0.095, 0.19, 0.08], [center - 1.1, 1.32, -0.86], white, details, 0.02)
    box('sanitizer level window', [0.045, 0.07, 0.003], [center - 1.1, 1.33, -0.818], blue, details)
for center in [-1.75, 1.75]:
    curtain_x = center + 0.70
    rod('privacy curtain rail', [curtain_x, 2.46, -3.65], [curtain_x, 2.46, -1.68], 0.012, steel, details)
    for support_z in [-3.55, -1.78]:
        rod('ceiling hanger', [curtain_x, 2.46, support_z], [curtain_x, 2.78, support_z], 0.009, steel, details)
        box('ceiling hanger flange', [0.055, 0.012, 0.055], [curtain_x, 2.776, support_z], steel, details)

for name, position, yaw in [('clinical-basin', [6.3, 0.84, -4.2], 0), ('diagnostic-panel', [-0.15, 1.13, -2.75], -math.pi / 2), ('diagnostic-panel', [3.35, 1.13, -2.75], -math.pi / 2)]:
    path = output / (name + '-fitted.glb')
    if not path.exists():
        raise RuntimeError('Required generated asset missing: ' + str(path))
    import_model(name, path, position, yaw, group(name + '-installed-' + str(position[0])))

for center_x in [-2.88, 0.62, 4.12]:
    box('wall chart oak frame', [0.36, 0.48, 0.025], [center_x, 1.66, -4.895], oak, details)
    box('wall chart backing', [0.33, 0.45, 0.003], [center_x, 1.66, -4.88], paper, details)

notice = group('waiting-health-information-board')
box('notice frame', [0.055, 1.03, 1.66], [-6.87, 1.73, 2.4], oak, notice)
box('notice backing', [0.004, 0.97, 1.60], [-6.838, 1.73, 2.4], paper, notice)

def join_children(parent):
    meshes = [child for child in parent.children_recursive if child.type == 'MESH']
    if not meshes:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = parent.name + '-geometry'
    transform = mesh.matrix_world.copy()
    mesh.parent = parent
    mesh.matrix_world = transform
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if parent.get('cutawayCeiling'):
        mesh['cutawayCeiling'] = True

parents = [parent for parent in bpy.context.scene.objects if parent.type == 'EMPTY' and parent.parent is None]
for parent in parents:
    join_children(parent)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(output / 'environment.glb'), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(production / 'environment.blend'))
bpy.ops.wm.read_factory_settings(use_empty=True)
collision_surface = material('collision-only', '#ffffff')
for entry in layout['boxes']:
    mesh = box('COLLIDER_' + entry['id'], entry['size'], entry['position'], collision_surface, bevel=0)
    mesh['collision'] = True
bpy.ops.export_scene.gltf(filepath=str(output / 'collision.glb'), export_format='GLB', export_yup=True, export_extras=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
steel = material('brushed stainless steel', '#bac3c0', 0.28, 0.88)
dark = material('rubber caster tread', '#262d2b', 0.8)
white = material('sterile tray mat', '#dce7de', 0.7)
trolley = group('clinical-supply-trolley')
for center_y in [0.23, 0.69]:
    box('pressed stainless tray', [0.61, 0.022, 0.51], [0, center_y, 0], steel, trolley, 0.009)
    box('removable silicone mat', [0.55, 0.003, 0.45], [0, center_y + 0.013, 0], white, trolley)
    for sign in [-1, 1]:
        box('tray raised lip', [0.61, 0.043, 0.013], [0, center_y + 0.025, sign * 0.249], steel, trolley)
        box('tray raised lip', [0.013, 0.043, 0.49], [sign * 0.299, center_y + 0.025, 0], steel, trolley)
for side in [-1, 1]:
    for end in [-1, 1]:
        rod('trolley tube upright', [side * 0.3, 0.095, end * 0.25], [side * 0.3, 0.785, end * 0.25], 0.017, steel, trolley)
        rod('caster axle', [side * 0.3 - 0.02, 0.044, end * 0.225], [side * 0.3 + 0.02, 0.044, end * 0.225], 0.044, dark, trolley, 24)
        rod('caster fork', [side * 0.3, 0.045, end * 0.225], [side * 0.3, 0.11, end * 0.225], 0.011, steel, trolley)
    rod('handle riser', [side * 0.28, 0.70, -0.25], [side * 0.28, 0.885, -0.25], 0.015, steel, trolley)
rod('push handle', [-0.28, 0.885, -0.25], [0.28, 0.885, -0.25], 0.015, steel, trolley)
join_children(trolley)
bpy.ops.export_scene.gltf(filepath=str(output / 'trolley.glb'), export_format='GLB', export_yup=True, export_extras=True)
for name in ['gloves', 'gauze', 'dressings', 'forms', 'empty-box', 'opening-terminal', 'chair']:
    shutil.copy2(root / 'public/local-assets/levels/rf13/cardinal-v0.3' / (name + '.glb'), output / (name + '.glb'))
manifest = {'levelId': 'rf13', 'revision': arguments.revision, 'provider': 'Cardinal+Blender', 'environment': 'environment.glb', 'collision': 'collision.glb', 'interactive': ['gloves', 'gauze', 'dressings', 'forms', 'empty-box', 'opening-terminal', 'chair', 'trolley'], 'collisionAuthority': 'game/levels/rf13/level.js + furnishings.js', 'visualStatus': 'internal-review', 'provenance': {'architecture': 'Blender dimensioned structural geometry', 'trolley': 'Blender reconstruction to gameplay dimensions', 'vinyl': 'deterministic procedural albedo and normal; no claim of scan', 'oak': 'reused source from realism-v0.3; see previous ledger', 'clinical-basin': 'Cardinal; tasks.json', 'diagnostic-panel': 'Cardinal; tasks.json', 'portable-items-and-chair': 'reused Cardinal runtime from cardinal-v0.3'}, 'files': {path.name: {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size} for path in sorted(output.glob('*.glb'))}}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('RF13 candidate exported:', arguments.revision, flush=True)
