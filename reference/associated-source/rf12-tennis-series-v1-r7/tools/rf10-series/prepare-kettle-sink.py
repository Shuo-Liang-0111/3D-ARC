"""Fit a swivelling mixer to the existing sink; preserve basin/rim materials."""
import bpy,bmesh,math,sys,json
from pathlib import Path
from mathutils import Vector,Matrix
source,out=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH':continue
 matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=Matrix.Identity(4);obj.data.transform(matrix)
 if 'tripo' in obj.data.name.lower() or max(v.co.z for v in obj.data.vertices)>.28:
  bm=bmesh.new();bm.from_mesh(obj.data)
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.147),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
  bm.to_mesh(obj.data);bm.free()
metal=bpy.data.materials.new('Brushed chrome swivel mixer');metal.diffuse_color=(.38,.43,.46,1);metal.use_nodes=True
bs=metal.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.38,.43,.46,1);bs.inputs['Metallic'].default_value=.85;bs.inputs['Roughness'].default_value=.24
def cylinder(name,point,radius,depth):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=point)
 o=bpy.context.object;o.name=name;o.data.materials.append(metal)
 bevel=o.modifiers.new('Machined edge','BEVEL');bevel.width=.002;bevel.segments=3
 for f in o.data.polygons:f.use_smooth=True
 return o
cylinder('RF10_MIXER_FOOT',(-.342,0,.146),.054,.008)
cylinder('RF10_MIXER_BODY',(-.342,0,.185),.034,.07)
# Blender +Z vertical, -Y points to the front of the existing kitchen counter.
curve=bpy.data.curves.new('Swivel spout','CURVE');curve.dimensions='3D';curve.resolution_u=24;curve.bevel_depth=.013;curve.bevel_resolution=5
sp=curve.splines.new('BEZIER');pts=[(-.342,0,.213),(-.342,0,.40),(-.23,-.08,.51),(-.04,-.17,.53),(.025,-.17,.49)]
sp.bezier_points.add(len(pts)-1)
for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type=b.handle_right_type='AUTO'
o=bpy.data.objects.new('RF10_SWIVEL_SPOUT',curve);bpy.context.collection.objects.link(o);o.data.materials.append(metal)
cylinder('RF10_AERATOR',(.025,-.17,.480),.019,.022)
dark=metal.copy();dark.name='Aerator mesh';dark.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.045,.055,.06,1)
o=cylinder('RF10_AERATOR_MOUTH',(.025,-.17,.468),.014,.002);o.data.materials.clear();o.data.materials.append(dark)
sensor=cylinder('RF10_INFRARED_SENSOR',(.025,-.191,.470),.007,.006)
sensor.data.materials.clear();sensor.data.materials.append(dark)
lever=cylinder('RF10_TAP_LEVER',(-.303,.0,.203),.012,.048);lever.rotation_euler[1]=math.pi/2
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB')
print('SINK_OUTLET_THREE',[-.425,1.247,-2.38])
