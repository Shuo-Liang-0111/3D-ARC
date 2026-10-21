import bpy
import hashlib
import json
import sys
from pathlib import Path

root = Path(sys.argv[sys.argv.index('--') + 1])
revision = sys.argv[sys.argv.index('--') + 2]
output = Path(sys.argv[sys.argv.index('--') + 3])
results = []
for asset in sorted((root / 'public/local-assets/levels/rf15' / revision).glob('*.glb')):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    nodes = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        coords = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        if not coords:
            continue
        low = [min(point[axis] for point in coords) for axis in range(3)]
        high = [max(point[axis] for point in coords) for axis in range(3)]
        nodes.append({'name': obj.name, 'min': [low[0], low[2], -high[1]], 'max': [high[0], high[2], -low[1]], 'collision': bool(obj.get('collision')), 'triangles': sum(len(face.vertices) - 2 for face in obj.data.polygons)})
    data = asset.read_bytes()
    document = json.loads(data[20:20 + int.from_bytes(data[12:16], 'little')])
    minimum = [min(node['min'][axis] for node in nodes) for axis in range(3)]
    maximum = [max(node['max'][axis] for node in nodes) for axis in range(3)]
    result = {'asset': asset.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'min': minimum, 'max': maximum, 'size': [maximum[axis] - minimum[axis] for axis in range(3)], 'triangles': sum(node['triangles'] for node in nodes), 'nodes': nodes, 'materials': len(document.get('materials', [])), 'embeddedImages': len(document.get('images', []))}
    assert data[:4] == b'glTF' and int.from_bytes(data[4:8], 'little') == 2
    assert int.from_bytes(data[8:12], 'little') == len(data)
    assert all('bufferView' in image for image in document.get('images', []))
    if asset.stem in ['tomato-crate', 'apple-crate', 'platform-scale', 'pallet-jack', 'rf15_final']:
        assert result['embeddedImages'] > 0, asset.name
    results.append(result)
output.write_text(json.dumps({'revision': revision, 'assets': results}, indent=2))
print('RF15_ASSET_AUDIT', len(results), 'assets', sum(result['bytes'] for result in results), 'bytes')
