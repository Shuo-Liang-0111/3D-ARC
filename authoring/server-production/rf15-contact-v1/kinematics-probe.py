from pathlib import Path
import json
import mujoco

from g1_simulation import G1Paths, G1Resources
from rf15_contact import build_contact_resources, RF15ContactSimulation

runtime = Path('./vendor-data')
policy = runtime / 'unitree_rl_lab/deploy/robots/g1_29dof/config/policy/velocity/v0'
base = G1Resources(G1Paths(runtime / 'unitree_mujoco/unitree_robots/g1/scene_29dof.xml', policy / 'exported/policy.onnx', policy / 'params/deploy.yaml'))
work = Path('./authoring/server-production/rf15-contact-v1')
resources = build_contact_resources(base, work / 'official-with-hand.xml', work / 'layout.json')
simulation = RF15ContactSimulation(resources)
simulation.reset({'x': -6.1, 'z': -12.3, 'yaw': 3.141592653589793})
hand = simulation.hands['right']
for shoulder in [-1.5, -1, -.5, 0, .5]:
    for elbow in [-.8, 0, .8, 1.5, 2.0]:
        simulation.data.qpos[hand['arm_qpos']] = [shoulder, -.15, 0, elbow, 0, 0, 0]
        mujoco.mj_kinematics(resources.model, simulation.data)
        print(json.dumps({'shoulder': shoulder, 'elbow': elbow, 'palm': simulation.data.site_xpos[hand['site']].tolist()}))
