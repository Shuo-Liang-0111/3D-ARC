import json,shutil,hashlib,re,subprocess
from pathlib import Path
base=Path('./authoring/server-production/rf02-lighting-v8/release')
out=Path('./authoring/server-production/rf02-reserve-v9/release')
assert not out.exists()
shutil.copytree(base,out)
previous=json.loads((base/'lighting-release.json').read_text())
target=next(v for v in previous['renamedBundles'].values() if v.startswith('furniture-controller-'))
folder=out/'assets';scripts={p.name:p.read_text() for p in folder.glob('*.js')}
old='initial:e==="rf02-2"?50:100,maximum:100'
assert scripts[target].count(old)==1
scripts[target]=scripts[target].replace(old,'initial:100,maximum:100')
affected={target}
while True:
 before=len(affected)
 affected|={name for name,s in scripts.items() if any(child in s for child in affected)}
 if len(affected)==before:break
pending=set(affected);renames={}
while pending:
 progressed=False
 for name in list(pending):
  children={child for child in affected if child!=name and child in scripts[name]}
  if not children.issubset(renames):continue
  text=scripts[name]
  for child in children:text=text.replace(child,renames[child])
  new=re.sub(r'-[^-]+\.js$','-rf02v9-'+hashlib.sha256(text.encode()).hexdigest()[:12]+'.js',name)
  (folder/new).write_text(text);subprocess.run(['/usr/local/bin/node','--check',str(folder/new)],check=True)
  renames[name]=new;pending.remove(name);progressed=True
 assert progressed,'Cyclic bundle references'
for p in out.glob('*.html'):
 text=p.read_text()
 for before,after in renames.items():text=text.replace(before,after)
 p.write_text(text)
(out/'reserve-release.json').write_text(json.dumps({'revision':'rf02-reserve-v9','base':str(base),'initialReserve':100,'level':'rf02-2','renamedBundles':renames,'change':'Only RF-02-2 initial reserve 50 to 100; all other live code unchanged'},indent=2))
print(json.dumps({'release':str(out),'bundles':len(renames),'initialReserve':100}))
