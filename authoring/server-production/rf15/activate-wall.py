from pathlib import Path
import json
import hashlib
import re

root = Path('.')
candidate = root / 'public/local-assets/levels/rf15/realism-v0.2.8'
validation = json.loads((candidate / 'wall-validation.json').read_text())
for name, checksum in validation['requiredAssetHashes'].items():
    assert hashlib.sha256((candidate / (name + '.glb')).read_bytes()).hexdigest() == checksum
manifest_path = candidate / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['status'] = 'internal-review'
for asset in manifest['assets']:
    for field in ('runtimePath', 'buildPath', 'deployedUrl'):
        if field in asset:
            asset[field] = re.sub(r'realism-v[0-9.]+', candidate.name, asset[field])
    if asset['id'] in validation['requiredAssetHashes']:
        asset['runtimeSha256'] = validation['requiredAssetHashes'][asset['id']]
        asset['bytes'] = (candidate / (asset['id'] + '.glb')).stat().st_size
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
for relative in ('game/levels/rf15/level.js', 'vite.config.js'):
    path = root / relative
    previous = path.read_text()
    assert previous.count('realism-v0.2.7') == 1, relative
    path.write_text(previous.replace('realism-v0.2.7', candidate.name))
review = root / 'public/level-preview/rf15-wall-review.html'
review.write_text((root / 'index.html').read_text().replace('</body>', '<script type="module" src="/level-preview/rf15-wall-review.js"></script></body>'))
print('Candidate activated with complete verified package')
