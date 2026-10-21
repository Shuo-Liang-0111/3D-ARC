import hashlib
import json
from pathlib import Path
import urllib.request

root = Path('.')
revision = 'realism-v0.4.3'
production = root / 'production/rf13' / revision
runtime = root / 'public/local-assets/levels/rf13' / revision
built = root / 'dist/local-assets/levels/rf13' / revision
manifest = json.loads((runtime / 'manifest.json').read_text())
checks = []
for name, entry in manifest['files'].items():
    payload = (runtime / name).read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    with urllib.request.urlopen('http://127.0.0.1:4173/local-assets/levels/rf13/' + revision + '/' + name, timeout=30) as response:
        served = response.read()
    assert payload[:4] == b'glTF'
    assert digest == entry['sha256']
    assert payload == (built / name).read_bytes() == served
    checks.append({'name': name, 'sha256': digest, 'runtimeBuildServedMatch': True})
for name in ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']:
    assert (root / 'public/vendor/draco' / name).read_bytes() == (root / 'dist/vendor/draco' / name).read_bytes()
evidence = production / 'rf13-final-evidence'
screenshots = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in evidence.glob('*.png') if not path.name.startswith('.')}
report = {
    'revision': revision,
    'technicalPassed': True,
    'testsPassed': 12,
    'buildPassed': True,
    'assetChecks': checks,
    'decodersMatch': True,
    'reviewStatus': 'completed-with-defect',
    'visualStatus': 'failed-carry-contact',
    'productionCompleted': False,
    'architectureReview': 'passed',
    'previewRoute': {'interactions': 20, 'delivered': 4, 'returned': 4, 'prepared': 2, 'opened': True},
    'formalReview': {'assetsReady': '13/13', 'tested': ['third-person cutaway', 'first-person corridor', 'walk from entry to supply room', 'gauze pickup and downward view'], 'endToEndInteractionVisual': 'not-passed'},
    'defect': {'id': 'RF13-VIS-001', 'description': 'Shared G1 carrying pose leaves hands near waist while payload floats in front; scene payload scale is corrected to 1.', 'status': 'open-user-requested-freeze', 'source': 'game/robot.js updateRobotAnimation and cargoGrip'},
    'userDecision': {'date': '2026-09-09', 'text': '保持机器人冻结，仅记录缺陷', 'robotChangesAuthorized': False},
    'screenshots': screenshots,
    'formalMetrics': json.loads((evidence / 'formal-metrics.json').read_text()),
    'previewMetrics': json.loads((evidence / 'preview-metrics.json').read_text()),
}
(production / 'engineering-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
manifest['visualStatus'] = report['visualStatus']
manifest['validation'] = {'technicalPassed': True, 'visualStatus': report['visualStatus'], 'report': 'production/rf13/realism-v0.4.3/engineering-checks.json'}
manifest['knownDefects'] = [report['defect']]
manifest['userDecision'] = report['userDecision']
(runtime / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(built / 'manifest.json').write_bytes((runtime / 'manifest.json').read_bytes())
print(json.dumps({'revision': revision, 'matchingAssets': len(checks), 'evidenceImages': len(screenshots), 'visualStatus': report['visualStatus']}, ensure_ascii=False))
