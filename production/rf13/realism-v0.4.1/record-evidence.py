import hashlib
import json
from pathlib import Path
import urllib.request

root = Path.cwd()
revision = 'realism-v0.4.1'
production = root / 'production/rf13' / revision
runtime = root / 'public/local-assets/levels/rf13' / revision
built = root / 'dist/local-assets/levels/rf13' / revision
manifest_path = runtime / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
checks = []
for name, record in manifest['files'].items():
    runtime_bytes = (runtime / name).read_bytes()
    built_bytes = (built / name).read_bytes()
    with urllib.request.urlopen('http://127.0.0.1:4173/local-assets/levels/rf13/' + revision + '/' + name, timeout=30) as response:
        served_bytes = response.read()
    digest = hashlib.sha256(runtime_bytes).hexdigest()
    if runtime_bytes[:4] != b'glTF' or digest != record['sha256'] or runtime_bytes != built_bytes or runtime_bytes != served_bytes:
        raise RuntimeError('Runtime/build/served asset mismatch: ' + name)
    checks.append({'name': name, 'sha256': digest, 'bytes': len(runtime_bytes), 'runtimeBuildServedMatch': True})
for name in ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']:
    if (root / 'public/vendor/draco' / name).read_bytes() != (root / 'dist/vendor/draco' / name).read_bytes():
        raise RuntimeError('Decoder build mismatch: ' + name)
ledger = json.loads((root / 'production/rf13/realism-v0.4/tasks.json').read_text())
report = {'revision': revision, 'technicalPassed': True, 'assetChecks': checks, 'decodersMatch': True, 'gameplayTests': {'passed': 11, 'scope': 'tests/rf13-*.test.mjs', 'completeRouteInteractions': 20}, 'visualStatus': 'pending-browser-access', 'browserBlocker': 'Chrome ERR_BLOCKED_BY_CLIENT; reload rejected by automatic approval review. No browser bypass attempted.', 'reviewedEarlierCandidate': 'realism-v0.4 treatment-room screenshot revealed basin support gap; v0.4.1 adds worktop opening and corrects installation. Final screenshot still required.', 'cardinalTasks': {name: {'taskId': record['taskId'], 'status': record['status'], 'sourceSha256': record.get('sourceSha256')} for name, record in ledger.items()}}
(production / 'engineering-checks.json').write_text(json.dumps(report, indent=2) + '\n')
manifest['visualStatus'] = 'pending-browser-access'
manifest['provenance']['clinical-basin'] = 'Cardinal; production/rf13/realism-v0.4/tasks.json'
manifest['provenance']['diagnostic-panel'] = 'Cardinal; production/rf13/realism-v0.4/tasks.json'
manifest['validation'] = {'technicalPassed': True, 'browserVisualStatus': 'pending-browser-access', 'report': 'production/rf13/realism-v0.4.1/engineering-checks.json'}
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
(built / 'manifest.json').write_bytes(manifest_path.read_bytes())
print(json.dumps({'revision': revision, 'matchingAssets': len(checks), 'decodersMatch': True, 'visualStatus': report['visualStatus']}))
