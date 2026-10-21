from pathlib import Path
import difflib
import subprocess

changes = {
    'game/levels/rf13/furnishings.js': [
        ('  ...[-5.25, -1.75, 1.75, 5.25].map(center', '  ...[-1.75, 1.75].map(center => ({\n    id: `privacy-curtain-${center}`, size: [0.10, 2.1, 0.28], position: [center + 0.70, 1.45, -1.88], color: "#e3e6df", category: "fixture",\n  })),\n  ...[-5.25, -1.75, 1.75, 5.25].map(center'),
    ],
    'tools/rf13-v04-build.py': [
        ("    elif entry['category'] == 'fixture':", "    elif name.startswith('privacy-curtain-'):\n        parent = group(name)\n        for fold in range(9):\n            fold_z = center_z + 0.10 - fold * 0.025\n            fold_x = center_x + (fold % 2) * 0.018 - 0.009\n            rod('gathered privacy curtain fold', [fold_x, 0.40, fold_z], [fold_x, 2.40, fold_z], 0.026, linen, parent)\n            rod('curtain carrier', [fold_x, 2.39, fold_z], [center_x, 2.46, fold_z], 0.003, steel, parent)\n    elif entry['category'] == 'fixture':"),
        ("    bed_x = center + 1.22\n    rod('privacy curtain wall rail', [bed_x + 0.27, 2.45, -3.45], [bed_x + 0.27, 2.45, -1.65], 0.012, steel, details)\n    for fold in range(9):\n        rod('gathered privacy curtain fold', [bed_x + 0.24 + (fold % 2) * 0.025, 0.40, -1.75 - fold * 0.025], [bed_x + 0.24 + (fold % 2) * 0.025, 2.40, -1.75 - fold * 0.025], 0.026, linen, details)", "    curtain_x = center + 0.70\n    rod('privacy curtain rail', [curtain_x, 2.46, -3.65], [curtain_x, 2.46, -1.68], 0.012, steel, details)\n    for support_z in [-3.55, -1.78]:\n        rod('ceiling hanger', [curtain_x, 2.46, support_z], [curtain_x, 2.78, support_z], 0.009, steel, details)\n        box('ceiling hanger flange', [0.055, 0.012, 0.055], [curtain_x, 2.776, support_z], steel, details)"),
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
print('Curtains moved clear of beds, with ceiling suspension and matching collision')
