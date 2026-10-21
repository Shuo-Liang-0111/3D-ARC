import bpy,json
from pathlib import Path
ROOT=Path('.')
OUT=ROOT/'public/local-assets/levels/rf04/architecture-v3/props';OUT.mkdir(parents=True,exist_ok=True)
targets={'shirt':18000,'pants':18000,'towel':18000,'wet-bundle':25000,'bed':35000,'washer':55000,'drying-rack':40000}
report=[]
for name,budget in targets.items():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/('public/local-assets/cardinal/rf04/models/runtime/'+name+'.glb')))
 meshes=[o for o in bpy.data.objects if o.type=='MESH']
 before=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
 ratio=min(1,budget/max(1,before))
 for o in meshes:
  if ratio<1:
   bpy.context.view_layer.objects.active=o
   mod=o.modifiers.new('Preserve silhouette, reduce static detail','DECIMATE');mod.ratio=ratio
   bpy.ops.object.modifier_apply(modifier=mod.name)
 after=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_position_quantization=16,export_draco_mesh_compression_level=6)
 report.append(dict(asset=name,before=before,after=after))
(OUT/'manifest.json').write_text(json.dumps(report,indent=2))
print(report)
