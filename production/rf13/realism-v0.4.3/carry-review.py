from pathlib import Path
import difflib
import subprocess

changes = {
    'game/levels/rf13/scene.js': [('  const root = new THREE.Group(); root.userData.models = {};', '  const root = new THREE.Group(); root.userData.models = {}; root.userData.robotScale = 1;')],
    'rf13-preview.html': [('<button id="next" disabled>', '<button id="carrier">载荷近景</button><button id="next" disabled>')],
    'game/levels/rf13/preview.js': [('document.querySelector("#capture").onclick', 'document.querySelector("#carrier").onclick = () => {\n  camera.position.set(state.player.x + 1.6, 1.1, state.player.z + 1.6);\n  orbit.target.set(state.player.x, 0.8, state.player.z); orbit.update(); render();\n};\ndocument.querySelector("#capture").onclick')],
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
