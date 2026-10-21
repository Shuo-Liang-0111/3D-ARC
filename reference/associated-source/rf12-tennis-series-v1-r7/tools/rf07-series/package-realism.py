"""Package observed resources and verify live asset bytes for the realism revision."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,hashlib,shutil,urllib.request,os
project=Path('.');prod=Path('./authoring/server-production/rf07-realism-v2');release=prod/os.environ.get('RF07_RELEASE','release-r3')
observed=json.loads((prod/'evidence/network-assets.json').read_text())+json.loads((prod/'evidence/realism-visual.json').read_text())['resources']
paths={unquote(urlsplit(u).path).lstrip('/') for u in observed if urlsplit(u).path.startswith(('/local-assets/','/vendor/'))}
paths.update(['vendor/draco/draco_decoder.js','vendor/draco/draco_decoder.wasm','vendor/draco/draco_wasm_wrapper.js']);records=[]
for rel in sorted(paths):
 source=project/'public'/rel;target=release/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
 digest=hashlib.sha256(source.read_bytes()).hexdigest();served=urllib.request.urlopen('http://127.0.0.1:4173/'+rel).read();assert hashlib.sha256(served).hexdigest()==digest,rel
 records.append({'path':rel,'bytes':source.stat().st_size,'sha256':digest,'servedMatch':True})
(release/'asset-manifest.json').write_text(json.dumps({'revision':'rf07-realism-v2','assets':records},indent=2));(prod/'asset-verification.json').write_text(json.dumps(records,indent=2));print('Verified and packaged',len(records),'runtime resources')
