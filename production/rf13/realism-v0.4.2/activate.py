from pathlib import Path
import difflib
import subprocess

changes = {
    'game/levels/rf13/level.js': [('"realism-v0.4.1"', '"realism-v0.4.2"')],
    'vite.config.js': [('"levels/rf13/realism-v0.4.1"', '"levels/rf13/realism-v0.4.2"')],
    'tests/rf13-realism.test.mjs': [
        ('REVISION, PREPARATIONS', 'REVISION, PREPARATIONS, STATIC_BOXES'),
        ('readGlb, assetBounds', 'readGlb, assetBounds, nodeBounds'),
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
    if name == 'tests/rf13-realism.test.mjs':
        updated += '''
test("exported privacy curtains clear the beds and match their collision boxes", () => {
  const document = readGlb(root + "environment.glb");
  for (const curtain of CLINIC_FURNISHINGS.filter(item => item.id.startsWith("privacy-curtain-"))) {
    const index = document.nodes.findIndex(node => node.name === curtain.id);
    assert.ok(index >= 0, `missing ${curtain.id}`);
    const bounds = nodeBounds(document, index);
    const bed = STATIC_BOXES.find(item => item.id === curtain.id.replace("privacy-curtain", "exam-bed"));
    assert.ok(bounds.max.x < bed.position[0] - bed.size[0] / 2 - 0.05, "curtain must not pass through mattress");
    assert.ok(Math.abs(bounds.min.y - 0.40) < 0.03, "curtain hem remains above floor");
    for (const [axis, field] of ["x", "y", "z"].entries()) {
      assert.ok(bounds.min[field] >= curtain.position[axis] - curtain.size[axis] / 2 - 0.01);
      assert.ok(bounds.max[field] <= curtain.position[axis] + curtain.size[axis] / 2 + 0.01);
    }
  }
});
'''
    patch += ''.join(difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile='a/' + name, tofile='b/' + name))
subprocess.run(['git', 'apply', '--check', '-'], input=patch, text=True, check=True)
subprocess.run(['git', 'apply', '-'], input=patch, text=True, check=True)
print('Activated immutable V0.4.2 assets and curtain regression test')
