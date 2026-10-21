from test_rf15_contact import hand_fixture
import mujoco
import numpy as np
import json
model = hand_fixture()
item = model.body('item').id
model.body_mass[item] = .22
model.body_inertia[item] *= .22 / .12
joints = [model.joint(model.actuator(index).name).id for index in range(model.nu)]
positions = model.jnt_qposadr[joints]
velocities = model.jnt_dofadr[joints]
item_address = model.joint('item-free').qposadr[0]
for lateral in (.025, .04, .055):
    for forward in (.12, .14, .16):
        data = mujoco.MjData(model)
        data.qpos[item_address:item_address + 3] = [forward, lateral, .8]
        targets = np.array([0, -.6, -.8, .6, .8, .6, .8])
        model.opt.gravity[:] = 0
        for frame in range(1800):
            data.ctrl[:] = np.clip(8 * (targets * min(1, frame / 250) - data.qpos[positions]) - .15 * data.qvel[velocities], -1.26, 1.26)
            if frame == 500:
                model.opt.gravity[:] = [0, 9.81, 0]
            mujoco.mj_step(model, data)
        print(json.dumps({'forward':forward,'lateral':lateral,'final':data.qpos[item_address:item_address + 3].tolist()}),flush=True)
