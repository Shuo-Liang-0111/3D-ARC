from pathlib import Path

root = Path('.')
entry = root / 'index.html'
content = entry.read_text()
anchor = '            <a data-level-option="rf14" href="/?mode=play&amp;level=rf14"><span>RF-14</span><strong>网球场捡球归筐</strong></a>'
if 'data-level-option="rf15"' not in content:
    assert anchor in content
    entry.write_text(content.replace(anchor, anchor + '\n            <a data-level-option="rf15" href="/?mode=play&amp;level=rf15"><span>RF-15</span><strong>农产品冷链装运</strong></a>'))
config = root / 'vite.config.js'
content = config.read_text()
if 'levels/rf15/realism-v0.2.2' not in content:
    content = content.replace('  "levels/rf14/realism-v0.4.8",', '  "levels/rf14/realism-v0.4.8",\n  "levels/rf15/realism-v0.2.2",')
if 'rf15Preview:' not in content:
    content = content.replace('        rf14Preview: resolve("rf14-preview.html"),', '        rf14Preview: resolve("rf14-preview.html"),\n        rf15Preview: resolve("rf15-preview.html"),')
config.write_text(content)
scene = root / 'game/levels/rf15/scene.js'
content = scene.read_text()
content = content.replace('export function createCargoModel() { const root = variants(); root.userData.robotScale = 1; return root; }', '''export function createCargoModel() {
  const root = variants();
  root.userData.robotScale = 1;
  for (const variant of Object.values(root.userData.variants)) variant.position.y = -.25;
  return root;
}''')
scene.write_text(content)
content = content.replace('new THREE.PlaneGeometry(.38, .143)', 'new THREE.PlaneGeometry(.16, .09)')
content = content.replace('mesh.position.set(LEVEL.scale.x, 1.39, LEVEL.scale.z + .06);', 'mesh.position.set(LEVEL.scale.x, 1.55, LEVEL.scale.z - .205);')
content = content.replace('scale.position.set(LEVEL.scale.x, .76, LEVEL.scale.z);', 'scale.position.set(LEVEL.scale.x, .76, LEVEL.scale.z); scale.rotation.y = -Math.PI / 2;')
scene.write_text(content)
level = root / 'game/levels/rf15/level.js'
content = level.read_text().replace('scale: { x: -2.6, y: 0.84,', 'scale: { x: -2.6, y: 1.062,')
level.write_text(content)
qa = root / 'game/levels/rf15/qa.js'
content = qa.read_text()
content = content.replace("difference>0?'KeyE':'KeyQ'", "difference>0?'KeyQ':'KeyE'")
anchor = '  const records=[];let stage=0;'
if "抬头验收" not in content:
    content = content.replace(anchor, '''  const look=document.createElement('button');look.textContent='抬头验收';look.style.cssText=button.style.cssText;panel.append(look);
  look.onclick=async()=>{look.disabled=true;document.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp',bubbles:true}));await new Promise(resolve=>setTimeout(resolve,2100));document.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowUp',bubbles:true}));look.disabled=false;};
''' + anchor)
qa.write_text(content)
