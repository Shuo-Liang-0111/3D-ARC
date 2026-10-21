import json
import mujoco
import numpy as np
from g1_simulation import G1Resources, G1Simulation
from test_g1_simulation import runtime_paths
from rf15_balance import StandingBalance

simulation = G1Simulation(G1Resources(runtime_paths()))
for frame in range(100):
    simulation.step()
balance = StandingBalance(simulation.resources, simulation.data)
height = balance.com_target[2]
for frame in range(8000):
    drop = min(.35, frame * .00006)
    balance.com_target[2] = height - drop
    knee = 2 * np.arccos(np.clip(.97 - drop / .65, .2, 1))
    for side in ('left', 'right'):
        for name, angle in (('hip_pitch', -knee / 2), ('knee', knee), ('ankle_pitch', -knee / 2)):
            simulation.target_joint_pos[simulation.resources.joint_names.index(side + '_' + name + '_joint')] = angle
    simulation.data.ctrl[:] = balance.update(simulation.data, simulation.target_joint_pos)
    mujoco.mj_step(simulation.resources.model, simulation.data)
    if frame % 800 == 0:
        print(json.dumps({'frame':frame,'pelvis':simulation.data.qpos[:3].tolist(),'com':simulation.data.subtree_com[1].tolist(),'upright':float(simulation.data.xmat[1].reshape(3,3)[2,2]),'status':balance.status}),flush=True)
