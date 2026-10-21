exec(open('./authoring/server-production/rf15-contact-v1/balance-bench-probe.py').read().split('simulation =')[0])
from rf15_reach import plan_reach
from rf15_balance import StandingBalance
from g1_simulation import CONTROL_MODE_JOINT_POSITION
import time
simulation = RF15ContactSimulation(resources)
simulation.reset({'x': -6.1, 'z': -12.43, 'yaw': np.pi})
for frame in range(80):
    simulation.step()
hand = simulation.hands['right']
orientation = simulation.data.xmat[1].reshape(3,3) @ np.array([[1,0,0],[0,0,1],[0,-1,0]])
started = time.monotonic()
route = plan_reach(simulation, 'right', simulation.grasp_point('harvest-knife') + np.array([0,0,.13]), orientation)
print('planned', time.monotonic()-started, [angles.tolist() for angles in route], flush=True)
simulation.set_control_mode(CONTROL_MODE_JOINT_POSITION)
simulation.balance = StandingBalance(resources, simulation.data)
hand.update(target='harvest-knife', phase='planned', arm_target=route.pop(0), motor_target=simulation.data.qpos[hand['arm_qpos']].copy(), orientation=orientation)
for frame in range(2000):
    if frame == 1600:
        simulation.set_grip('right', .9, False)
    if hand['phase'] == 'planned' and np.max(np.abs(hand['arm_target']-simulation.data.qpos[hand['arm_qpos']])) < .15:
        if route:
            hand['arm_target'] = route.pop(0)
        else:
            hand.update(phase='reach',elapsed=0)
    simulation.step()
    if frame % 50 == 0:
        print(json.dumps({'frame':frame, 'base': simulation.data.qpos[:3].tolist(), 'phase':hand['phase'],'held':hand['held'],'contacts':hand['contacts'],'route':len(route),'com':simulation.balance.com_error,'palm':simulation.data.site_xpos[hand['site']].tolist(), 'object':simulation.grasp_point('harvest-knife').tolist(), 'error':float(np.max(np.abs(hand['arm_target']-simulation.data.qpos[hand['arm_qpos']])))}),flush=True)
