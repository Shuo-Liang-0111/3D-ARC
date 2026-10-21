import bpy,json
from pathlib import Path
ROOT=Path('.')
OUT=ROOT/'public/local-assets/levels/rf04/architecture-v4/collision.glb'
if OUT.exists():raise RuntimeError('Do not overwrite a published collision version')
bpy.ops.wm.read_factory_settings(use_empty=True)
records=json.loads(Path('./authoring/server-production/rf04-series-v1/collision-v4.json').read_text())
for c in records:
 bpy.ops.mesh.primitive_cube_add(size=1,location=((c['minX']+c['maxX'])/2,-(c['minZ']+c['maxZ'])/2,1.10))
 o=bpy.context.object;o.name=c['id'];o.dimensions=(max(.01,c['maxX']-c['minX']),max(.01,c['maxZ']-c['minZ']),2.20)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB')
print('COLLIDERS',len(records))
