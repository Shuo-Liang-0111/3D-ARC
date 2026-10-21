import bpy,json
from pathlib import Path
root=Path('.');out=root/'public/local-assets/levels/rf04/architecture-v3'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out/'home.glb'))
for im in bpy.data.images:
 if im.size[0]>1024 or im.size[1]>1024:
  ratio=1024/max(im.size);im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio));im.pack()
bpy.ops.export_scene.gltf(filepath=str(out/'home.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_texcoord_quantization=12)
bpy.ops.wm.read_factory_settings(use_empty=True)
for c in json.loads(Path('./authoring/server-production/rf04-series-v1/collision-v2.json').read_text()):
 bpy.ops.mesh.primitive_cube_add(size=1,location=((c['minX']+c['maxX'])/2,-(c['minZ']+c['maxZ'])/2,1.10))
 o=bpy.context.object;o.name=c['id'];o.dimensions=(max(.01,c['maxX']-c['minX']),max(.01,c['maxZ']-c['minZ']),2.20)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
bpy.ops.export_scene.gltf(filepath=str(out/'collision.glb'),export_format='GLB')
