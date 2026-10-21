import ast
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
work = root.parent / 'production/rf15-cardinal-field-v1'
source = work / 'source'
output = root / 'public/local-assets/levels/rf15/cardinal-field-v2'
output.mkdir(parents=True, exist_ok=True)
textures = output / 'textures'
textures.mkdir(exist_ok=True)
sources = []
texture_cache = {}
definitions = ast.parse((root / 'tools/rf15/real-materials.py').read_text())
exec(compile(ast.Module(body=[node for node in definitions.body if isinstance(node, ast.FunctionDef)], type_ignores=[]), 'rf15-material-functions', 'exec'))

def import_glb(path):
    clear()
    bpy.ops.import_scene.gltf(filepath=str(path))
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], 'little')
    document = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    for record in document.get('images', []):
        if 'bufferView' not in record:
            raise RuntimeError('External image in ' + str(path))
        view = document['bufferViews'][record['bufferView']]
        name = record.get('name', 'embedded')
        image_path = textures / (path.stem + '-' + name + ('.jpg' if record['mimeType'] == 'image/jpeg' else '.png'))
        image_path.write_bytes(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
        for image in list(bpy.data.images):
            if image.name == name or image.name.startswith(name + '.'):
                space = image.colorspace_settings.name
                image.filepath = str(image_path)
                image.reload()
                if max(image.size) > 2048:
                    image.scale(2048, 2048)
                image.colorspace_settings.name = space
                image.pack()

def save_model(name):
    destination = output / (name + '.glb')
    if destination.exists():
        raise RuntimeError('Candidate exists: ' + str(destination))
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_yup=True, export_animations=False)

for name, target, budget in [('lettuce', .46, 65000), ('bok-choy', .43, 65000), ('basket', .68, 120000)]:
    if not (source / (name + '.glb')).exists() or (output / (name + '.glb')).exists():
        continue
    import_glb(source / (name + '.glb'))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    center = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
    scale = target / max(maximum - minimum)
    total = sum(len(obj.data.polygons) for obj in meshes)
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world.identity()
        for vertex in obj.data.vertices:
            coordinate = matrix @ vertex.co - center
            if name == 'basket':
                extent = maximum - minimum
                if extent.y > extent.x:
                    coordinate = Vector((coordinate.y, -coordinate.x, coordinate.z))
                    extent = Vector((extent.y, extent.x, extent.z))
                vertex.co = Vector((coordinate.x * .68 / extent.x, coordinate.y * .46 / extent.y, coordinate.z * .34 / extent.z))
            else:
                vertex.co = coordinate * scale
        if total > budget:
            modifier = obj.modifiers.new('runtime-reduction', 'DECIMATE')
            modifier.ratio = budget / total
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.name = 'CARDINAL_' + name
        for face in obj.data.polygons:
            face.use_smooth = True
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    save_model(name)

for name in ('room', 'door'):
    if not all((source / (kind + '.png')).exists() for kind in ('plaster', 'wood', 'roof')) or (output / (name + '.glb')).exists():
        continue
    import_glb(root / 'public/local-assets/levels/rf15/tool-room-v1' / (name + '.glb'))
    materials = {kind: texture_material('Cardinal-' + kind, str(source / (kind + '.png')), .88 if kind == 'plaster' else .72, .25 if kind == 'roof' else 0, .45) for kind in ('plaster', 'wood', 'roof')}
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for slot in obj.material_slots:
            old = slot.material.name.lower() if slot.material else ''
            kind = 'plaster' if 'plaster' in old else 'wood' if 'oak' in old else 'roof' if 'roof' in old else None
            if kind:
                slot.material = materials[kind]
    save_model(name)

if not (source / 'soil.png').exists():
    sys.exit(0)
clear()
soil = texture_material('Cardinal-cultivated-soil', str(source / 'soil.png'), .94, 0, .65)
box('field-soil-base', (4.4, .024, 5.2), (12.3, .012, -1.6), soil, .015, .8)
for row, horizontal in enumerate((10.85, 13.75)):
    vertices = []
    faces = []
    for depth in range(53):
        along = -4.2 + depth * .1
        for side in range(13):
            lateral = (side / 12 - .5) * 1.1
            edge = max(0, 1 - (abs(lateral) / .55) ** 5)
            height = .02 + edge * (.12 + .012 * math.sin(depth * 1.7 + side * 2.1))
            vertices.append(point((horizontal + lateral, height, along)))
    for depth in range(52):
        for side in range(12):
            start = depth * 13 + side
            faces.append((start, start + 1, start + 14, start + 13))
    mesh = bpy.data.meshes.new('cultivated-bed')
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new('soil-bed-' + str(row), mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(soil)
    uv(obj, .8)
    for face in mesh.polygons:
        face.use_smooth = True
rubber = material('drip-irrigation-polyethylene', (.032, .035, .027), .83)
for horizontal in (10.65, 13.55):
    tube('drip-irrigation-line', [(horizontal, .153, -.0 + depth) for depth in (-4.1, -3, -2, -1, .85)], .008, rubber)
save_model('field')
ledger = json.loads((work / 'tasks.json').read_text())
manifest = {'revision': 'cardinal-field-v2', 'tasks': ledger, 'textures': 'Cardinal generated base color; normal and roughness derived from base color, not scanned channels', 'geometry': 'Cardinal plants and basket; Blender precise soil beds and existing hinged tool room', 'files': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob('*.glb')}, 'sourceHashes': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in source.iterdir()}}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps(manifest))
