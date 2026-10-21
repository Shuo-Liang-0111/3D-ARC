from pathlib import Path
import json

from g1_simulation import G1Paths, G1Resources
from rf15_contact import build_contact_resources, RF15ContactSimulation

runtime = Path('./vendor-data')
policy = runtime / 'unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0'
base = G1Resources(G1Paths(runtime / 'unitree_mujoco/unitree_robots/g1/scene_29dof.xml', policy / 'exported/policy.onnx', policy / 'params/deploy.yaml'))
work = Path('./authoring/server-production/rf15-contact-v1')
resources = build_contact_resources(base, work / 'official-with-hand.xml', work / 'layout.json')
simulation = RF15ContactSimulation(resources, stance_assistance=True)
simulation.reset({'x': -6.1, 'z': -12.3, 'yaw': 3.141592653589793})
for frame in range(80):
    simulation.step()
simulation.request_grasp('harvest-knife', 'right')
for frame in range(1000):
    simulation.step()
    if frame % 50 == 0:
        state = simulation.state()
        hand = simulation.hands['right']
        print(json.dumps({'frame': frame, 'base': state['base']['position'], 'hand': state['contactPhysics']['hands']['right'], 'palm': simulation.data.site_xpos[hand['site']].tolist(), 'armTarget': hand['arm_target'].tolist(), 'armActual': simulation.data.qpos[hand['arm_qpos']].tolist(), 'object': state['contactPhysics']['objects']['harvest-knife']}), flush=True)
