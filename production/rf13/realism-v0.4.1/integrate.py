from pathlib import Path
import difflib
import subprocess

changes = {
    'game/levels/rf13/level.js': [('export const REVISION = "realism-v0.4";', 'export const REVISION = "realism-v0.4.1";')],
    'game/levels/rf13/runtime.js': [('unit: "RF-13 · 真实化 v0.4"', 'unit: `RF-13 · 真实化 ${LEVEL.revision.split("-").at(-1)}`')],
    'vite.config.js': [('"levels/rf13/realism-v0.4"', '"levels/rf13/realism-v0.4.1"')],
    'rf13-preview.html': [('<button id="top">', '<button id="capture">保存截图</button><button id="top">')],
    'game/levels/rf13/preview.js': [('window.addEventListener("resize", resize);', 'document.querySelector("#capture").onclick = () => {\n  render();\n  const link = document.createElement("a");\n  link.download = `rf13-${revision}-${Date.now()}.png`;\n  link.href = renderer.domElement.toDataURL("image/png");\n  link.click();\n};\nwindow.addEventListener("resize", resize);')],
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
print('RF13 v0.4.1 revision integrated')
