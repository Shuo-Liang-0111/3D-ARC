import re, json, urllib.request, concurrent.futures
from urllib.parse import urljoin
from pathlib import Path
root=Path('.')
out=Path('./authoring/server-production/unified-level-menu-v1')
canonical=(root/'index.html').read_text()
nav=lambda html:re.search(r'<nav\b[^>]*class="level-select"[^>]*>([\s\S]*?)</nav>',html).group(1)
ids=lambda html:re.findall(r'data-level-option="([^"]+)"',nav(html))
wanted=ids(canonical)
before={row['id']:row for row in json.loads((out/'before.json').read_text())}
def inspect(level):
 url='http://127.0.0.1:4173/?mode=play&level='+level
 with urllib.request.urlopen(url) as response:
  html=response.read().decode()
  release=response.headers.get('x-arc-release')
 actual=ids(html)
 assert actual==wanted,(level,actual)
 assert nav(html)==nav(canonical),level
 assert html.count('<script data-arc-level-menu>')==1,level
 assert release==before[level]['release'],(level,release,before[level]['release'])
 return {'id':level,'count':len(actual),'release':release,'canonicalMenu':True,'navigationScript':True}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 results=list(pool.map(inspect,wanted))
(out/'after.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
releases=[
 ('rf01-sorting-build-v4-navigation-v1','index.html'),
 ('rf06-series-v1-r16','index.html'),('rf073-pickup-finish-r1','index.html'),
 ('rf08-office-v1-r28','index.htm'),('rf11-clinic-series-v1-r12','index.html'),
 ('rf12-tennis-series-v1-r7','index.htm')]
direct=[]
scripts=lambda html:re.findall(r'<script\b[^>]*src=["\x27]([^"\x27]+)',html)
for name,entry in releases:
 with urllib.request.urlopen('http://127.0.0.1:4173/'+name+'/'+entry+'?mode=play&level=rf01') as response:
  html=response.read().decode()
 original=(root/'public'/name/entry).read_text()
 assert ids(html)==wanted,name
 base='http://127.0.0.1:4173/'+name+'/'+entry
 assert [urljoin(base,s) for s in scripts(html)]==[urljoin(base,s) for s in scripts(original)],name
 direct.append({'release':name,'count':len(ids(html)),'gameplayScriptsUnchanged':True})
(out/'direct-releases.json').write_text(json.dumps(direct,indent=2))
print('PASS: all '+str(len(results))+' main entries share the same ordered menu and retain release routing.')
print('PASS: all 6 direct release entries share the same menu and unchanged gameplay script URLs.')

