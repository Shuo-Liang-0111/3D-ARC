import argparse
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Vector


CONFIG = {
    'class_ii_a2_bsc': {'size': [1.50, 2.18, 0.78], 'front': 'right', 'faces': 220000},
    'receiving_bench_equipment_bank': {'size': [7.90, 1.75, 1.00], 'front': 'right', 'faces': 260000},
    'specimen_transfer_cart': {'size': [1.05, 1.15, 0.58], 'front': 'front', 'faces': 180000},
    'cold_chain_packing_island': {'size': [4.80, 1.72, 1.60], 'front': 'front', 'faces': 240000},
    'dry_reagent_cabinet': {'size': [2.20, 2.20, 0.78], 'front': 'right', 'faces': 200000},
    'handwash_eyewash_station': {'size': [2.65, 1.80, 1.42], 'front': 'right', 'faces': 220000},
    'ppe_locker_bank': {'size': [2.80, 2.10, 0.82], 'front': 'right', 'faces': 200000},
    'medical_refrigerator': {'size': [0.76, 1.98, 0.82], 'front': 'right', 'faces': 180000},
    'p650_transport_case': {'size': [0.62, 0.468, 0.505], 'front': 'right', 'faces': 160000},
    'pcm_cooling_plate': {'size': [0.19, 0.046, 0.13], 'front': 'front', 'faces': 100000},
    'secondary_specimen_carrier': {'size': [0.18, 0.159, 0.11], 'front': 'right', 'faces': 140000},
    'medical_waste_bin': {'size': [0.42, 0.80, 0.36], 'front': 'right', 'faces': 140000},
}

ROTATIONS = {'front': 0, 'right': -math.pi / 2, 'back': math.pi, 'left': math.pi / 2}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset', required=True, choices=CONFIG)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--manifest', required=True)
    values = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return parser.parse_args(values)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def mesh_bounds(meshes):
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def round_vector(vector):
    return [round(value, 5) for value in vector]


def main():
    args = parse_args()
    config = CONFIG[args.asset]
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.input))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    source_min, source_max = mesh_bounds(meshes)

    parent = bpy.data.objects.new(f'{args.asset}_orientation', None)
    bpy.context.collection.objects.link(parent)
    for obj in meshes:
        if obj.parent is None:
            obj.parent = parent
    parent.rotation_euler.z = ROTATIONS[config['front']]
    bpy.context.view_layer.update()
    rotated_min, rotated_max = mesh_bounds(meshes)
    for obj in meshes:
        world_matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_matrix
    bpy.data.objects.remove(parent)

    fit_parent = bpy.data.objects.new(f'{args.asset}_meter_fit', None)
    bpy.context.collection.objects.link(fit_parent)
    for obj in meshes:
        if obj.parent is None:
            obj.parent = fit_parent
    extents = rotated_max - rotated_min
    target_width, target_height, target_depth = config['size']
    fit_parent.scale = (target_width / extents.x, target_depth / extents.y, target_height / extents.z)
    bpy.context.view_layer.update()
    scaled_min, scaled_max = mesh_bounds(meshes)
    center = (scaled_min + scaled_max) * 0.5
    fit_parent.location = (-center.x, -center.y, -scaled_min.z)
    bpy.context.view_layer.update()

    source_faces = sum(len(obj.data.polygons) for obj in meshes)
    ratio = min(1.0, config['faces'] / max(source_faces, 1))
    if ratio < 0.995:
        for obj in meshes:
            modifier = obj.modifiers.new('RF07 runtime decimation', 'DECIMATE')
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    for image in bpy.data.images:
        if image.source == 'FILE' and max(image.size) > 2048:
            scale = 2048 / max(image.size)
            image.scale(max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale)))

    runtime_min, runtime_max = mesh_bounds(meshes)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(args.output), export_format='GLB', export_yup=True,
        export_apply=True, export_cameras=False, export_lights=False, export_animations=False,
        use_selection=True,
    )

    manifest = json.loads(open(args.manifest).read()) if os.path.exists(args.manifest) else {'level': 'RF-07', 'assets': {}}
    manifest.update({'schemaVersion': 1, 'level': 'RF-07', 'productionStatus': 'runtime_candidate',
                     'units': 'meters', 'upAxis': 'Y'})
    manifest['assets'][args.asset] = {
        'sourceArtifact': args.input,
        'runtimeArtifact': args.output,
        'frontCorrection': config['front'],
        'targetSizeMeters': config['size'],
        'sourceBoundsBlender': {'min': round_vector(source_min), 'max': round_vector(source_max)},
        'runtimeBoundsBlender': {'min': round_vector(runtime_min), 'max': round_vector(runtime_max)},
        'sourceFaces': source_faces,
        'runtimeFaces': sum(len(obj.data.polygons) for obj in meshes),
        'runtimeBytes': os.path.getsize(args.output),
        'runtimeSha256': sha256(args.output),
        'pivot': 'bottom-center',
        'frontAxis': '+Z',
        'optimization': {
            'tool': f'Blender {bpy.app.version_string}',
            'targetFaces': config['faces'],
            'textureMaxPixels': 2048,
        },
        'review': {'status': 'approved', 'screenshots': [f'public/local-assets/cardinal/rf07/review/source/{args.asset}/{view}.png'
                                                        for view in ('front', 'right', 'back', 'left')]},
    }
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)
    with open(args.manifest, 'w') as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps(manifest['assets'][args.asset], indent=2))


main()
