from pathlib import Path
import hashlib
import json

root = Path('.')
revision = 'realism-v0.3.2'
directory = root / 'public/local-assets/levels/rf15' / revision
manifest = json.loads((directory / 'manifest.json').read_text())
assert len(manifest['assets']) == 10
for asset in manifest['assets']:
    payload = (root / asset['runtimePath']).read_bytes()
    assert payload[:4] == b'glTF'
    assert hashlib.sha256(payload).hexdigest() == asset['sha256']
for relative in ('game/levels/rf15/level.js', 'vite.config.js'):
    path = root / relative
    content = path.read_text()
    assert content.count('realism-v0.2.8') == 1, relative
    path.write_text(content.replace('realism-v0.2.8', revision))
wall_path = directory / 'wall-validation.json'
wall = json.loads(wall_path.read_text())
wall['revision'] = revision
wall['source'] = 'realism-v0.2.8'
wall['requiredAssetHashes'] = {asset['id']: asset['sha256'] for asset in manifest['assets']}
wall_path.write_text(json.dumps(wall, indent=2) + '\n')
print('Verified package activated:', revision)
