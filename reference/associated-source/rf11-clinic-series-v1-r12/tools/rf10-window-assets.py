import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/local-assets/levels/rf12/window-v5"
OUT.mkdir(parents=True,exist_ok=True)
BASE=ROOT/"public/local-assets/cardinal/rf12-v2/models/runtime"
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def load(name):
 clear();bpy.ops.import_scene.gltf(filepath=str(BASE/name))
def export(name):
 bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',export_extras=True)
def box(name,size,pos,mat=None,collision=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(pos[0],-pos[2],pos[1]))
 o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if mat:o.data.materials.append(mat)
 if collision:o['collision']=True;o['shape']='box'
 # Project east-wall UVs continuously across the four segments.
 for p in o.data.polygons:
  for li in p.loop_indices:
   v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
   o.data.uv_layers.active.data[li].uv=((-v.y+3.4)/6.8,v.z/2.8)
 return o
segments=[
 ('LOW',[.16,.85,6.8],[4.12,.425,0]),
 ('HIGH',[.16,.7,6.8],[4.12,2.45,0]),
 ('REAR',[.16,1.25,3.125],[4.12,1.475,-1.8375]),
 ('FRONT',[.16,1.25,2.325],[4.12,1.475,2.2375])
]
load('kitchen_environment_installed.glb')
old=bpy.data.objects['RF12_EAST_WALL_TILE'];mat=old.data.materials[0];bpy.data.objects.remove(old,do_unlink=True)
for tag,size,pos in segments:box('RF12_EAST_WALL_WINDOW_'+tag,size,pos,mat)
export('kitchen-environment.glb')
load('kitchen_collision.glb')
old=bpy.data.objects['COLLIDER_east-wall'];bpy.data.objects.remove(old,do_unlink=True)
for tag,size,pos in segments:box('COLLIDER_east-window-'+tag.lower(),size,pos,collision=True)
export('kitchen-collision.glb')
load('kitchen_window_refined.glb')
old=bpy.data.objects.get('RF12_WINDOW_CRESCENT_LATCH')
if old:bpy.data.objects.remove(old,do_unlink=True)
sash=bpy.data.objects['RF12_WINDOW_MOVING_SASH']
mat=bpy.data.materials.new('RF10_BRUSHED_HANDLE');mat.diffuse_color=(.42,.46,.45,1);mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.42,.46,.45,1);bs.inputs['Metallic'].default_value=.8;bs.inputs['Roughness'].default_value=.3
def rod(name,a,b,r):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]))
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=(b-a).length,location=(a+b)/2)
 o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);o.parent=sash
 for p in o.data.polygons:p.use_smooth=True
rod('RF10_WINDOW_PULL',(.02,.23,.12),(.02,.37,.12),.014)
for y in [.23,.37]:rod('RF10_WINDOW_PULL_MOUNT_'+str(y),(.02,y,.035),(.02,y,.12),.012)
export('sliding-window.glb')
print('RF10_WINDOW_V5_ASSETS_READY')
