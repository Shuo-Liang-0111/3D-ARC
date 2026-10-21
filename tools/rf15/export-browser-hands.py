import argparse
import json
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--meshes', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = ET.parse(args.source).getroot()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
assets = {mesh.get('name'): mesh.get('file') for mesh in root.findall('asset/mesh')}

def numbers(element, key, default):
    return [float(value) for value in element.get(key, default).split()]

def convert(body, parent=None):
    joint = body.find('joint')
    inertial = body.find('inertial')
    result = {'name': body.get('name'), 'parent': parent, 'position': numbers(body, 'pos', '0 0 0'), 'quaternion': numbers(body, 'quat', '1 0 0 0'), 'mass': float(inertial.get('mass')) if inertial is not None else .1, 'geoms': []}
    if parent:
        result['joint'] = {'axis': numbers(joint, 'axis', '0 0 1'), 'limits': numbers(joint, 'range', '-1 1')}
    for geom in body.findall('geom'):
        mesh = geom.get('mesh', '')
        if not parent and '_hand_' not in mesh:
            continue
        if mesh:
            shutil.copyfile(Path(args.meshes) / assets[mesh], output / assets[mesh])
        result['geoms'].append({'mesh': assets.get(mesh), 'type': geom.get('type', 'mesh'), 'size': numbers(geom, 'size', '0 0 0'), 'position': numbers(geom, 'pos', '0 0 0'), 'quaternion': numbers(geom, 'quat', '1 0 0 0'), 'visual': geom.get('contype') == '0', 'collision': geom.get('contype') != '0'})
    return [result] + [entry for child in body.findall('body') for entry in convert(child, body.get('name'))]

hands = {}
for side in ('left', 'right'):
    hands[side] = convert(root.find(f'.//body[@name="{side}_wrist_yaw_link"]'))
    hands[side][0]['position'] = [0, 0, 0]
    hands[side][0]['quaternion'] = [1, 0, 0, 0]
(output / 'hands.json').write_text(json.dumps({'source': 'Unitree official g1_29dof_with_hand.xml and STL meshes', 'hands': hands}, indent=2) + '\n')
