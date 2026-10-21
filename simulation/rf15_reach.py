import mujoco
import numpy as np
from scipy.optimize import least_squares


def plan_reach(simulation, side, target, orientation):
    model = simulation.resources.model
    hand = simulation.hands[side]
    trial = mujoco.MjData(model)
    trial.qpos[:] = simulation.data.qpos
    trial.mocap_pos[:] = simulation.data.mocap_pos
    trial.mocap_quat[:] = simulation.data.mocap_quat
    limits = hand['limits']
    random = np.random.default_rng(15)
    arm_bodies = set()
    for body in range(model.nbody):
        current = body
        while current:
            if model.body(current).name == side + '_shoulder_pitch_link':
                arm_bodies.add(body)
                break
            current = model.body_parentid[current]

    def collision_free(angles):
        trial.qpos[hand['arm_qpos']] = angles
        mujoco.mj_forward(model, trial)
        for contact in trial.contact:
            bodies = {int(model.geom_bodyid[contact.geom1]), int(model.geom_bodyid[contact.geom2])}
            if bodies.intersection(arm_bodies) and contact.dist < -.001:
                return False
        return True

    def residual(angles):
        trial.qpos[hand['arm_qpos']] = angles
        mujoco.mj_kinematics(model, trial)
        current = trial.site_xmat[hand['site']].reshape(3, 3)
        return np.r_[trial.site_xpos[hand['site']] - target, (current - orientation).ravel() * .2]

    start = simulation.data.qpos[hand['arm_qpos']].copy()
    if not collision_free(start):
        raise ValueError('Current arm is in collision; move away from the obstruction')
    goal = None
    for attempt in range(24):
        seed = start if attempt == 0 else random.uniform(limits[:, 0], limits[:, 1])
        solution = least_squares(residual, np.clip(seed, limits[:, 0] + .001, limits[:, 1] - .001), bounds=(limits[:, 0] + .0001, limits[:, 1] - .0001), max_nfev=120)
        if np.linalg.norm(solution.fun) < .012 and collision_free(solution.x):
            goal = solution.x
            break
    if goal is None:
        raise ValueError('No collision-free grasp approach within joint limits')

    def edge_free(first, second):
        steps = max(1, int(np.ceil(np.max(np.abs(second - first)) / .08)))
        return all(collision_free(first + (second - first) * fraction) for fraction in np.linspace(0, 1, steps + 1))

    if edge_free(start, goal):
        return [goal]
    trees = [([start], [-1]), ([goal], [-1])]

    def extend(tree, target):
        nodes, parents = tree
        nearest = int(np.argmin([np.linalg.norm(node - target) for node in nodes]))
        difference = target - nodes[nearest]
        distance = np.linalg.norm(difference)
        candidate = nodes[nearest] + difference * min(1, .3 / max(distance, 1e-9))
        if not edge_free(nodes[nearest], candidate):
            return None
        nodes.append(candidate)
        parents.append(nearest)
        return len(nodes) - 1

    def trace(tree, index):
        path = []
        while index >= 0:
            path.append(tree[0][index])
            index = tree[1][index]
        return path[::-1]

    for attempt in range(1200):
        first = attempt % 2
        second = 1 - first
        target_sample = random.uniform(limits[:, 0], limits[:, 1])
        index = extend(trees[first], target_sample)
        if index is None:
            continue
        target_sample = trees[first][0][index]
        for advance in range(40):
            other_index = extend(trees[second], target_sample)
            if other_index is None:
                break
            if np.linalg.norm(trees[second][0][other_index] - target_sample) < 1e-8:
                paths = [trace(trees[first], index), trace(trees[second], other_index)]
                route = paths[0] + paths[1][::-1] if first == 0 else paths[1] + paths[0][::-1]
                for smoothing in range(60):
                    if len(route) < 3:
                        break
                    earlier, later = sorted(random.choice(len(route), 2, replace=False))
                    if later > earlier + 1 and edge_free(route[earlier], route[later]):
                        route = route[:earlier + 1] + route[later:]
                return route[1:]
    raise ValueError('No safe arm route found; change standing position')
