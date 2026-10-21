"""Reuse the existing cabinet skin, separate its door, add an interior and export a new immutable GLB."""
import bpy,bmesh
from pathlib import Path
from mathutils import Vector
root=Path('.')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'public/local-assets/cardinal/rf07/models/runtime/medical_refrigerator.glb'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
door=obj.copy();door.data=obj.data.copy();bpy.context.collection.objects.link(door)
def is_door(f):
 c=f.calc_center_median();return c.y<-.28 and .18<c.z<1.72 and abs(c.x)<.335
for ob,keep in [(obj,False),(door,True)]:
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if is_door(f)!=keep],context='FACES');bm.to_mesh(ob.data);bm.free()
pivot=bpy.data.objects.new('RF07_CABINET_DOOR',None);bpy.context.collection.objects.link(pivot);pivot.location=(-.345,-.405,0);door.parent=pivot;door.matrix_parent_inverse=pivot.matrix_world.inverted();bpy.context.view_layer.update();door.matrix_parent_inverse=pivot.matrix_world.inverted()
m=bpy.data.materials.new('Cabinet interior');m.diffuse_color=(.71,.77,.78,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.71,.77,.78,1);bs.inputs['Metallic'].default_value=.22;bs.inputs['Roughness'].default_value=.42
def box(name,loc,scale):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
box('interior-back',(0,.33,.94),(.66,.035,1.50))
for x in [-.33,.33]:box('interior-side',(x,0,.94),(.025,.65,1.50))
for z in [.2,.74,1.68]:box('interior-shelf',(0,0,z),(.65,.66,.022))
out=root/'public/local-assets/levels/rf07/series-v1/medical_refrigerator.glb';out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
print('OUTPUT',out)
