import os
import re
import subprocess
from pathlib import Path

root = Path('./authoring/server-production/rf15-animation-v1')
def run(args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)
def output(args):
    return subprocess.check_output(args, text=True)

head = output(['git', 'rev-parse', 'HEAD']).strip()
index_file = root / 'commit.index'
environment = {**os.environ, 'GIT_INDEX_FILE': str(index_file)}
run(['git', 'read-tree', head], env=environment)
diff = output(['git', 'diff', 'HEAD', '--', 'game/app.js'])
blocks = re.split(r'(?=^@@ )', diff, flags=re.MULTILINE)
patch = blocks[0] + ''.join(block for block in blocks[1:] if 'browserPhysics' in block or '["physics", "qa"]' in block)
run(['git', 'apply', '--cached', '--recount', '-'], input=patch, env=environment)
candidate = subprocess.check_output(['git', 'show', ':game/app.js'], env=environment, text=True)
toast = '''    if (state.lastEvent !== "terminal_opened") {
      const message = levelId === "rf15"
        ? state.complete ? runtime.eventMessages.harvest_complete : state.failed ? runtime.eventMessages.progress_depleted : state.errors > beforeState.errors ? "操作未完成 · 余量 -5" : ""
        : runtime.eventMessages[state.lastEvent];
      showToast(message);
    }
'''
marker = '    audioSystem.playEvent(state.lastEvent, runtime.getSoundPosition(beforeState, state));\n\n'
if marker in candidate:
    candidate = candidate.replace(marker, marker.rstrip('\n') + '\n' + toast, 1)
candidate_path = root / 'commit-app.mjs'
candidate_path.write_text(candidate)
run(['node', '--check', str(candidate_path)])
blob = output(['git', 'hash-object', '-w', str(candidate_path)]).strip()
run(['git', 'update-index', '--cacheinfo', '100644,' + blob + ',game/app.js'], env=environment)
files = ['game/levels/rf15/animation-hand.js', 'game/levels/rf15/interaction-animation.js', 'game/levels/rf15/animation-qa.js', 'game/levels/rf15/variant-engine.js', 'tools/rf15-animation.test.mjs', 'docs/levels/rf15-interaction-animation.md', 'docs/levels/rf15-browser-physics.md']
run(['git', 'add', '--', *files], env=environment)
run(['git', 'diff', '--cached', '--check'], env=environment)
run(['git', 'diff', '--cached', '--stat'], env=environment)
assert output(['git', 'rev-parse', 'HEAD']).strip() == head, 'HEAD changed during commit preparation'
shared_patch = output(['git', 'diff', '--', 'game/app.js'])
run(['git', 'commit', '-m', 'Replace RF15 object physics with scripted F interaction animation'], env=environment)
if shared_patch:
    run(['git', 'apply', '--cached', '-'], input=shared_patch)
run(['git', 'add', '--', *files])
