from pathlib import Path
import difflib
import subprocess

changes = {
    'game/levels/rf13/level.js': [('"realism-v0.4.2"', '"realism-v0.4.3"')],
    'vite.config.js': [('"levels/rf13/realism-v0.4.2"', '"levels/rf13/realism-v0.4.3"')],
    'game/levels/rf13/scene.js': [
        ('import { RoomEnvironment }', 'import { mountClinicReviewMetrics } from "./review-metrics.js";\nimport { RoomEnvironment }'),
        ('  if (renderer) {\n', '  if (renderer) {\n    mountClinicReviewMetrics(renderer);\n'),
    ],
}
patch = ''
for name, replacements in changes.items():
    original = Path(name).read_text()
    updated = original
    for before, after in replacements:
        if updated.count(before) != 1:
            raise RuntimeError('Expected unique anchor: ' + name)
        updated = updated.replace(before, after)
    patch += ''.join(difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile='a/' + name, tofile='b/' + name))
subprocess.run(['git', 'apply', '--check', '-'], input=patch, text=True, check=True)
subprocess.run(['git', 'apply', '-'], input=patch, text=True, check=True)
