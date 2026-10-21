import hashlib
import json
import pathlib
import subprocess
import sys

root = pathlib.Path('./public/local-assets/levels/rf13/cardinal-v0.2')
helper = '/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py'
tasks = json.loads((root / 'tasks.json').read_text())['tasks']
records = {}
record_path = root / 'status.json'
if record_path.exists():
    records = json.loads(record_path.read_text())
for name, task_id in tasks.items():
    response = subprocess.run([sys.executable, helper, 'task', task_id], capture_output=True, text=True)
    if response.returncode:
        print(name, 'status-read-failed', flush=True)
        continue
    task = json.loads(response.stdout)
    record = {key: task.get(key) for key in ['taskId', 'status', 'progress', 'queueReason', 'retryAfterSeconds', 'errorCode', 'updatedAt']}
    output = root / 'models/source' / (name + '.glb')
    if task['status'] == 'completed' and not output.exists():
        result = subprocess.run([sys.executable, helper, 'artifact', task_id, '--output', str(output)], capture_output=True, text=True)
        record['downloaded'] = result.returncode == 0
    if output.exists():
        record['bytes'] = output.stat().st_size
        record['sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
    records[name] = record
    record_path.write_text(json.dumps(records, indent=2))
    print(name, record['status'], record.get('progress'), record.get('bytes', 0), flush=True)
