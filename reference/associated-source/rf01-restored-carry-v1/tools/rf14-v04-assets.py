import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--production', type=Path, required=True)
parser.add_argument('--helper', type=Path, required=True)
parser.add_argument('--action', choices=['submit', 'poll'], required=True)
args = parser.parse_args()
args.production.mkdir(parents=True, exist_ok=True)
ledger_path = args.production / 'tasks.json'
initial = {
    'ball-hopper': {'taskId': 'aigc_0346b54cbb5a4b95bc6038c93c6b9552', 'kind': 'model3d'},
    'umpire-chair': {'taskId': 'aigc_9fe778c815804e52a8392d245d14438f', 'kind': 'model3d'},
    'windscreen': {'taskId': 'aigc_9a5d710af59f4fb8aceb90bc73b3dbb4', 'kind': 'model3d'},
}
ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else initial
requests = {
    'paving-detail': ('image', {'resolution': '1k', 'aspectRatio': '1:1', 'prompt': 'Photographic seamless material texture of outdoor light warm gray concrete, fine aggregate, subtle mottled weathering, evenly lit top down orthographic, flat diffuse light, no shadows, no objects, no lines, no perspective, no text.'}),
    'leaf-cluster': ('image', {'resolution': '1k', 'aspectRatio': '1:1', 'transparentBackground': True, 'prompt': 'Photorealistic isolated small London plane tree leafy twig, 9 small five-lobed fresh summer green leaves, realistic leaf veins, subtle variation dark green to yellow green, slender brown twig, photographed flat with soft diffuse neutral light, entire delicate branch visible, transparent background, no pot, no ground, no shadow, realistic botanical photography, not 3D render or illustration.'}),
    'plane-tree': ('model3d', {'taskType': 'text_to_model', 'qualityPreset': 'high-highpoly', 'outputFormat': 'glb', 'enablePbr': True, 'texture': True, 'pivotToCenterBottom': True, 'faceLimit': 70000, 'prompt': 'Single photorealistic mature London plane tree, 7 meters tall and 5 meters wide, irregular branching trunk with mottled pale gray brown exfoliating bark, dense natural summer green lobed leaves in varied clusters, realistic landscape tree for outdoor tennis club. Full tree including base, isolated, no ground slab, no planter, no grass, no background buildings. Fine branches visible through dense organic canopy, no polygonal clumps, no cartoon style.'}),
    'court-surface': ('image', {'resolution': '2k', 'aspectRatio': '1:1', 'quality': 'advanced', 'prompt': 'Seamless tileable physically realistic photographic material sample, muted medium cobalt blue outdoor acrylic tennis hard court, perpendicular orthographic macro photograph covering 80 cm square, fine bonded silica sand granules and subtle natural roller application variation, clean maintained sports facility with very faint shoe abrasion, matte dry surface, evenly diffuse lit, no shadows, no court lines, no objects, no cracks, no borders. Base color texture only without perspective.'}),
    'paving-surface': ('image', {'resolution': '2k', 'aspectRatio': '1:1', 'quality': 'advanced', 'prompt': 'Seamless tileable photorealistic texture of warm light gray outdoor concrete pavers, 4 by 4 aligned square slabs in a square image, very narrow dark sand joints, subtle concrete pores and gentle aggregate grain, maintained tennis club walkway, clean lightly weathered, flat orthographic top down, uniform diffuse lighting, no shadows, no objects, no grass, no perspective.'}),
}


def call(*parts):
    result = subprocess.run(['python3', str(args.helper), *parts], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)


def save():
    ledger_path.write_text(json.dumps(ledger, indent=2) + '\n')


save()
if args.action == 'submit':
    for name, (kind, payload) in requests.items():
        if name in ledger:
            continue
        request = args.production / 'requests' / (name + '.json')
        request.parent.mkdir(exist_ok=True)
        request.write_text(json.dumps(payload, indent=2))
        ledger[name] = {'kind': kind, 'status': 'submitting'}
        save()
        response = call('submit', kind, '--file', str(request))
        ledger[name] = {**response, 'kind': kind}
        save()
        print(name, response['taskId'], response['status'], flush=True)
else:
    for name, record in ledger.items():
        if not record.get('taskId'):
            raise RuntimeError('Unconfirmed submission: ' + name)
        response = call('task', record['taskId'])
        ledger[name].update(response)
        save()
        if response['status'] == 'completed':
            output = args.production / ('cardinal-' + name + ('.png' if record['kind'] == 'image' else '.glb'))
            if not output.exists():
                call('artifact', record['taskId'], '--output', str(output))
            ledger[name]['output'] = str(output)
            save()
        print(name, response['status'], flush=True)
