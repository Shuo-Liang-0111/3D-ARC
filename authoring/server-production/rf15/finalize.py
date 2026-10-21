from pathlib import Path
import hashlib
import json
import shutil
from datetime import datetime, timezone

root = Path('.')
production = Path('./authoring/server-production/rf15/v0.2')
evidence = production / 'evidence'
route = json.loads((evidence / 'final-route.json').read_text())
assert len(route) == 8 and route[-1]['complete'] and route[-1]['errors'] == 0
telemetry = json.loads((evidence / 'final-telemetry.json').read_text())
assert telemetry['requiredAssetsReady'] == 'true'
assert telemetry['worldAssetErrors'] == '[]'
assert telemetry['collisionProxyLoaded'] == 'true'
assert telemetry['levelRevision'] == 'realism-v0.2.2'
manifest_path = root / 'docs/levels/rf15-asset-manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['status'] = 'completed'
manifest['completedAt'] = datetime.now(timezone.utc).isoformat()
manifest['internalGates'] = {'gameplay': 'passed', 'collision': 'passed', 'assets': 'passed', 'formalVisuals': 'passed', 'build': 'passed', 'protectedFiles': 'passed', 'broaderRegression': '19/22: three preexisting failures; no commit'}
manifest['evidence'] = {'directory': str(evidence), 'route': 'final-route.json', 'telemetry': 'final-telemetry.json', 'screenshots': ['final-first.png', 'final-third.png', 'final-packed.png', 'final-tail.png', 'final-complete.png', 'final-dual.png']}
manifest['codeSha256'] = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest() for path in (root / 'game/levels/rf15').glob('*.js')}
manifest_path.write_text(json.dumps(manifest, indent=2))
for directory in ['public', 'dist']:
    shutil.copyfile(manifest_path, root / directory / 'local-assets/levels/rf15/realism-v0.2.2/manifest.json')
report_path = root / 'docs/levels/rf15-acceptance-report.md'
report = report_path.read_text().replace('当前状态：最终视觉复验进行中。', '当前状态：已部署，RF15 必需验收完成。')
report += f'''
## 最终正式浏览器验收

时间：{manifest['completedAt']}。正式页面 `http://127.0.0.1:4173/?mode=play&level=rf15&view=third&robot=g1`；验收使用额外 `qa=rf15` 参数加载路线按钮。

最终标签修复后再次走完 8/8 段，错误 {route[-1]['errors']}，两箱装车、出库确认成功。浏览器实际路线 {route[-1]['meters']:.3f} 米，终点余量 {route[-1]['reserve']:.3f}，最低 {route[-1]['minimum']:.3f}；相较引擎测试包含南侧绕行差异。前一轮额外检查秤台重复放取两次，余量 30.2，保留在 browser-route-complete.json，不冒充最终路线。

正式加载 {telemetry['worldAssetsLoaded']}/{telemetry['worldAssetsTotal']}，碰撞和货物门禁均通过，采样 FPS {telemetry.get('rf15Fps', 'unavailable')}。此为当前桌面浏览器采样，非所有设备保证。浏览器控制台最终检查无 error。

第一视角起点、手持筐、秤台支撑、封箱、尾板、控制按钮和第三/双视角均实际查看。第一视角通过正常方向键抬头可见操作区域；未改变共享镜头或机器人。中文牌面与纸箱重量标签用场景贴图消除导出文字网格的缺损。箱子随尾板进入车厢后保留，源工位不残留重复箱筐。

截图、路径、遥测与完整 GLB 顶点审计在 `{production}`，具体文件见清单 evidence。最终源代码哈希记录在清单 codeSha256。四项 Cardinal 任务均已完成，其 task ID、源/运行/构建/公网哈希保留在清单。

4173 由既有用户级 `arc-rf08-4173.service` 托管，实际 cwd 是当前项目，服务 active/running，Restart=on-failure。服务历史名称不代表当前关卡入口。

未创建 Git 提交：三项既有共享回归失败触发仓库禁止失败时自动提交的规则。未推送。
'''
report_path.write_text(report)
print(json.dumps({'status': 'completed', 'finalReserve': route[-1]['reserve'], 'errors': route[-1]['errors'], 'loaded': route[-1]['loaded']}))
