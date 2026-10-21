import bpy
import bmesh
import hashlib
import json
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
source = root / 'public/local-assets/levels/rf15/realism-v0.2.7'
output = source.parent / 'realism-v0.2.8'
if output.exists():
    raise RuntimeError('Candidate directory already exists')
shutil.copytree(source, output)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source / 'rf15_final.glb'))
original = bpy.data.objects['STATIC_limewashed warm walls']
wall_material = original.data.materials[0]
mesh = bmesh.new()
mesh.from_mesh(original.data)
removed = []
for face in mesh.faces:
    points = [original.matrix_world @ vertex.co for vertex in face.verts]
    west = all(-8.601 <= point.x <= -8.399 and -2.101 <= point.y <= 6.901 for point in points)
    north = all(-8.601 <= point.x <= 1.501 and 6.599 <= point.y <= 6.801 for point in points)
    if west or north:
        removed.append(face)
assert len(removed) > 20
removed_count = len(removed)
bmesh.ops.delete(mesh, geom=removed, context='FACES')
mesh.to_mesh(original.data)
mesh.free()

perimeter = [(-8.6, -2.1), (-8.4, -2.1), (-8.4, 6.6), (1.5, 6.6), (1.5, 6.8), (-8.4, 6.8), (-8.4, 6.9), (-8.6, 6.9)]
vertices = [(horizontal, depth, height) for height in (0, .68, 3.8) for horizontal, depth in perimeter]
count = len(perimeter)
faces = [tuple(reversed(range(count))), tuple(range(count * 2, count * 3))]
materials = [1, 0]
for layer in range(2):
    for index in range(count):
        following = (index + 1) % count
        faces.append((layer * count + index, layer * count + following, (layer + 1) * count + following, (layer + 1) * count + index))
        materials.append(1 if layer == 0 else 0)
wall_mesh = bpy.data.meshes.new('shed-wall-continuous-shell')
wall_mesh.from_pydata(vertices, [], faces)
wall_mesh.update()
wall = bpy.data.objects.new('STATIC_shed-wall-shell', wall_mesh)
bpy.context.collection.objects.link(wall)
wall.data.materials.append(wall_material)
skirting = bpy.data.materials.new('shed brick skirting')
skirting.use_nodes = True
shader = skirting.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (.31, .25, .19, 1)
shader.inputs['Roughness'].default_value = .9
wall.data.materials.append(skirting)
for polygon, material_index in zip(wall_mesh.polygons, materials):
    polygon.material_index = material_index
wall['semanticId'] = 'shed-wall-shell'
wall['collisionIds'] = ['west-wall', 'north-wall']
wall['construction'] = 'single watertight union; material-only skirting'
mesh = bmesh.new()
mesh.from_mesh(wall_mesh)
assert all(edge.is_manifold for edge in mesh.edges)
bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
volume = mesh.calc_volume()
assert abs(volume - 14.364) < .001, volume
mesh.to_mesh(wall_mesh)
mesh.free()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(output / 'rf15_final.glb'), export_format='GLB', use_selection=True, export_extras=True, export_yup=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format='AUTO')
required = ['rf15_final', 'rf15_collision', 'tail-lift', 'platform-scale', 'pallet-jack', 'plane-tree', 'apple-crate', 'tomato-crate', 'apple-box', 'tomato-box']
checksums = {}
for name in required:
    asset = output / (name + '.glb')
    assert asset.read_bytes()[:4] == b'glTF', name
    checksums[name] = hashlib.sha256(asset.read_bytes()).hexdigest()
    if name != 'rf15_final':
        assert asset.read_bytes() == (source / asset.name).read_bytes(), name
report = {'revision': output.name, 'source': source.name, 'removedWallFaces': removed_count, 'wallUnionVolumeM3': volume, 'wallWatertight': True, 'collisionUnchanged': True, 'requiredAssetHashes': checksums}
(output / 'wall-validation.json').write_text(json.dumps(report, indent=2) + '\n')
manifest_path = output / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['revision'] = output.name
manifest['wallRepair'] = report
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('WALL_REPAIR', json.dumps(report))
