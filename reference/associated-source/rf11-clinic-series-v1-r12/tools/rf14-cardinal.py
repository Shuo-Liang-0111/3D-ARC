import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--project', required=True, type=Path)
parser.add_argument('--helper', required=True, type=Path)
parser.add_argument('--submit', action='store_true')
args = parser.parse_args()
production = args.project / 'production/rf14/realism-v0.1'
requests = production / 'requests'
sources = production / 'source'
requests.mkdir(parents=True, exist_ok=True)
sources.mkdir(exist_ok=True)
ledger_path = production / 'tasks.json'
ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
prompts = {
    'tennis-bag': 'One photorealistic premium tennis racket sports duffel bag, navy blue woven nylon with cream piping, black carrying handles, realistic zippers, reinforced seams, shoulder strap resting along bag body. Horizontally resting flat on its bottom, 0.72 m long, 0.30 m deep, 0.27 m high. Slightly curved racket bag silhouette. Restrained clean everyday use, fine fabric weave and soft folds. Isolated single object, no floor, no room, no people, no text, no logos, no floating accessories. PBR materials, bottom center pivot, meters, Y up.',
    'court-bench': 'One photorealistic outdoor tennis court bench for two adults, 1.85 m wide, 0.65 m deep, 0.88 m tall, seat height 0.46 m. Honey brown horizontal timber slats with fine wood grain and real narrow gaps, dark forest green powder coated steel frame, four sturdy slim legs with foot mounting plates and practical curved armrests. Front faces positive Z; clean maintained contemporary sports club furniture, gentle natural weathering. Isolated single bench, no people, no ground, no scene, no letters or logos, no floating parts. PBR materials, real construction, Y up, bottom center pivot.',
}


def save():
    temporary = ledger_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(ledger, indent=2) + '\n')
    temporary.replace(ledger_path)


def call(*arguments):
    result = subprocess.run([sys.executable, str(args.helper), *arguments], capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Cardinal helper failed: ' + result.stderr[-500:])
    return json.loads(result.stdout)


for name, prompt in prompts.items():
    request_path = requests / (name + '.json')
    if not request_path.exists():
        request_path.write_text(json.dumps({'prompt': prompt, 'taskType': 'text_to_model', 'qualityPreset': 'high-highpoly', 'outputFormat': 'glb', 'enablePbr': True, 'texture': True, 'pivotToCenterBottom': True}, indent=2))
    if name not in ledger and args.submit:
        ledger[name] = {'status': 'submission-pending', 'provider': 'Cardinal', 'qualityPreset': 'high-highpoly', 'request': str(request_path.relative_to(args.project)), 'regenerations': 0}
        save()
        response = call('submit', 'model3d', '--file', str(request_path))
        ledger[name].update(taskId=response['taskId'], status=response['status'])
        save()
    record = ledger.get(name)
    if not record:
        continue
    if not record.get('taskId'):
        raise RuntimeError(name + ': reconcile uncertain submission before retry')
    task = call('task', record['taskId'])
    record.update({key: task.get(key) for key in ('status', 'progress', 'retryAfterSeconds', 'errorCode')})
    save()
    if record['status'] == 'completed':
        output = sources / (name + '.glb')
        if not output.exists():
            temporary = output.with_suffix('.partial')
            subprocess.run([sys.executable, str(args.helper), 'artifact', record['taskId'], '--output', str(temporary)], check=True, stdout=subprocess.DEVNULL, timeout=300)
            if temporary.stat().st_size < 1000 or temporary.read_bytes()[:4] != b'glTF':
                raise RuntimeError('Invalid GLB: ' + name)
            temporary.replace(output)
        record.update(sourceSha256=hashlib.sha256(output.read_bytes()).hexdigest(), path=str(output.relative_to(args.project)))
        save()
    print(name, record['status'], record.get('progress'), flush=True)
