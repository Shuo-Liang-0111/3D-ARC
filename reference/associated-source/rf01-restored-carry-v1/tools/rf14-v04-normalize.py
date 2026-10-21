import argparse
import importlib
import json
import shutil
from pathlib import Path

import numpy as np
import trimesh

parser = argparse.ArgumentParser()
parser.add_argument('--production', type=Path, required=True)
args = parser.parse_args()
process_asset = importlib.import_module('embodied_gen.skills.asset-process.asset_process').process_asset
output = args.production / 'normalized'
output.mkdir(exist_ok=True)
records = []
for name, axis, target in [('ball-hopper', 1, 0.95), ('umpire-chair', 1, 2.3), ('windscreen', 0, 2.45), ('plane-tree', 1, 7.0)]:
    source = args.production / ('cardinal-' + name + '.glb')
    if not source.exists():
        continue
    raw = trimesh.load(source, force='scene')
    bounds = raw.bounds
    rotation = (0, 90, 0) if name == 'windscreen' else (0, 0, 0)
    dimension = max(raw.extents[0], raw.extents[2]) if name == 'windscreen' else raw.extents[axis]
    scale = target / dimension
    asset = args.production / 'embodiedgen-input' / name
    mesh_dir = asset / 'mesh'
    mesh_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, mesh_dir / (name + '.glb'))
    urdf = asset / (name + '.urdf')
    urdf.write_text(f'<robot name="{name}"><link name="base"><visual><geometry><mesh filename="mesh/{name}.glb"/></geometry></visual><collision><geometry><mesh filename="mesh/{name}_collision.obj"/></geometry></collision></link></robot>')
    proxy = trimesh.creation.box(extents=bounds[1] - bounds[0])
    proxy.apply_translation(bounds.mean(axis=0))
    proxy.export(mesh_dir / (name + '_collision.obj'))
    processed = args.production / 'embodiedgen-processed-v2' / name
    if not processed.exists():
        process_asset(urdf_path=str(urdf), scale_factor=float(scale), rot_xyz=rotation, output_dir=str(processed))
    result = trimesh.load(processed / 'mesh' / (name + '.glb'), force='scene')
    result.apply_translation(-np.array([result.bounds[:, 0].mean(), result.bounds[0, 1], result.bounds[:, 2].mean()]))
    result.export(output / (name + '.glb'))
    records.append({'asset': name, 'source': str(source), 'processing': 'EmbodiedGen 2.1.0 asset-process (uniform mesh and collision scaling, URDF height metadata)', 'uniformScale': float(scale), 'bounds': result.bounds.tolist(), 'size': result.extents.tolist(), 'faces': sum(len(mesh.faces) for mesh in result.geometry.values()), 'visual': 'pending'})
(output / 'measurements.json').write_text(json.dumps(records, indent=2))
print(json.dumps(records, indent=2))
