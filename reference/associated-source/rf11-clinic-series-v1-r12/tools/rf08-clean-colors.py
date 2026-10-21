import argparse
import io
import json
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def read_glb(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + length])
    start = 20 + length
    size = struct.unpack_from('<I', data, start)[0]
    return document, bytearray(data[start + 8:start + 8 + size])


def accessor(document, binary, index):
    record = document['accessors'][index]
    view = document['bufferViews'][record['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[record['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[record['type']]
    offset = view.get('byteOffset', 0) + record.get('byteOffset', 0)
    return np.ndarray((record['count'], width), dtype=dtype, buffer=binary, offset=offset, strides=(view.get('byteStride', width * np.dtype(dtype).itemsize), np.dtype(dtype).itemsize)).copy()


def append_view(document, binary, data):
    binary.extend(b'\x00' * (-len(binary) % 4))
    index = len(document['bufferViews'])
    document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
    binary.extend(data)
    return index


def write_glb(path, document, binary):
    document['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\x00' * (-len(binary) % 4))
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + struct.pack('<II', len(binary), 0x004E4942) + binary)


def merge_colors(rgb):
    filtered = cv2.bilateralFilter(cv2.medianBlur(rgb, 3), 9, 26, 5)
    lab = cv2.cvtColor(filtered, cv2.COLOR_RGB2LAB).astype(np.float32)
    steps = np.array([10, 6, 6], dtype=np.float32)
    lab = np.clip(np.round(lab / steps) * steps, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    document, binary = read_glb(args.source)
    rgb_images = []
    report = {'source': str(args.source), 'output': str(args.output), 'textures': [], 'planarFaces': 0}
    for index, record in enumerate(document['images']):
        view = document['bufferViews'][record['bufferView']]
        raw = bytes(binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])
        rgb = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
        cleaned = merge_colors(rgb)
        rgb_images.append(cleaned)
        report['textures'].append({'index': index, 'uniqueBefore': len(np.unique(rgb.reshape(-1, 3), axis=0)), 'uniqueAfter': len(np.unique(cleaned.reshape(-1, 3), axis=0))})
        print('Merged texture', index, flush=True)
    white_srgb = np.array([211, 209, 201]) / 255
    white_linear = np.where(white_srgb <= .04045, white_srgb / 12.92, ((white_srgb + .055) / 1.055) ** 2.4)
    white_material = len(document['materials'])
    document['materials'].append({'name': 'RF08_Uniform_Painted_Surface', 'pbrMetallicRoughness': {'baseColorFactor': [*white_linear.tolist(), 1], 'metallicFactor': 0, 'roughnessFactor': 1}, 'extensions': {'KHR_materials_unlit': {}}, 'doubleSided': True})
    mesh_names = {node['mesh']: node.get('name', '') for node in document['nodes'] if 'mesh' in node}
    for mesh_index, mesh in enumerate(document['meshes']):
        name = mesh_names.get(mesh_index, '')
        if name in ['repaired-south', 'repaired-ceiling']:
            for primitive in mesh['primitives']:
                primitive['material'] = white_material
            continue
        if not name.startswith('office-repaired-'):
            continue
        additions = []
        for primitive in mesh['primitives']:
            points = accessor(document, binary, primitive['attributes']['POSITION'])
            faces = accessor(document, binary, primitive['indices']).reshape(-1, 3).astype(np.uint32)
            triangles = points[faces]
            normal = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
            normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
            center = triangles.mean(1)
            wall = (center[:, 2] > 1.94) & (center[:, 1] > .18) & (np.abs(normal[:, 2]) > .72)
            ceiling = (center[:, 1] > 2.59) & (np.abs(normal[:, 1]) > .8)
            selected = wall | ceiling
            if not selected.any():
                continue
            report['planarFaces'] += int(selected.sum())
            for selection, material in [(~selected, primitive['material']), (selected, white_material)]:
                selected_faces = faces[selection]
                if not len(selected_faces):
                    continue
                view = append_view(document, binary, selected_faces.astype('<u4').tobytes())
                access_index = len(document['accessors'])
                document['accessors'].append({'bufferView': view, 'componentType': 5125, 'count': selected_faces.size, 'type': 'SCALAR'})
                additions.append({**primitive, 'indices': access_index, 'material': material})
        if additions:
            mesh['primitives'] = additions
    for record, cleaned in zip(document['images'], rgb_images):
        stream = io.BytesIO()
        Image.fromarray(cleaned).save(stream, format='PNG', optimize=True)
        record['bufferView'] = append_view(document, binary, stream.getvalue())
        record['mimeType'] = 'image/png'
    write_glb(args.output, document, binary)
    report['bytes'] = args.output.stat().st_size
    args.output.with_suffix('.report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
