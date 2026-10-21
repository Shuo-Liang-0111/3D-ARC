exec(open('./authoring/server-production/rf15-contact-v1/balance-probe.py').read().split('resources =')[0])
import numpy as np
import mujoco

layout = json.loads((work / 'layout.json').read_text())
for item in layout['objects']:
    if item['id'] == 'harvest-knife':
        item['position'] = [-6.0, 1.155, -12.75]
        item['quat'] = [2 ** -.5, 0, 0, -(2 ** -.5)]
        item['shapes'][0]['size'][0] = .016
        item['grasp'][0] = -.045
layout['structures'].extend([
    {'id': 'knife-blade-rest', 'position': [-6.13, 1.097, -12.75], 'size': [.12, .154, .07]},
    {'id': 'knife-handle-rest', 'position': [-5.82, 1.09, -12.75], 'size': [.025, .14, .06]},
])
(work / 'balance-layout.json').write_text(json.dumps(layout))
resources = build_contact_resources(base, work / 'official-with-hand.xml', work / 'balance-layout.json')
simulation = RF15ContactSimulation(resources)
simulation.reset({'x': -6.1, 'z': -12.43, 'yaw': np.pi})
for frame in range(80):
    simulation.step()
simulation.request_grasp('harvest-knife', 'right')
for frame in range(1500):
    simulation.step()
    if frame % 50 == 0:
        state = simulation.state()
        hand = simulation.hands['right']
        print(json.dumps({'frame': frame, 'base': state['base'], 'balance': state['contactPhysics']['balance'], 'hand': state['contactPhysics']['hands']['right'], 'palm': simulation.data.site_xpos[hand['site']].tolist(), 'target': simulation.grasp_point('harvest-knife').tolist(), 'armTarget': hand['arm_target'].tolist(), 'armActual': simulation.data.qpos[hand['arm_qpos']].tolist()}), flush=True)
