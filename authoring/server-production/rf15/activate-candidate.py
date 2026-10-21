from pathlib import Path
import json
import struct

root=Path('.')
assets=root/'public/local-assets/levels/rf15/realism-v0.2.2'
required=['rf15_final','rf15_collision','tail-lift','tomato-crate','apple-crate','tomato-box','apple-box','platform-scale','pallet-jack','plane-tree']
for name in required:
    data=(assets/(name+'.glb')).read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
    document=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    if name in ['tomato-crate','apple-crate','platform-scale','pallet-jack']:
        assert len(document.get('images',[]))>=1, name+' missing textures'
level=root/'game/levels/rf15/level.js';level.write_text(level.read_text().replace('realism-v0.2.1','realism-v0.2.2'))
print('All ten assets verified; RF15 now uses realism-v0.2.2')
