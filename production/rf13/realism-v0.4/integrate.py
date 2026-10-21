from pathlib import Path
import difflib
import subprocess
import sys

changes = {
    'game/levels/rf13/level.js': [
        ('export const REVISION = "cardinal-v0.3";', 'import { CLINIC_FURNISHINGS } from "./furnishings.js";\n\nexport const REVISION = "realism-v0.4";'),
        ('export const LEVEL = Object.freeze({', 'STATIC_BOXES.push(...CLINIC_FURNISHINGS);\nexport const LEVEL = Object.freeze({'),
    ],
    'game/levels/rf13/runtime.js': [
        ('RF-13 · 真实化 v0.3', 'RF-13 · 真实化 v0.4'),
        ('export function createScene() { return createClinicScene(); }', 'export function createScene(renderer) { return createClinicScene(renderer); }'),
    ],
    'game/levels/rf13/preview.js': [
        ('import { walkRoute }', 'import { REVISION } from "./level.js";\nimport { walkRoute }'),
        ('const world = createClinicScene();\nconst cargo = createClinicCargoModel();', 'const revision = new URLSearchParams(location.search).get("revision") || REVISION;\nconst world = createClinicScene(renderer, revision);\nconst cargo = createClinicCargoModel(revision);'),
        ('Required graybox asset failed', 'Required clinic asset failed'),
        ('灰模已加载 · 拖动旋转，滚轮缩放', '诊所已加载 · 拖动旋转，滚轮缩放'),
        ('window.addEventListener("resize", resize);', 'for (const [id, position, target] of [\n  ["entry", [0, 1.6, 4.3], [0, 1.45, -2]],\n  ["exam", [-2.65, 1.65, -1.55], [-0.6, 1.0, -3.0]],\n  ["treatment", [4.6, 1.65, -1.5], [6.25, 1.3, -3.7]],\n  ["waiting", [-2.1, 1.65, 2.7], [-6.4, 1.25, 2.6]],\n]) {\n  document.querySelector(`#${id}`).onclick = () => { camera.position.set(...position); orbit.target.set(...target); orbit.update(); render(); };\n}\nwindow.addEventListener("resize", resize);'),
    ],
    'game/levels/rf13/asset-review.js': [
        ('import * as THREE from "three";', 'import * as THREE from "three";\nimport { REVISION } from "./level.js";'),
        ('const asset=await loader.loadAsync("/local-assets/levels/rf13/cardinal-v0.2/models/runtime/"+name+".glb");', 'const revision = new URLSearchParams(location.search).get("revision") || REVISION;\n if (!/^[a-z0-9.-]+$/.test(revision)) throw new Error("Invalid asset revision");\n const asset=await loader.loadAsync(`/local-assets/levels/rf13/${revision}/${name}.glb`);'),
        ('model=asset.scene;scene.add(model);', 'model=asset.scene;scene.add(model);\n const bounds = new THREE.Box3().setFromObject(model);\n const center = bounds.getCenter(new THREE.Vector3());\n const size = bounds.getSize(new THREE.Vector3());\n const extent = Math.max(size.x, size.y, size.z);\n controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(extent * 1.3, extent * 0.8, extent * 1.5)); controls.update();'),
    ],
    'rf13-assets.html': [
        ('<option>opening-terminal</option>', '<option>opening-terminal</option><option>clinical-basin</option><option>diagnostic-panel</option><option>trolley</option><option>chair</option>'),
    ],
    'rf13-preview.html': [
        ('RF-13 社区诊所 · 灰模 v0.2 审核', 'RF-13 社区诊所 · 真实化检查'),
        ('RF-13 社区诊所 · 灰模审核 v0.2', 'RF-13 社区诊所 · 真实化检查'),
        ('<button id="top">俯视平面</button>', '<button id="top">俯视平面</button><button id="entry">入口</button><button id="exam">诊室</button><button id="treatment">处置室</button><button id="waiting">候诊区</button>'),
        ('正在加载灰模与机器人…', '正在加载正式资产与机器人…'),
        ('灰模不代表最终材质。', '与正式关卡共用资产、材质与照明；顶面从外部剖视。'),
        ('header{height:100px;', 'header{height:112px;'),
        ('calc(100vh - 152px)', 'calc(100vh - 164px)'),
    ],
    'tests/rf13-clinic.test.mjs': [
        ('PREPARATIONS, STATIC_BOXES }', 'PREPARATIONS, STATIC_BOXES, REVISION }'),
        ('const root = "public/local-assets/levels/rf13/graybox-v0.2/";', 'const root = `public/local-assets/levels/rf13/${REVISION}/`;'),
    ],
    'vite.config.js': [
        ('  "levels/rf13",', '  "levels/rf13/realism-v0.4",'),
        ('        const kitTarget = resolve("dist/agent-kit");', '        cpSync(resolve("public/vendor/draco"), resolve("dist/vendor/draco"), { recursive: true });\n        const kitTarget = resolve("dist/agent-kit");'),
    ],
}
asset_files = {'game/levels/rf13/asset-review.js', 'rf13-assets.html'}
changes = {name: replacements for name, replacements in changes.items() if (name in asset_files) == ('--assets-only' in sys.argv)}
patch = ''
for name, replacements in changes.items():
    original = Path(name).read_text()
    updated = original
    for before, after in replacements:
        if updated.count(before) != 1:
            raise RuntimeError('Expected unique integration anchor: ' + name + ': ' + before)
        updated = updated.replace(before, after)
    patch += ''.join(difflib.unified_diff(original.splitlines(True), updated.splitlines(True), fromfile='a/' + name, tofile='b/' + name))
subprocess.run(['git', 'apply', '--check', '-'], input=patch, text=True, check=True)
subprocess.run(['git', 'apply', '-'], input=patch, text=True, check=True)
print('Integrated RF13 v0.4 sources')
