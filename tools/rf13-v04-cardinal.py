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
production = args.project / 'production/rf13/realism-v0.4'
production.mkdir(parents=True, exist_ok=True)
requests = production / 'requests'
sources = production / 'source'
requests.mkdir(exist_ok=True)
sources.mkdir(exist_ok=True)
ledger_path = production / 'tasks.json'
ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
prompts = {
    'clinical-basin': 'One realistic contemporary clinical handwash basin with attached chrome tall elbow-operated mixer tap. Isolated single sanitary fixture, no cabinet, no wall, no room or floor. White glazed ceramic rounded rectangular basin 0.60m wide and 0.46m deep, 0.14m thick, concave intact bowl, chrome circular drain, overflow hole. Tap at rear negative Z, total height including tap 0.38m. Clean subtle ceramic glaze, polished metal reflections, fine manufacturing details, front faces positive Z. No text, people or extra items.',
    'diagnostic-panel': 'One realistic wall mounted medical diagnostic instrument panel for a contemporary community clinic exam room. A compact off-white rectangular backplate 0.46m wide and 0.58m high, only 0.12m deep, with wall mounted aneroid blood pressure gauge, black coiled flexible tubing, cuff basket, otoscope and ophthalmoscope handles with cables resting in holders. Fine practical manufactured details. Isolated object front faces positive Z, back mounting surface at negative Z. No wall, room, floor slab, people, readable lettering or extra objects.',
}

def save():
    temporary = ledger_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(ledger, indent=2) + '\n')
    temporary.replace(ledger_path)

def call(*arguments):
    result = subprocess.run([sys.executable, str(args.helper), *arguments], capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Cardinal helper failed: ' + result.stderr[-400:])
    return json.loads(result.stdout)

for name, prompt in prompts.items():
    request_path = requests / (name + '.json')
    if not request_path.exists():
        request_path.write_text(json.dumps({'prompt': prompt, 'taskType': 'text_to_model', 'qualityPreset': 'high-highpoly', 'outputFormat': 'glb', 'enablePbr': True, 'texture': True, 'pivotToCenterBottom': True}, indent=2))
    if name not in ledger and args.submit:
        ledger[name] = {'status': 'submission-pending', 'request': str(request_path), 'regenerations': 0}
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
        record.update(sourceSha256=hashlib.sha256(output.read_bytes()).hexdigest(), path=str(output))
        save()
    print(name, record['status'], record.get('progress'), flush=True)
