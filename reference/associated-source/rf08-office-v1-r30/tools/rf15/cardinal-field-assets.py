import json
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
work = root.parent / 'production/rf15-cardinal-field-v1'
helper = root.parent / '.local/share/cardinal-aigc-skill/scripts/cardinal_aigc.py'
work.mkdir(parents=True, exist_ok=True)
requests = work / 'requests'
requests.mkdir(exist_ok=True)
source = work / 'source'
source.mkdir(exist_ok=True)
assets = {
    'lettuce': ('model3d', 'One whole mature green leaf lettuce plant growing upright, botanical photorealism, overlapping irregular cupped ruffled leaves in a natural rosette, translucent light green young heart and dark green outer leaves, fine branching veins, curled thin edges, slight soil at short cuttable basal stem, 35 cm wide 28 cm tall. Only the vegetable, no soil slab, no pot, no container, no background. PBR true leaf coloration, natural roughness, no toy look.'),
    'bok-choy': ('model3d', 'One whole mature Chinese bok choy plant growing upright, photorealistic botanical specimen, eight separate dark green spoon shaped leaves, thick pale cream green stalks joining a short basal stem, natural branching leaf veins, irregular curled leaf margins, realistic waxy roughness, 28 cm wide 32 cm tall. Only the vegetable, no pot, no ground slab, no container, no background. PBR natural coloration, not stylized.'),
    'basket': ('model3d', 'One empty rectangular reusable dark olive green plastic agricultural harvest crate, photorealistic worn produce basket, 65 cm wide 45 cm deep 32 cm tall, completely open top showing empty interior and perforated floor, actual open lattice ventilation slots in four walls, thick reinforced rounded rim, recessed open hand grips in short sides, ribs and feet, subtle scratches and dry soil in corners. Single isolated container, no vegetables, no contents, no ground, no text, no logo. PBR weathered matte polypropylene.'),
    'plaster': ('image', 'Seamless tileable photorealistic PBR base color texture of an aged Chinese rural farm tool shed exterior lime plaster wall, warm gray beige, fine gritty sand grains, subtle weather stains, small irregular chips exposing darker cement, restrained hairline cracks, realistic maintained farm building not ruined. Orthographic front view flat evenly lit surface, no perspective, no shadows, no objects, no text. Entire image only wall material.'),
    'wood': ('image', 'Seamless tileable photorealistic PBR albedo of weathered vertical oak boards on a rural farm shed door, muted warm gray brown, narrow natural grain, subtle knots and rubbed raised fibers, aged outdoor wood, realistic small variations between boards, dry matte surface. Orthographic straight on, even diffuse light, no cast shadows, no handles, no hinges, no text, entire image only wood.'),
    'roof': ('image', 'Seamless tileable photorealistic base color material texture of aged terracotta red painted galvanized sheet metal on a Chinese rural farm shed roof. Fine faded paint, subtle dusty patches, tiny exposed gray zinc scratches and restrained brown rust speckles, mostly preserved red paint. Flat orthographic scan with no corrugation perspective, no shadows, no objects, no labels, no text, uniformly lit material.'),
    'soil': ('image', 'Seamless tileable photorealistic PBR albedo texture of rich cultivated vegetable garden soil, dark warm brown damp earth crumbs and dry brown clods, small irregular granules 1 to 3 cm, a few tiny pebbles and organic fibers, no leaves, no plants, no regular pattern, no large rocks. Orthographic top down evenly lit scan, no shadows, no perspective, no text, entire image only soil.')
}

def call(*arguments):
    result = subprocess.run([sys.executable, str(helper), *arguments], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return json.loads(result.stdout)

ledger_file = work / 'tasks.json'
ledger = json.loads(ledger_file.read_text()) if ledger_file.exists() else {}
mode = sys.argv[2]
if mode == 'submit':
    for name, (kind, prompt) in assets.items():
        if name in ledger:
            continue
        payload = {'prompt': prompt}
        if kind == 'model3d':
            payload.update(taskType='text_to_model', qualityPreset='high-highpoly', outputFormat='glb', enablePbr=True, texture=True, pivotToCenterBottom=True)
        else:
            payload.update(resolution='2k', aspectRatio='1:1')
        request = requests / (name + '.json')
        request.write_text(json.dumps(payload, indent=2))
        submitted = call('submit', kind, '--file', str(request))
        ledger[name] = {'taskId': submitted.get('taskId', submitted.get('id')), 'kind': kind, 'status': submitted['status']}
        ledger_file.write_text(json.dumps(ledger, indent=2))
        print(name, ledger[name], flush=True)
elif mode == 'poll':
    for name, record in ledger.items():
        task = call('task', record['taskId'])
        record['status'] = task['status']
        if task.get('error'):
            record['error'] = task['error']
        ledger_file.write_text(json.dumps(ledger, indent=2))
        print(name, record, flush=True)
        if task['status'] == 'completed':
            path = source / (name + ('.glb' if record['kind'] == 'model3d' else '.png'))
            if not path.exists():
                subprocess.run([sys.executable, str(helper), 'artifact', record['taskId'], '--output', str(path)], check=True, stdout=subprocess.DEVNULL)
                print('downloaded', name, path.stat().st_size, flush=True)
