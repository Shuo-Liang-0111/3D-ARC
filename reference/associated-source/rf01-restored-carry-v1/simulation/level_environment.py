from __future__ import annotations

import copy
import json
from pathlib import Path

import mujoco
import numpy as np


class LevelEnvironments:
    def __init__(self, resources):
        self.base = resources
        self.resources = {None: resources}
        self.directory = Path(__file__).parent / 'levels'
        self.resources['rf15'] = self._load('rf15')

    def _load(self, level):
        definition = json.loads((self.directory / f'{level}.json').read_text())
        specification = mujoco.MjSpec.from_file(str(self.base.paths.model))
        for collider in definition['walls']:
            horizontal, height, depth = collider['position']
            width, tall, length = collider['size']
            specification.worldbody.add_geom(
                name=f"level_{level}_{collider['id']}",
                type=mujoco.mjtGeom.mjGEOM_BOX,
                pos=[depth, horizontal, height],
                size=[length / 2, width / 2, tall / 2],
                contype=1,
                conaffinity=1,
            )
        resources = copy.copy(self.base)
        resources.model = specification.compile()
        for attribute in ('nq', 'nv', 'nu', 'njnt', 'nbody'):
            if getattr(resources.model, attribute) != getattr(self.base.model, attribute):
                raise ValueError(f'Level scene changed robot {attribute}')
        return resources

    def apply(self, simulation, level):
        selected = level if isinstance(level, str) and level in self.resources else None
        target = self.resources[selected]
        if simulation.resources is target:
            return
        state_type = mujoco.mjtState.mjSTATE_INTEGRATION
        state = np.empty(mujoco.mj_stateSize(simulation.resources.model, state_type))
        mujoco.mj_getState(simulation.resources.model, simulation.data, state, state_type)
        data = mujoco.MjData(target.model)
        if mujoco.mj_stateSize(target.model, state_type) != len(state):
            raise ValueError('Level scene changed simulation state size')
        mujoco.mj_setState(target.model, data, state, state_type)
        mujoco.mj_forward(target.model, data)
        simulation.resources = target
        simulation.data = data
