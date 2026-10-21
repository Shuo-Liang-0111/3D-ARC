exec(open('./authoring/server-production/rf15-contact-v1/balance-bench-probe.py').read().split('simulation =')[0])
simulation = RF15ContactSimulation(resources)
simulation.reset({'x': -6.1, 'z': -12.43, 'yaw': np.pi})
for frame in range(80):
    simulation.step()
hand = simulation.hands['right']
trial = simulation.ik_data
trial.qpos[:] = simulation.data.qpos
for shoulder in (1.2, .8, .5, 0, -.5, -1.3):
    for wrist in (-1.5, 0, 1.5):
        trial.qpos[hand['arm_qpos']] = [shoulder, -.15, 0, -1.047, 0, wrist, 0]
        mujoco.mj_forward(resources.model, trial)
        conflicts = []
        for contact in trial.contact:
            geom_names = [resources.model.geom(geom).name for geom in (contact.geom1, contact.geom2)]
            if 'rf15-tool-bench' in geom_names and any('right_' in resources.model.body(resources.model.geom_bodyid[geom]).name for geom in (contact.geom1, contact.geom2)):
                conflicts.append([resources.model.body(resources.model.geom_bodyid[geom]).name for geom in (contact.geom1, contact.geom2)])
        print(shoulder, wrist, trial.site_xpos[hand['site']].round(3).tolist(), conflicts, flush=True)
