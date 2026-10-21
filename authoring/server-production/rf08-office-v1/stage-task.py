from pathlib import Path
import subprocess,re,difflib
prod=Path('./authoring/server-production/rf08-office-v1')
files=['game/app.js','index.html','vite.config.js','tests/rf09-office.test.mjs']
assert not subprocess.check_output(['git','diff','--cached','--name-only'],text=True).strip(), 'Existing staged work must remain untouched'
prepared={}
for f in files:
 old=(prod/'pre-integration'/f).read_text();new=Path(f).read_text();head=subprocess.check_output(['git','show','HEAD:'+f],text=True)
 changes=list(difflib.SequenceMatcher(None,old.splitlines(True),new.splitlines(True),autojunk=False).get_opcodes())
 ol=old.splitlines(True);nl=new.splitlines(True)
 # Use each task-only replacement on HEAD, preserving unrelated working-tree changes outside the index.
 for tag,i,j,k,l in changes:
  if tag=='equal':continue
  before=''.join(ol[i:j]);after=''.join(nl[k:l])
  if before:
   if before not in head and f=='index.html':before=before.replace('<span>RF-08</span>','<span>RF-09</span>')
   assert head.count(before)==1,(f,'ambiguous replacement',before[:160]);head=head.replace(before,after,1)
  else:
   # An insertion is anchored to the immediately preceding unchanged line.
   anchors=[''.join(ol[max(0,i-n):i]) for n in range(1,9)];anchor=next((a for a in anchors if a and head.count(a)==1),None)
   assert anchor,(f,'ambiguous insertion',anchors[-1][:180]);head=head.replace(anchor,anchor+after,1)
 prepared[f]=head
for f,s in prepared.items():
 p=prod/'task-index'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
 patch=''.join(difflib.unified_diff(subprocess.check_output(['git','show','HEAD:'+f],text=True).splitlines(True),s.splitlines(True),fromfile='a/'+f,tofile='b/'+f))
 (prod/('task-index-'+Path(f).name+'.patch')).write_text(patch)
print('Prepared scoped index content for',files)
