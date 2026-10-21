import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--revision', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = args.project
production = root / 'production/rf14' / args.revision
output = root / 'public/local-assets/levels/rf14' / args.revision
output.mkdir(parents=True, exist_ok=True)
production.mkdir(parents=True, exist_ok=True)
if (output / 'environment.glb').exists():
    raise RuntimeError('Choose a new immutable candidate revision')
layout = json.loads((root / 'production/rf14/layout.json').read_text())
realism = not args.revision.startswith('graybox')
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.default_rng(1401)


def color(value):
    channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return tuple(channel / 12.92 if channel < 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels)


def texture(name, pixels, linear=False):
    image = bpy.data.images.new(name, width=pixels.shape[1], height=pixels.shape[0], alpha=True)
    image.colorspace_settings.name = 'Non-Color' if linear else 'sRGB'
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.filepath_raw = str(production / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def material(name, shade, roughness=0.7, metal=0, granular=False, mesh=False):
    surface = bpy.data.materials.new(name)
    surface.use_nodes = True
    shader = surface.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color(shade), 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metal
    if granular:
        pixels = np.ones((512, 512, 4))
        noise = rng.normal(0, 0.055, (512, 512))
        for channel, base in enumerate(color(shade)):
            pixels[:, :, channel] = np.clip(base * (1 + noise), 0, 1)
        node = surface.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = texture(name + '-grain', pixels)
        surface.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
        normals = np.ones((512, 512, 4))
        normals[:, :, 0] = 0.5 + np.gradient(noise, axis=0) * 0.5
        normals[:, :, 1] = 0.5 + np.gradient(noise, axis=1) * 0.5
        normal_image = surface.node_tree.nodes.new('ShaderNodeTexImage')
        normal_image.image = texture(name + '-normal', normals, True)
        normal_node = surface.node_tree.nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = 0.15
        surface.node_tree.links.new(normal_image.outputs['Color'], normal_node.inputs['Color'])
        surface.node_tree.links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])
    if mesh:
        pixels = np.ones((256, 256, 4))
        grid_y, grid_x = np.indices((256, 256))
        distance = np.minimum((grid_x + grid_y) % 64, (grid_x - grid_y) % 64)
        pixels[:, :, :3] = color(shade)
        pixels[:, :, 3] = (distance < 4).astype(float)
        node = surface.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = texture(name + '-wire', pixels)
        surface.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
        surface.node_tree.links.new(node.outputs['Alpha'], shader.inputs['Alpha'])
        surface.surface_render_method = 'DITHERED'
        surface.use_backface_culling = False
    return surface


blue = material('cobalt acrylic sports surface', '#397caa', granular=True)
green = material('green acrylic run off', '#548678', granular=True)
white = material('white court marking paint', '#eeeedd', 0.85)
steel = material('powder coated forest green steel', '#233e36', 0.44, 0.55)
rubber = material('graphite rubber and net', '#242e2a', 0.87)
concrete = material('warm concrete paving', '#bbb6a5', granular=True)
grass = material('trimmed lawn', '#586d39', granular=True)
leaves = [material('leaf-tone-' + str(index), shade, 0.9) for index, shade in enumerate(['#456b39', '#587d43', '#709251'])]
wood = material('warm timber slats', '#b89a64', granular=True)
yellow = material('chartreuse felt tennis ball', '#cbdf48', granular=True)
wire = material('green chain link mesh', '#31473b', 0.65, 0.4, mesh=True)
netting = material('woven tennis mesh', '#28312d', 0.9, mesh=True)


def box(name, size, position, surface, bevel=0.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(position[0], -position[2], position[1]))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    for polygon in obj.data.polygons:
        axes = (0, 1) if abs(polygon.normal.z) > 0.5 else (0, 2) if abs(polygon.normal.y) > 0.5 else (1, 2)
        for loop in polygon.loop_indices:
            point = obj.data.vertices[obj.data.loops[loop].vertex_index].co + obj.location
            obj.data.uv_layers.active.data[loop].uv = (point[axes[0]], point[axes[1]])
    if bevel:
        modifier = obj.modifiers.new('edge radius', 'BEVEL')
        modifier.width = min(bevel, min(size) / 3)
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def rod(name, start, end, radius, surface, vertices=12):
    first = Vector((start[0], -start[2], start[1]))
    second = Vector((end[0], -end[2], end[1]))
    difference = second - first
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=difference.length, location=(first + second) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = difference.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(surface)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def export(name, objects, merge=False):
    bpy.ops.object.select_all(action='DESELECT')
    objects = [obj for obj in objects if obj.type == 'MESH']
    if merge:
        by_material = {}
        for obj in objects:
            by_material.setdefault(obj.data.materials[0].name, []).append(obj)
        objects = []
        for material_name, group in by_material.items():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in group:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = group[0]
            bpy.ops.object.join()
            merged = bpy.context.object
            merged.name = 'SURFACE_' + material_name
            objects.append(merged)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(output / (name + '.glb')), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_animations=False)
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


box('surrounding-lawn', [100, 0.12, 100], [0, -0.19, 0], grass)
box('concrete-perimeter', [23, 0.12, 43], [0, -0.09, 1], concrete)
box('green-runoff', [20, 0.04, 38], [0, -0.02, 0], green)
box('blue-playing-area', [10.97, 0.004, 23.77], [0, 0.002, 0], blue, 0)
for x in [-5.485, -4.115, 4.115, 5.485]:
    box('sideline-' + str(x), [0.05, 0.002, 23.77], [x, 0.005, 0], white, 0)
for z in [-11.885, 11.885]:
    box('baseline-' + str(z), [10.97, 0.002, 0.08], [0, 0.005, z], white, 0)
    box('center-mark-' + str(z), [0.05, 0.002, 0.1], [0, 0.005, z - math.copysign(0.09, z)], white, 0)
for z in [-6.4, 6.4]:
    box('service-line-' + str(z), [8.23, 0.002, 0.05], [0, 0.005, z], white, 0)
box('service-center', [0.05, 0.002, 12.8], [0, 0.005, 0], white, 0)
for structure in layout['structures']:
    name = structure['id']
    if 'fence' in name:
        box(name, structure['size'], structure['position'], wire if realism else steel, 0)
        start = [structure['position'][0] - structure['size'][0] / 2, 0, structure['position'][2] - structure['size'][2] / 2]
        end = [structure['position'][0] + structure['size'][0] / 2, 0, structure['position'][2] + structure['size'][2] / 2]
        long_x = structure['size'][0] > structure['size'][2]
        length = max(structure['size'][0], structure['size'][2])
        for index in range(math.ceil(length / 2.5) + 1):
            fraction = index / math.ceil(length / 2.5)
            x = start[0] + fraction * (end[0] - start[0]) if long_x else structure['position'][0]
            z = structure['position'][2] if long_x else start[2] + fraction * (end[2] - start[2])
            rod(name + '-post', [x, 0, z], [x, 3.07, z], 0.035, steel)
        for height in [0.12, 3]:
            rod(name + '-rail', [start[0] if long_x else structure['position'][0], height, structure['position'][2] if long_x else start[2]], [end[0] if long_x else structure['position'][0], height, structure['position'][2] if long_x else end[2]], 0.025, steel)
    elif name.startswith('net-post'):
        rod(name, [structure['position'][0], 0, 0], [structure['position'][0], 1.07, 0], 0.065, steel, 24)
        rod(name + '-cap', [structure['position'][0], 1.07, 0], [structure['position'][0], 1.085, 0], 0.07, steel, 24)
    elif name.startswith('floodlight'):
        x, _, z = structure['position']
        rod(name, [x, 0, z], [x, 6, z], 0.075, steel, 16)
        box(name + '-foot', [0.28, 0.08, 0.28], [x, 0.04, z], steel)
        box(name + '-head', [0.7, 0.15, 0.4], [x, 5.95, z], rubber)
        box(name + '-diffuser', [0.62, 0.015, 0.34], [x, 5.87, z], white)
    elif name == 'bench':
        if realism:
            continue
        for index in range(5):
            box('bench-seat-slat', [0.1, 0.04, 1.85], [8.25 + index * 0.12, 0.46, 4.5], wood)
        for height in [0.61, 0.73, 0.85]:
            box('bench-back-slat', [0.05, 0.085, 1.85], [8.8, height, 4.5], wood)
        for z in [3.85, 5.15]:
            for x in [8.25, 8.75]:
                rod('bench-leg', [x, 0, z], [x, 0.44, z], 0.025, steel)
        for z in [3.63, 5.37]:
            rod('bench-arm', [8.25, 0.64, z], [8.8, 0.64, z], 0.018, steel)
box('net-fabric', [12.8, 0.9, 0.012], [0, 0.46, 0], netting if realism else rubber, 0)
for index in range(40):
    first_x = -6.4 + index * 0.32
    second_x = first_x + 0.32
    first_y = 0.914 + 0.156 * (abs(first_x) / 6.4) ** 2
    second_y = 0.914 + 0.156 * (abs(second_x) / 6.4) ** 2
    rod('net-headband', [first_x, first_y, 0], [second_x, second_y, 0], 0.021, white)
box('net-center-strap', [0.05, 0.94, 0.023], [0, 0.47, 0], white, 0)
for x in [-13, 13]:
    for z in [-21, -11, 0, 11, 23]:
        rod('tree-trunk', [x, -0.05, z], [x, 3.9, z], 0.18, wood)
        for branch in range(9):
            angle = branch * math.tau / 9
            tip = [x + math.cos(angle) * 1.3, 3.7 + rng.uniform(0, 1.4), z + math.sin(angle) * 1.3]
            rod('tree-branch', [x, 2.3, z], tip, 0.055, wood)
        for tone in range(3):
            vertices = []
            faces = []
            for leaf in range(480):
                azimuth = rng.uniform(0, math.tau)
                elevation = rng.uniform(-0.8, 0.95)
                radius = rng.uniform(0.4, 2.1)
                center = Vector((x + math.cos(azimuth) * radius * math.sqrt(1 - elevation ** 2), -z + math.sin(azimuth) * radius * math.sqrt(1 - elevation ** 2), 4.1 + elevation * 1.8))
                along = Vector((math.cos(azimuth), math.sin(azimuth), rng.uniform(-0.5, 0.5))) * rng.uniform(0.12, 0.22)
                across = Vector((-math.sin(azimuth), math.cos(azimuth), 0.3)) * 0.07
                start = len(vertices)
                vertices.extend([center - along, center + across, center + along, center - across, center + Vector((0, 0, 0.025))])
                faces.extend([(start, start + 1, start + 4), (start + 1, start + 2, start + 4), (start + 2, start + 3, start + 4), (start + 3, start, start + 4)])
            mesh = bpy.data.meshes.new('broadleaf-canopy')
            mesh.from_pydata(vertices, [], faces)
            crown = bpy.data.objects.new('tree-leaves', mesh)
            bpy.context.collection.objects.link(crown)
            crown.data.materials.append(leaves[tone])
export('environment', list(bpy.context.scene.objects), merge=True)

for structure in layout['structures']:
    obj = box('COLLIDER_' + structure['id'], structure['size'], structure['position'], rubber, 0)
    obj['collision'] = True
    obj['shape'] = 'box'
floor = box('COLLIDER_floor', [20, 0.1, 41], [0, -0.05, 1.5], rubber, 0)
floor['collision'] = True
export('collision', list(bpy.context.scene.objects))

bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.0335, location=(0, 0, 0.0335))
ball = bpy.context.object
ball.name = 'felt-tennis-ball'
ball.data.materials.append(yellow)
for polygon in ball.data.polygons:
    polygon.use_smooth = True
for index in range(96):
    angle = math.tau * index / 96
    next_angle = math.tau * (index + 1) / 96
    def seam_point(value):
        latitude = 0.48 * math.sin(2 * value)
        return [0.0336 * math.cos(latitude) * math.cos(value), 0.0335 + 0.0336 * math.sin(latitude), 0.0336 * math.cos(latitude) * math.sin(value)]
    rod('curved-ivory-seam', seam_point(angle), seam_point(next_angle), 0.0008, white, 6)
export('ball', list(bpy.context.scene.objects), merge=True)

for x in [-0.27, 0.27]:
    for z in [-0.27, 0.27]:
        rod('cart-leg', [x, 0.08, z], [x, 0.94, z], 0.017, steel)
        rod('cart-wheel', [x - 0.023, 0.06, z], [x + 0.023, 0.06, z], 0.06, rubber, 20)
for height in [0.60, 0.92]:
    for x in [-0.3, 0.3]:
        rod('cart-rim', [x, height, -0.3], [x, height, 0.3], 0.013, steel)
    for z in [-0.3, 0.3]:
        rod('cart-rim', [-0.3, height, z], [0.3, height, z], 0.013, steel)
for index in range(13):
    offset = -0.3 + index * 0.05
    rod('basket-base', [offset, 0.60, -0.3], [offset, 0.60, 0.3], 0.0028, steel, 6)
    for side in [-0.3, 0.3]:
        rod('basket-wire', [offset, 0.6, side], [offset, 0.92, side], 0.0028, steel, 6)
        rod('basket-wire', [side, 0.6, offset], [side, 0.92, offset], 0.0028, steel, 6)
export('cart', list(bpy.context.scene.objects), merge=True)
asset_names = ['ball', 'cart']
if realism:
    for asset in ['court-bench', 'tennis-bag']:
        source = root / 'public/local-assets/levels/rf14/asset-review-v3' / (asset + '.glb')
        if not source.exists():
            raise RuntimeError('Missing approved Cardinal model ' + asset)
        shutil.copyfile(source, output / (asset + '.glb'))
        asset_names.append(asset)
manifest = {'schema': 'arc-level-assets/v1', 'level': 'rf14', 'revision': args.revision, 'units': 'meters', 'upAxis': 'Y', 'budgetMiB': 60, 'environment': {'visual': f'/local-assets/levels/rf14/{args.revision}/environment.glb', 'collision': f'/local-assets/levels/rf14/{args.revision}/collision.glb'}, 'interactables': [{'id': name, 'path': f'/local-assets/levels/rf14/{args.revision}/{name}.glb'} for name in asset_names], 'compression': {'geometry': 'none', 'decoderPath': '/vendor/draco/'}, 'hashes': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob('*.glb')}}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'revision': args.revision, 'files': {path.name: path.stat().st_size for path in output.glob('*.glb')}}, indent=2))
