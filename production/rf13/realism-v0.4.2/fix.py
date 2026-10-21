from pathlib import Path
import difflib
import subprocess

changes = {
    'tools/rf13-v04-build.py': [('    mesh.matrix_world = transform\n    if parent.get', '    mesh.matrix_world = transform\n    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)\n    if parent.get')],
    'game/levels/rf13/furnishings.js': [('size: [0.10, 2.1, 0.28], position: [center + 0.70, 1.45, -1.88]', 'size: [0.08, 2.06, 0.26], position: [center + 0.70, 1.43, -1.88]')],
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
