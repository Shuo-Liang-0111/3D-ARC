import bpy
from pathlib import Path
from mathutils import Vector
root=Path('./public/local-assets/cardinal/rf12-v2')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'models/source/kitchen_window_new.highpoly.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
parent=bpy.data.objects.new('RF12_CARDINAL_WINDOW_ORIENTED',None); bpy.context.collection.objects.link(parent)
for o in meshes: o.parent=parent
parent.rotation_euler[2]=3.141592653589793/2
bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[i] for p in pts) for i in range(3)]); hi=Vector([max(p[i] for p in pts) for i in range(3)])
size=hi-lo
parent.location=-((lo+hi)/2)
bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[i] for p in pts) for i in range(3)]); hi=Vector([max(p[i] for p in pts) for i in range(3)])
size=hi-lo
scale=Vector((1.35/size.x,1.25/size.z,0.14/size.y))
fit=bpy.data.objects.new('RF12_CARDINAL_WINDOW_METER_FITTED',None); bpy.context.collection.objects.link(fit); fit.scale=scale; parent.parent=fit
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(root/'models/runtime/kitchen_window_cardinal_refined.glb'),export_format='GLB',export_yup=True,export_apply=True)
print('WINDOW_SIZE',tuple(size),'FIT_SCALE',tuple(scale))
