import argparse
import hashlib
import io
import json
import shutil
import struct
from pathlib import Path

import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--revision', required=True)
args = parser.parse_args()
base = args.project / 'public/local-assets/levels/rf14'
output = base / args.revision
if output.exists():
    raise RuntimeError('Revision already exists')
shutil.copytree(base / 'realism-v0.4', output)
daylight = args.project.parent / 'production/rf14/realism-v0.4/daylight.hdr'
if daylight.exists():
    shutil.copyfile(daylight, output / 'daylight.hdr')
for name in ['environment', 'plane-tree']:
    path = output / (name + '.glb')
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + length])
    binary = bytearray(data[28 + length:])
    for material in document['materials']:
        title = material.get('name', '')
        pbr = material['pbrMetallicRoughness']
        if title == 'cobalt acrylic sports surface':
            pbr['baseColorFactor'] = [0.16, 0.26, 0.38, 1]
        if title == 'green acrylic run off':
            pbr['baseColorFactor'] = [0.13, 0.28, 0.21, 1]
        if title == 'warm concrete paving':
            pbr['baseColorFactor'] = [0.48, 0.46, 0.4, 1]
        if title in ['photographic plane foliage', 'green chain link mesh', 'woven tennis mesh']:
            material['alphaMode'] = 'MASK' if title == 'photographic plane foliage' else 'BLEND'
            material['alphaCutoff'] = 0.25
            material['doubleSided'] = True
        if title in ['green chain link mesh', 'woven tennis mesh']:
            pbr['baseColorFactor'] = [0.08, 0.1, 0.08, 1]
        if title == 'photographic plane foliage':
            index = document['textures'][pbr['baseColorTexture']['index']]['source']
            descriptor = document['images'][index]
            view = document['bufferViews'][descriptor['bufferView']]
            image = Image.open(io.BytesIO(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])).convert('RGBA')
            pixels = np.array(image)
            white = pixels[:, :, :3].min(axis=2) > 205
            pixels[white, 3] = 0
            pixels[pixels[:, :, 3] < 128, :3] = [52, 78, 31]
            pixels[:, :, :3] = np.clip(pixels[:, :, :3].astype(float) * [0.68, 0.8, 0.55], 0, 255).astype('uint8')
            stream = io.BytesIO()
            Image.fromarray(pixels).save(stream, format='PNG')
            payload = stream.getvalue()
            binary.extend(b'\0' * (-len(binary) % 4))
            descriptor['bufferView'] = len(document['bufferViews'])
            document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(payload)})
            binary.extend(payload)
    binary.extend(b'\0' * (-len(binary) % 4))
    document['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    path.write_bytes(struct.pack('<5I', 0x46546c67, 2, 28 + len(encoded) + len(binary), len(encoded), 0x4e4f534a) + encoded + struct.pack('<2I', len(binary), 0x004e4942) + binary)
manifest_path = output / 'manifest.json'
manifest = json.loads(manifest_path.read_text().replace('realism-v0.4', args.revision))
manifest['hashes'] = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob('*.glb')}
if (output / 'daylight.hdr').exists():
    manifest['extraHashes'] = {'daylight.hdr': hashlib.sha256((output / 'daylight.hdr').read_bytes()).hexdigest()}
manifest_path.write_text(json.dumps(manifest, indent=2))
(args.project / 'production/rf14' / args.revision).mkdir(parents=True, exist_ok=True)
