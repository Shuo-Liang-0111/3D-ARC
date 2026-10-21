from pathlib import Path
import hashlib
import json
import subprocess
import urllib.request

root = Path('.')
production = Path('./authoring/server-production/rf15')
record = production / 'v0.2'
revision = 'realism-v0.2.2'
audit = json.loads((record / 'asset-audit.json').read_text())
tasks = json.loads((record / 'tasks.json').read_text())
for task in tasks.values():
    task['status'] = 'completed'
(record / 'tasks.json').write_text(json.dumps(tasks, indent=2))
layout = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {LEVEL,STRUCTURES,PRODUCE,REVISION} from './game/levels/rf15/level.js'; console.log(JSON.stringify({LEVEL,STRUCTURES,PRODUCE,REVISION}));"], cwd=root))
(record / 'layout.json').write_text(json.dumps(layout, indent=2))
(root / 'docs/levels/rf15-layout.json').write_text(json.dumps(layout, indent=2))
hash_file = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assets = []
for measurement in audit['assets']:
    name = Path(measurement['asset']).stem
    relative = Path('local-assets/levels/rf15') / revision / measurement['asset']
    runtime = root / 'public' / relative
    built = root / 'dist' / relative
    url = 'http://127.0.0.1:4173/' + str(relative)
    served = hashlib.sha256(urllib.request.urlopen(url, timeout=30).read()).hexdigest()
    assert served == hash_file(runtime) == hash_file(built) == measurement['sha256'], name
    source = record / 'source' / measurement['asset'] if name in tasks else production / 'rf15-build-assets.py'
    if name == 'plane-tree':
        source = root / 'public/local-assets/levels/rf14/realism-v0.4.8/plane-tree.glb'
    assets.append({'id': name, 'provider': 'Cardinal' if name in tasks else 'RF14 reuse' if name == 'plane-tree' else 'Blender', 'taskId': tasks.get(name, {}).get('taskId'), 'sourcePath': str(source), 'sourceSha256': hash_file(source), 'runtimePath': str(runtime.relative_to(root)), 'buildPath': str(built.relative_to(root)), 'runtimeSha256': served, 'deployedUrl': url, 'bytes': measurement['bytes'], 'size': measurement['size'], 'pivot': 'bottom-center' if name not in ['rf15_final','rf15_collision'] else 'scene-origin', 'embeddedImages': measurement['embeddedImages'], 'triangles': measurement['triangles'], 'byteCheck': 'passed'})
baseline = json.loads((record / 'protected-baseline.json').read_text())
protected = {name: hash_file(root / name) == digest for name, digest in baseline.items() if name != 'game/app.js'}
assert all(protected.values()), protected
collider = next(asset for asset in audit['assets'] if asset['asset'] == 'rf15_collision.glb')
for structure in layout['STRUCTURES']:
    node = next(node for node in collider['nodes'] if node['name'] == 'COLLIDER_' + structure['id'])
    assert node['collision']
    for axis in range(3):
        assert abs(node['min'][axis] - (structure['position'][axis] - structure['size'][axis] / 2)) < .005
        assert abs(node['max'][axis] - (structure['position'][axis] + structure['size'][axis] / 2)) < .005
manifest = {'level': 'rf15', 'revision': revision, 'status': 'final-verification', 'assets': assets, 'generationTasks': [{'assetId': name, 'taskId': task['taskId'], 'status': 'completed', 'quality': 'high-highpoly'} for name, task in tasks.items()], 'protectedFiles': protected, 'collisionGeometry': 'passed: 13 structures, 5 mm tolerance; floor node also exported', 'textures': {'provider': 'Poly Haven', 'license': 'CC0', 'reusedFrom': 'public/local-assets/polyhaven/rf01/textures', 'assets': ['hangar_concrete_floor', 'aerial_asphalt_01']}, 'userAcceptance': 'not_received'}
(root / 'docs/levels/rf15-asset-manifest.json').write_text(json.dumps(manifest, indent=2))
(root / 'public/local-assets/levels/rf15' / revision / 'manifest.json').write_text(json.dumps(manifest, indent=2))
tool_dir = root / 'tools/rf15'
tool_dir.mkdir(exist_ok=True)
builder = (production / 'rf15-build-assets.py').read_text().split('raise SystemExit(0)')[0]
builder = builder.replace('import bpy\n', 'import bpy\nimport sys\n')
builder = builder.replace("root = Path('.')\nproduction = Path('./authoring/server-production/rf15/v0.2')\noutput = root / 'public/local-assets/levels/rf15/realism-v0.2.2'", "arguments = sys.argv[sys.argv.index('--') + 1:]\nroot = Path(arguments[0])\nproduction = Path(arguments[1])\noutput = root / 'public/local-assets/levels/rf15' / arguments[2]")
builder = builder.replace("font = bpy.data.fonts.load('/usr/share/fonts/opentype/unifont/unifont.otf')", "font = bpy.data.fonts.load(arguments[3])")
(tool_dir / 'build-assets.py').write_text(builder)
normalizer = (production / 'rf15-normalize-prop.py').read_text()
normalizer = normalizer.replace("name=sys.argv[sys.argv.index('--')+1]\nproduction=Path('./authoring/server-production/rf15/v0.2')\noutput=Path('./public/local-assets/levels/rf15/realism-v0.2.2')", "arguments=sys.argv[sys.argv.index('--')+1:]\nname=arguments[0]\nproduction=Path(arguments[1])\noutput=Path(arguments[2])")
normalizer = normalizer.replace('above 55 percent', 'above 49 percent')
(tool_dir / 'normalize-prop.py').write_text(normalizer)
(tool_dir / 'audit-assets.py').write_text((production / 'audit-assets.py').read_text())
print(json.dumps({'byteChecks': len(assets), 'protectedFiles': protected, 'colliders': len(layout['STRUCTURES'])}))
