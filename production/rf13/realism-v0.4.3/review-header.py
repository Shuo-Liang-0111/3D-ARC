from pathlib import Path
import difflib
import subprocess

path = Path('rf13-preview.html')
original = path.read_text()
updated = original.replace('header{height:112px;', 'header{height:140px;').replace('calc(100vh - 164px)', 'calc(100vh - 192px)')
if original == updated:
    raise RuntimeError('Expected review header sizing')
patch = ''.join(difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile='a/rf13-preview.html', tofile='b/rf13-preview.html'))
subprocess.run(['git', 'apply', '--check', '-'], input=patch, text=True, check=True)
subprocess.run(['git', 'apply', '-'], input=patch, text=True, check=True)
