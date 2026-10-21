from pathlib import Path
import json
import subprocess

root = Path('.')
definition = subprocess.check_output(['node', '--input-type=module', '-e', "import {STRUCTURES,REVISION} from './game/levels/rf15/level.js'; console.log(JSON.stringify({level:'rf15',revision:REVISION,walls:STRUCTURES.filter(item=>['west-wall','north-wall'].includes(item.id))}))"], cwd=root, text=True)
directory = root / 'simulation/levels'
directory.mkdir(exist_ok=True)
(directory / 'rf15.json').write_text(json.dumps(json.loads(definition), indent=2) + '\n')
patches = {
    'simulation/mujoco_server.py': [
        ('from g1_simulation import (', 'from level_environment import LevelEnvironments\n\nfrom g1_simulation import ('),
        ('        self.resources = resources\n        self.max_sessions', '        self.resources = resources\n        self.environments = LevelEnvironments(resources)\n        self.max_sessions'),
        ('                try:\n                    simulation.set_command(', '                try:\n                    if "level" in message:\n                        self.environments.apply(simulation, message["level"])\n                    simulation.set_command('),
        ('            elif message_type == "reset":\n                simulation.reset', '            elif message_type == "reset":\n                if "level" in message:\n                    self.environments.apply(simulation, message["level"])\n                simulation.reset'),
    ],
    'game/mujoco-client.js': [
        ('  reset(spawn) { this.send({ type: "reset", spawn }); }', '  reset(spawn) { this.send({ type: "reset", spawn, level: new URLSearchParams(location.search).get("level") }); }'),
    ],
}
for relative, replacements in patches.items():
    path = root / relative
    content = path.read_text()
    for previous, replacement in replacements:
        assert content.count(previous) == 1, (relative, previous)
        content = content.replace(previous, replacement)
    path.write_text(content)
print('RF-15 static walls registered for MuJoCo level selection')
