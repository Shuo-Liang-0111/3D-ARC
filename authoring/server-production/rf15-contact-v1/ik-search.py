exec(open('./authoring/server-production/rf15-contact-v1/balance-probe.py').read().split('simulation =')[0])
import numpy as np
import mujoco
from scipy.optimize import least_squares

for depth in (-12.3, -12.4, -12.45):
    simulation = RF15ContactSimulation(resources)
    simulation.reset({'x': -6.1, 'z': depth, 'yaw': np.pi})
    for frame in range(80):
        simulation.step()
    hand = simulation.hands['right']
    trial = simulation.ik_data
    trial.qpos[:] = simulation.data.qpos
    target = np.array([depth - .32, -5.9, 1.05])
    orientation = np.array([[-1, 0, 0], [0, 0, -1], [0, -1, 0]])
    def residual(angles):
        trial.qpos[hand['arm_qpos']] = angles
        mujoco.mj_kinematics(resources.model, trial)
        current = trial.site_xmat[hand['site']].reshape(3,3)
        return np.r_[trial.site_xpos[hand['site']] - target, (current - orientation).ravel() * .2]
    best = None
    random = np.random.default_rng(44)
    for index in range(12):
        seed = np.clip(random.uniform(hand['limits'][:,0], hand['limits'][:,1]), hand['limits'][:,0] + .001, hand['limits'][:,1] - .001)
        result = least_squares(residual, seed, bounds=(hand['limits'][:,0], hand['limits'][:,1]), max_nfev=150)
        if best is None or np.linalg.norm(result.fun) < np.linalg.norm(best.fun):
            best = result
    print(json.dumps({'depth':depth, 'error':float(np.linalg.norm(best.fun)), 'angles':best.x.tolist(), 'target':target.tolist(), 'residual':best.fun.tolist()}),flush=True)
