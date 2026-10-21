from pathlib import Path
import hashlib
import json
import subprocess

root = Path('.')
production = Path('./authoring/server-production/rf15/v0.2')
production.mkdir(parents=True, exist_ok=True)
helper = '/opt/cardinal-aigc-skill/scripts/cardinal_aigc.py'
protected = ['game/robot.js', 'game/level.js', 'game/movement.js', 'game/g1-locomotion.js', 'game/unitree-g1-dex1-model.js', 'game/unitree-g1-edu2.js', 'game/robot-action.js', 'game/view-mode.js', 'game/operator-controls.js', 'game/third-person-view-controls.js', 'game/app.js']
baseline = production / 'protected-baseline.json'
if not baseline.exists():
    baseline.write_text(json.dumps({name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in protected}, indent=2))
profile = {'allowedHosts': ['127.0.0.1'], 'allowedRoot': '/path/to/arc-workspace', 'project': str(root), 'sshUser': 'chenhaoyuan', 'port': 4173, 'pidAtRecovery': 449301, 'authorization': 'User selected RF-15, cooperative depot, two produce types, weigh/pack/load, refrigerated truck with tail lift; autonomous generation and deployment.', 'reportCardinalCost': False, 'revision': 'v0.2', 'status': 'graybox', 'credentials': 'Existing private Cardinal store; no credentials in this record'}
(production / 'server-profile.json').write_text(json.dumps(profile, indent=2))
requests = {
    'apple-crate': 'Photorealistic agricultural harvest crate containing fresh red-yellow apples. One dark forest green injection-molded perforated reusable plastic crate with open top, two recessed handles, regular ventilated lattice walls, loosely filled with individual apples. Isolated single prop. No pedestal, no floor, no background, no text. Real food and plastic PBR materials.',
    'platform-scale': 'Photorealistic compact industrial produce weighing scale, stainless steel rectangular platform 60 by 50 centimeters, raised slim steel pole at the back with a small digital weight indicator, four rubber feet. Realistic commercial agricultural depot equipment, brushed steel and charcoal digital housing. Isolated single object, no produce, no floor or pedestal, no background.',
    'pallet-jack': 'Photorealistic manual hydraulic pallet jack, yellow painted steel low forks, black rubber wheels, tall black loop handle, realistic small hydraulic cylinder, worn edges but operational and clean. Industrial equipment isolated on transparent background, no pallet, no floor, no worker, no pedestal.',
}
tasks_path = production / 'tasks.json'
tasks = json.loads(tasks_path.read_text()) if tasks_path.exists() else {'tomato-crate': {'taskId': 'aigc_6b695d9bd55f45f59472b76577e87e9d', 'status': 'completed', 'request': './authoring/server-production/rf15/cardinal/tomato-crate.json'}}
for name, prompt in requests.items():
    if name in tasks:
        continue
    request_path = production / (name + '.request.json')
    request_path.write_text(json.dumps({'taskType': 'text_to_model', 'prompt': prompt, 'qualityPreset': 'high-highpoly', 'outputFormat': 'glb', 'enablePbr': True, 'texture': True, 'pivotToCenterBottom': True}))
    result = subprocess.run(['python3', helper, 'submit', 'model3d', '--file', str(request_path)], capture_output=True, text=True)
    response = json.loads(result.stdout)
    tasks[name] = {'taskId': response.get('taskId'), 'status': response.get('status'), 'request': str(request_path), 'response': response}
    tasks_path.write_text(json.dumps(tasks, indent=2))
    print(name, response.get('taskId'), response.get('status'), flush=True)
    if result.returncode or not response.get('taskId'):
        raise SystemExit('Submission stopped; inspect saved response before retrying')
source = production / 'source'
source.mkdir(exist_ok=True)
subprocess.run(['python3', helper, 'artifact', tasks['tomato-crate']['taskId'], '--output', str(source / 'tomato-crate.glb')], check=True)
