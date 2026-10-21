import bpy,math,json
from mathutils import Vector
from pathlib import Path
out=Path("./public/local-assets/levels/rf06/pest-v2");out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
def mat(name,color,roughness=.33):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get("Principled BSDF");p.inputs["Base Color"].default_value=(*color,1);p.inputs["Roughness"].default_value=roughness;p.inputs["Coat Weight"].default_value=.3;return m
shell=mat("mahogany-chitin",(.105,.028,.011));wing=mat("amber-wing",(.21,.066,.018),.27);dark=mat("dark-joints",(.035,.012,.006),.43);eye=mat("black-compound-eye",(.009,.006,.004),.2)
def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 return o
def rod(name,a,b,r,material,parent=None):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r,radius2=r*.55,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat("Z","Y").to_euler();o.data.materials.append(material)
 if parent:o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
 return o
# Blender -Y is glTF +Z forward; body length is 60 mm.
sphere("abdomen",(0,.009,.007),(.012,.022,.0065),shell)
sphere("thorax",(0,-.014,.008),(.012,.011,.006),shell)
sphere("head",(0,-.023,.007),(.008,.006,.005),dark)
sphere("left_wing",(-.004,.01,.012),(.007,.021,.002),wing);sphere("right_wing",(.004,.01,.012),(.007,.021,.002),wing)
for side in [-1,1]:
 sphere("eye_"+str(side),(side*.0065,-.026,.009),(.002,.002,.002),eye)
 for j in range(3):
  x=side*.009;y=-.015+j*.015
  bpy.ops.object.empty_add(location=(x,y,.007));pivot=bpy.context.object;pivot.name=("left" if side<0 else "right")+"_leg_"+str(j)
  a=(x,y,.007);b=(side*.020,y+(-.009+j*.008),.009);c=(side*.029,y+(-.014+j*.011),.002)
  rod("femur",a,b,.0012,dark,pivot);rod("tibia",b,c,.0008,dark,pivot)
  rod("tarsus",c,(c[0]+side*.005,c[1]+.004,.001),.0004,dark,pivot)
  for t in [.35,.65]:
   v=Vector(b).lerp(Vector(c),t);rod("spine",v,v+Vector((side*.002,.001,.001)),.00024,dark,pivot)
 bpy.ops.object.empty_add(location=(side*.004,-.027,.008));pivot=bpy.context.object;pivot.name=("left" if side<0 else "right")+"_antenna"
 prev=(side*.004,-.027,.008)
 for k in range(1,8):
  nxt=(side*(.004+.0022*k),-.027-.005*k,.008+.001*math.sin(k*.5));rod("antenna_segment",prev,nxt,.00035,dark,pivot);prev=nxt
 rod("cerci",(side*.005,.029,.006),(side*.007,.036,.007),.0007,dark)
bpy.ops.export_scene.gltf(filepath=str(out/"cockroach.glb"),export_format="GLB",export_yup=True)
scene=bpy.context.scene;scene.render.engine="BLENDER_EEVEE_NEXT";scene.render.resolution_x=800;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world.color=(.2,.2,.2)
bpy.ops.object.light_add(type="AREA",location=(.1,-.1,.2));bpy.context.object.data.energy=8;bpy.context.object.data.size=.2
bpy.ops.object.camera_add(location=(.1,-.12,.16));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.005,.008))-cam.location).to_track_quat("-Z","Y").to_euler();cam.data.type="ORTHO";cam.data.ortho_scale=.14;scene.camera=cam
scene.render.filepath="./authoring/server-production/rf06-series-v1/evidence/cockroach-review.png";bpy.ops.render.render(write_still=True)
print("BODY_LENGTH_M",.06,"TOTAL_LENGTH_M",.098)
