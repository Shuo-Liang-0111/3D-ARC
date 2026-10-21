import bpy
import math
from mathutils import Vector
from pathlib import Path

root = Path('./public/local-assets/cardinal/rf12-v2')
review = root / 'review/sep08'
review.mkdir(parents=True, exist_ok=True)
for filename, label, yaw in [('models/runtime/kitchen_sink.glb', 'sink', 0), ('models/source/kitchen_window_new.highpoly.glb', 'window', math.pi / 2), ('models/runtime/refrigerator.glb', 'fridge', 0)]:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(root / filename))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    bpy.context.view_layer.update()
    for obj in meshes:
        transform = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = transform
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    pivot = bpy.data.objects.new('audit orientation', None)
    bpy.context.collection.objects.link(pivot)
    for obj in meshes:
        obj.parent = pivot
    pivot.rotation_euler.z = yaw
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lower = Vector([min(point[axis] for point in points) for axis in range(3)])
    upper = Vector([max(point[axis] for point in points) for axis in range(3)])
    center = (lower + upper) * 0.5
    span = max(upper - lower)
    print('METRIC', label, tuple(lower), tuple(upper))
    if label == 'sink':
        for position in [(0, 0, 1), (0.2, 0, 1), (0, 0.2, 1)]:
            hit = bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector(position), Vector((0, 0, -1)))
            print('SINK_RAY', position, hit[0], tuple(hit[1]))
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.world.color = (0.35, 0.35, 0.35)
    for location, power in [((2, -3, 4), 450), ((-2, -1, 3), 300)]:
        bpy.ops.object.light_add(type='AREA', location=center + Vector(location) * span)
        light = bpy.context.object
        light.data.energy = power * span * span
        light.data.shape = 'DISK'
        light.data.size = 3 * span
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=center + Vector((1.1, -2.8, 1.6)) * span)
    camera = bpy.context.object
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.45
    scene.camera = camera
    scene.render.resolution_x = 800
    scene.render.resolution_y = 650
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(review / f'{label}.png')
    bpy.ops.render.render(write_still=True)
