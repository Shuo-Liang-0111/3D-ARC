import argparse
import copy
import json
from pathlib import Path
import struct

parser = argparse.ArgumentParser()
parser.add_argument('--project', type=Path, required=True)
args = parser.parse_args()
production = args.project / 'production/rf14/realism-v0.1'
output = args.project / 'public/local-assets/levels/rf14/asset-review-v3'
output.mkdir(exist_ok=True)


def read(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + length]), data[28 + length:]


for name in ['court-bench', 'tennis-bag']:
    target = output / (name + '.glb')
    if target.exists():
        raise RuntimeError('Use a new material candidate version')
    source, source_binary = read(production / 'source' / (name + '.glb'))
    document, binary = read(production / 'normalized-v2' / (name + '.glb'))
    binary = bytearray(binary)
    for key in ['materials', 'textures', 'samplers', 'images']:
        document[key] = copy.deepcopy(source.get(key, []))
    for image in document['images']:
        view = source['bufferViews'][image['bufferView']]
        while len(binary) % 4:
            binary.append(0)
        image['bufferView'] = len(document['bufferViews'])
        document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': view['byteLength']})
        binary.extend(source_binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
    if name == 'court-bench':
        scale = 0.88 / 1.1587344639683579
        document['nodes'].append({'name': 'meter-normalization', 'scale': [scale] * 3, 'children': document['scenes'][document.get('scene', 0)]['nodes']})
        document['scenes'][document.get('scene', 0)]['nodes'] = [len(document['nodes']) - 1]
    while len(binary) % 4:
        binary.append(0)
    document['buffers'] = [{'byteLength': len(binary)}]
    payload = json.dumps(document, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    target.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(payload) + len(binary)) + struct.pack('<II', len(payload), 0x4E4F534A) + payload + struct.pack('<II', len(binary), 0x004E4942) + binary)
    print(name, target.stat().st_size, len(document['images']))
