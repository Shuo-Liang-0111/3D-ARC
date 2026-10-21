import re
import subprocess
from pathlib import Path

paths = ['game/app.js', 'vite.config.js']
selected = []
for path in paths:
    diff = subprocess.check_output(['git', 'diff', '-U0', '--', path], text=True)
    blocks = re.split(r'(?=^@@ )', diff, flags=re.MULTILINE)
    hunks = [block for block in blocks[1:] if any(marker in block for marker in ['browserPhysics', 'physicsResult', '["physics", "qa"]', '"levels/rf15/browser-physics-v1"'])]
    if hunks:
        selected.append(blocks[0] + ''.join(hunks))
patch = ''.join(selected)
Path('./authoring/server-production/rf15-browser-physics-v1/scoped-index.patch').write_text(patch)
subprocess.run(['git', 'apply', '--cached', '--unidiff-zero', '-'], input=patch, text=True, check=True)
