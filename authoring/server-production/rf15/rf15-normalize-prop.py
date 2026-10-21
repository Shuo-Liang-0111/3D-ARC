import bpy
import bmesh
import sys
import json
import math
from mathutils import Vector
from pathlib import Path

name=sys.argv[sys.argv.index('--')+1]
production=Path('./authoring/server-production/rf15/v0.2')
output=Path('./public/local-assets/levels/rf15/realism-v0.2.2')
output.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(production/'source'/(name+'.glb')))
meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
for obj in meshes:
    matrix=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=matrix
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
coords=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
minimum=Vector([min(vertex[axis] for vertex in coords) for axis in range(3)])
maximum=Vector([max(vertex[axis] for vertex in coords) for axis in range(3)])
if name=='apple-crate':
    cut=minimum.z+(maximum.z-minimum.z)*.49
    for obj in meshes:
        mesh=bmesh.new();mesh.from_mesh(obj.data)
        remove=[vertex for vertex in mesh.verts if (obj.matrix_world@vertex.co).z>cut]
        bmesh.ops.delete(mesh,geom=remove,context='VERTS');mesh.to_mesh(obj.data);mesh.free()
    coords=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
    minimum=Vector([min(vertex[axis] for vertex in coords) for axis in range(3)])
    maximum=Vector([max(vertex[axis] for vertex in coords) for axis in range(3)])
width={'tomato-crate':.59,'apple-crate':.59,'platform-scale':.62,'pallet-jack':.70}[name]
rotate=name=='tomato-crate' and (maximum.y-minimum.y)>(maximum.x-minimum.x)
scale=width/(max(maximum.x-minimum.x,maximum.y-minimum.y) if 'crate' in name else maximum.x-minimum.x)
center=Vector([(minimum.x+maximum.x)/2,(minimum.y+maximum.y)/2,minimum.z])
for obj in meshes:
    for vertex in obj.data.vertices:
        position=(obj.matrix_world@vertex.co-center)*scale
        if rotate:position=Vector([-position.y,position.x,position.z])
        vertex.co=position
    obj.matrix_world.identity()
    obj.name=name
    if len(obj.data.polygons)>60000:
        modifier=obj.modifiers.new('runtime-decimation','DECIMATE');modifier.ratio=60000/len(obj.data.polygons)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
coords=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
minimum=[min(vertex[axis] for vertex in coords) for axis in range(3)]
maximum=[max(vertex[axis] for vertex in coords) for axis in range(3)]
print('IMAGES',[(image.name,list(image.size),bool(image.packed_file)) for image in bpy.data.images],flush=True)
bpy.ops.export_scene.gltf(filepath=str(output/(name+'.glb')),export_format='GLB',export_yup=True,export_extras=True,export_animations=False)
(output/(name+'.metrics.json')).write_text(json.dumps({'name':name,'size':[maximum[0]-minimum[0],maximum[2]-minimum[2],maximum[1]-minimum[1]],'min':[minimum[0],minimum[2],-maximum[1]],'max':[maximum[0],maximum[2],-minimum[1]],'frontAxis':'+Z','rotationDegrees':90 if rotate else 0,'crop':'Removed extraneous upper empty crate above 55 percent source height' if name=='apple-crate' else None},indent=2))
