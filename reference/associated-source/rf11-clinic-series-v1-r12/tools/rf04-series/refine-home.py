import bpy, bmesh, math, json, re
from pathlib import Path
from mathutils import Vector
ROOT=Path('.')
OUT=ROOT/'public/local-assets/levels/rf04/architecture-v3'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/local-assets/embodiedgen/rf04/models/runtime/rf04_final.glb'))
removed=[]; closed=[];pending=[]
original_world={o.name:o.matrix_world.copy() for o in bpy.data.objects}
# Proxy cutters were incorrectly exported as solid visible objects.
remove_windows={0,6,7,9,10,12,13,15,17,19}
def world_bounds(o):
 pts=[o.matrix_world@Vector(v) for v in o.bound_box]
 return [min(v[i] for v in pts) for i in range(3)],[max(v[i] for v in pts) for i in range(3)]
def cube(name,x,z,w,d,bottom,top,material=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,(bottom+top)/2))
 o=bpy.context.object;o.name=name;o.dimensions=(w,d,top-bottom)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if material:o.data.materials.append(material)
 return o
walls=[o for o in bpy.data.objects if o.type=='MESH' and o.name.endswith('.wall')]
plaster=next(m for o in walls for m in o.data.materials if m and 'plaster' in m.name.lower())
for o in list(bpy.data.objects):
 name=o.name
 hit=re.search(r'WindowFactory.*spawn_asset\((\d+)\)',name)
 if hit and int(hit.group(1)) in remove_windows:
  # Patch the existing opening with a wall-aligned solid, using original local axes.
  lo,hi=world_bounds(o);c=(Vector(lo)+Vector(hi))/2
  axis=o.matrix_world.to_3x3()
  # Window mesh bounds have bevel/slat protrusions; derive tangent from footprint PCA.
  pts=[o.matrix_world@v.co for v in o.data.vertices]
  mx=sum(p.x for p in pts)/len(pts);my=sum(p.y for p in pts)/len(pts)
  xx=sum((p.x-mx)**2 for p in pts);yy=sum((p.y-my)**2 for p in pts);xy=sum((p.x-mx)*(p.y-my) for p in pts)
  angle=.5*math.atan2(2*xy,xx-yy);u=Vector((math.cos(angle),math.sin(angle),0));v=Vector((-u.y,u.x,0))
  us=[p.dot(u) for p in pts];vs=[p.dot(v) for p in pts]
  mid=u*((min(us)+max(us))/2)+v*((min(vs)+max(vs))/2)
  fill=cube('window-infill-'+hit.group(1)+'.wall',mid.x,-mid.y,max(us)-min(us)+.07,.24,.98,2.19,plaster)
  fill.rotation_euler.z=angle;walls.append(fill);closed.append(int(hit.group(1)))
 if re.match(r'^(door|window|entrance)(\.\d+)?$',name) or name.startswith(('SofaFactory','BedFactory')) or (hit and int(hit.group(1)) in remove_windows) or re.search('infinigen|carnivorefactory|herbivorefactory|hoof_parent_temp|camrig',name,re.I):
  removed.append(name);pending.append(o)
for o in list(pending):
 if o.name.startswith(('SofaFactory','BedFactory','WindowFactory')):pending.extend(o.children_recursive)
for name in set(o.name for o in pending):
 o=bpy.data.objects.get(name)
 if o:bpy.data.objects.remove(o,do_unlink=True)
# Removing exported cutter parents must not move their retained window children.
def depth(o):
 d=0
 while o.parent:d+=1;o=o.parent
 return d
for o in sorted(bpy.data.objects,key=depth):
 if o.name in original_world:o.matrix_world=original_world[o.name]
bpy.context.view_layer.update()
# Five useful room connections, 1.4–1.55m clear openings; preserve lintels.
portals=[
 dict(id='west-bedroom',x=-5.0,z=4.45,w=1.50,d=.85),
 dict(id='bathroom',x=.475,z=-.54,w=.85,d=1.40),
 dict(id='east-bedroom',x=2.85,z=3.175,w=.85,d=1.55),
 dict(id='dining-hall',x=2.675,z=-1.72,w=1.50,d=.85),
 dict(id='laundry-dining',x=3.8,z=-3.0,w=.85,d=1.60),
]
for portal in portals:
 cutter=cube('door-cut',portal['x'],portal['z'],portal['w'],portal['d'],-.15,2.22)
 clo,chi=world_bounds(cutter)
 for wall in walls:
  lo,hi=world_bounds(wall)
  if all(lo[i]<chi[i] and hi[i]>clo[i] for i in range(3)):
   bpy.context.view_layer.objects.active=wall
   mod=wall.modifiers.new('Widen interior passage','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
   bpy.ops.object.modifier_apply(modifier=mod.name)
   # Some imported room shells are non-manifold. Plane clipping removes
   # residual faces inside the opening even when a Boolean leaves slivers.
   bm=bmesh.new();bm.from_mesh(wall.data)
   for vertex in bm.verts:vertex.co=wall.matrix_world@vertex.co
   for axis in range(3):
    for value in [clo[axis],chi[axis]]:
     co=Vector((0,0,0));co[axis]=value;normal=Vector((0,0,0));normal[axis]=1
     bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=0.00001,plane_co=co,plane_no=normal)
   discard=[f for f in bm.faces if all(clo[i]+.00001<f.calc_center_median()[i]<chi[i]-.00001 for i in range(3))]
   bmesh.ops.delete(bm,geom=discard,context='FACES')
   inverse=wall.matrix_world.inverted()
   for vertex in bm.verts:vertex.co=inverse@vertex.co
   bm.to_mesh(wall.data);bm.free();wall.data.update()
 bpy.data.objects.remove(cutter,do_unlink=True)
# Ceiling footprint follows each real floor; inverted normals make it visible
# from inside and absent from the elevated third-person view without camera overrides.
for floor in [o for o in bpy.data.objects if o.type=='MESH' and o.name.endswith('.floor')]:
 pts=[];faces=[]
 floor.data.calc_loop_triangles()
 for t in floor.data.loop_triangles:
  vv=[floor.matrix_world@floor.data.vertices[i].co for i in t.vertices]
  normal=(vv[1]-vv[0]).cross(vv[2]-vv[0])
  if normal.z<=0:continue
  ids=[]
  for v in reversed(vv):ids.append(len(pts));pts.append((v.x,v.y,2.60))
  faces.append(ids)
 mesh=bpy.data.meshes.new('interior-ceiling');mesh.from_pydata(pts,[],faces);mesh.update()
 o=bpy.data.objects.new('rf04-interior-ceiling-'+floor.name,mesh);bpy.context.collection.objects.link(o)
 mat=bpy.data.materials.get('rf04-ceiling-plaster') or bpy.data.materials.new('rf04-ceiling-plaster')
 mat.diffuse_color=(.84,.82,.77,1);mat.use_nodes=True;mat.use_backface_culling=True
 mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.84,.82,.77,1)
 mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95
 mesh.materials.append(mat)
# Capture wall footprints directly from repaired geometry, including angled exterior walls.
colliders=[];seen=set()
for wall in walls:
 wall.data.calc_loop_triangles()
 for t in wall.data.loop_triangles:
  vv=[wall.matrix_world@wall.data.vertices[i].co for i in t.vertices]
  if max(p.z for p in vv)-min(p.z for p in vv)<.20:continue
  for i in range(3):
   a,b=vv[i],vv[(i+1)%3]
   if max(a.z,b.z)>.08 or (a-b).length<.06:continue
   a=Vector((a.x,-a.y));b=Vector((b.x,-b.y))
   key=tuple(sorted((tuple(round(n,3) for n in a),tuple(round(n,3) for n in b))))
   if key in seen:continue
   seen.add(key)
   n=1 if min(abs(a.x-b.x),abs(a.y-b.y))<.02 else math.ceil((a-b).length/.16)
   for j in range(n):
    p=a.lerp(b,j/n);q=a.lerp(b,(j+1)/n)
    colliders.append(dict(id='arch-wall-'+str(len(colliders)),minX=round(min(p.x,q.x)-.025,4),maxX=round(max(p.x,q.x)+.025,4),minZ=round(min(p.y,q.y)-.025,4),maxZ=round(max(p.y,q.y)+.025,4)))
# Bake decimation into static meshes; keep architecture and visible silhouettes.
before=0;after=0
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 tris=sum(len(p.vertices)-2 for p in o.data.polygons);before+=tris
 if tris>4000 and not o.name.endswith(('.wall','.floor')):
  target=4500 if re.search('plant|trinket|lamp',o.name,re.I) else 10000
  if tris>target:
   bpy.context.view_layer.objects.active=o
   mod=o.modifiers.new('Static detail budget','DECIMATE');mod.ratio=target/tris
   bpy.ops.object.modifier_apply(modifier=mod.name)
 after+=sum(len(p.vertices)-2 for p in o.data.polygons)
bpy.ops.export_scene.gltf(filepath=str(OUT/'home.glb'),export_format='GLB',export_apply=True)
report=dict(removed=removed,closedWindows=sorted(closed),portals=portals,trianglesBefore=before,trianglesAfter=after,wallColliders=colliders)
(OUT/'manifest.json').write_text(json.dumps(report,indent=2))
(ROOT/'game/levels/rf04/architecture-layout.js').write_text('// Generated from repaired wall geometry by tools/rf04-series/refine-home.py.\nexport const ARCHITECTURE_COLLIDERS = '+json.dumps(colliders,separators=(',',':'))+';\nexport const PORTALS = '+json.dumps(portals)+';\n')
print('RF04_REFINED',before,after,'wall colliders',len(colliders),'closed windows',closed)
