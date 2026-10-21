# RF-15 验收记录

资产版本：`realism-v0.2.6`。当前状态：已部署，RF15 必需验收完成。用户验收：未收到，不冒称已接受。

## 已验证

- 网站模块加载恢复，原 RF01–14 与测试关卡入口保持，RF15 出现在选关列表。
- `node --test tests/rf15-harvest.test.mjs`：5/5 通过。真实运动路线 74.731675 米、19 次互动；无错误终点与最低余量均 33.214660；三个错误路线终点与最低余量均 18.214660。
- 覆盖错误目标、朝向、占用、受阻放置、移动/受阻计费、静止与转向、低余量原子结算、奖励去重/上限、失败与成功冻结、重置、掉落后恢复。
- `npm run build` 成功。已有其他关卡 chunk 大小警告，未更改无关打包策略。
- 10 个 GLB 合计 22,598,384 字节；源运行目录、dist 与公网 GET SHA256 完全一致。验证 GLB v2 文件长度、嵌入图片和实际顶点。
- 13 个结构碰撞节点有 collision extras，导出世界边界与布局逐轴在 5 mm 内一致。正式加载器再次验证碰撞节点/边界。
- 10 个机器人、共享控制/视角/运动文件 SHA256 与恢复后的保护基线一致。app.js 仅三个注册差异。

## 视觉返工

苹果源模型多余上层筐已裁剪；番茄统一长轴；嵌入纹理由每件独立 Blender 进程保留。筐与箱保持真实尺寸，货物握持原点下移 0.25 米以适配统一握持位置，机器人与相机不改。

电子秤导出实测承重面在本地高度约 0.30 米，因此筐底改到世界 1.062 米；电子秤旋转 -90 度使面板朝向操作者，显示覆盖与杆顶对齐。装箱台面 0.84 米，尾板承载面约 0.14 米，车厢地板 1 米。

## 回归限制

共享检查 `tests/operator-console.test.mjs` 与 `tests/shared-movement-controls.test.mjs` 合计 19/22。三项失败分别为既有 RF08 横移、RF08 转向和旧 F 键映射源码字符串断言。未修改这些共享行为；完整日志在生产记录 v0.2/shared-checks.log。按仓库“验证失败不提交”的规则，不创建 Git 提交，也不推送。

人工 3–5 分钟是设计目标，未独立测量。当前验收为 G1；R1 与移动端触控不是本次已验证范围。尾板升降和进厢是任务动画，未模拟真实液压/货物动力学。

## 最终正式浏览器验收

时间：2026-09-14T13:26:07.701558+00:00。正式页面 `http://127.0.0.1:4173/?mode=play&level=rf15&view=third&robot=g1`；验收使用额外 `qa=rf15` 参数加载路线按钮。

最终标签修复后再次走完 8/8 段，错误 0，两箱装车、出库确认成功。浏览器实际路线 75.999 米，终点余量 30.200，最低 30.200；相较引擎测试包含南侧绕行差异。前一轮额外检查秤台重复放取两次，余量 30.2，保留在 browser-route-complete.json，不冒充最终路线。

正式加载 21/21，碰撞和货物门禁均通过，采样 FPS 60。此为当前桌面浏览器采样，非所有设备保证。浏览器控制台最终检查无 error。

第一视角起点、手持筐、秤台支撑、封箱、尾板、控制按钮和第三/双视角均实际查看。第一视角通过正常方向键抬头可见操作区域；未改变共享镜头或机器人。中文牌面与纸箱重量标签用场景贴图消除导出文字网格的缺损。箱子随尾板进入车厢后保留，源工位不残留重复箱筐。

截图、路径、遥测与完整 GLB 顶点审计在 `./authoring/server-production/rf15/v0.2`，具体文件见清单 evidence。最终源代码哈希记录在清单 codeSha256。四项 Cardinal 任务均已完成，其 task ID、源/运行/构建/公网哈希保留在清单。

4173 由既有用户级 `arc-rf08-4173.service` 托管，实际 cwd 是当前项目，服务 active/running，Restart=on-failure。服务历史名称不代表当前关卡入口。

未创建 Git 提交：三项既有共享回归失败触发仓库禁止失败时自动提交的规则。未推送。

## 最终正式浏览器验收

时间：2026-09-15T02:12:50.286807+00:00。正式页面 `http://127.0.0.1:4173/?mode=play&level=rf15&view=third&robot=g1`；验收使用额外 `qa=rf15` 参数加载路线按钮。

最终标签修复后再次走完 8/8 段，错误 0，两箱装车、出库确认成功。浏览器实际路线 75.999 米，终点余量 30.200，最低 30.200；相较引擎测试包含南侧绕行差异。前一轮额外检查秤台重复放取两次，余量 30.2，保留在 browser-route-complete.json，不冒充最终路线。

正式加载 21/21，碰撞和货物门禁均通过，采样 FPS 60。此为当前桌面浏览器采样，非所有设备保证。浏览器控制台最终检查无 error。

第一视角起点、手持筐、秤台支撑、封箱、尾板、控制按钮和第三/双视角均实际查看。第一视角通过正常方向键抬头可见操作区域；未改变共享镜头或机器人。中文牌面与纸箱重量标签用场景贴图消除导出文字网格的缺损。箱子随尾板进入车厢后保留，源工位不残留重复箱筐。

截图、路径、遥测与完整 GLB 顶点审计在 `./authoring/server-production/rf15/v0.2`，具体文件见清单 evidence。最终源代码哈希记录在清单 codeSha256。四项 Cardinal 任务均已完成，其 task ID、源/运行/构建/公网哈希保留在清单。

4173 由既有用户级 `arc-rf08-4173.service` 托管，实际 cwd 是当前项目，服务 active/running，Restart=on-failure。服务历史名称不代表当前关卡入口。

未创建 Git 提交：三项既有共享回归失败触发仓库禁止失败时自动提交的规则。未推送。

## 静态物体第二轮返工

版本升级至 `realism-v0.2.6`。在不改变碰撞和玩法的前提下，静态环境 GLB 增加了墙板接缝和污痕、荧光灯与吊杆、配电箱和管线、洗手消毒台、周转筐边框与标签、托盘脚和缠膜、冷藏车门铰链/锁杆/尾灯、尾板反光条、安全桩、止轮器、消防柜、排水沟和装车区标识。正式第三视角已复核，加载与活动服务正常。

## 方块感返工

版本升级至 `realism-v0.2.6`。对静态环境 GLB 中可倒角的制造件统一加入生产级圆角；冷藏车增加门封条、铰链帽、锁杆、保险杠和尾部硬件；工作台增加管状腿、圆角前沿和紧固件；尾板增加铰链桶、液压缸和橡胶碰撞缓冲；周转筐、屋面排水、装车区安全设施均使用圆柱或倒角构件替代纯方盒。正式第三视角已复核，运行时新 GLB 返回 200，RF-15 专项测试 5/5 通过。

本轮 `npm run build` 受 dist 目录中既有目录删除冲突影响未记为通过；Vite 开发服务继续从 source 提供新版本，source GLB 与 dist 现有版本均可读取。该构建目录问题与静态模型返工无关，未改动共享构建逻辑。

## 材质真实感返工

版本升级至 `realism-v0.2.6`。静态环境材质按用途重新分层：混凝土/沥青加入大尺度色差、粗糙度和细微法线；木材/纸箱加入纤维色差；喷漆金属加入微划痕；镀锌钢加入高金属度和细密噪声；蓝色周转筐加入塑料高光与纹理；橡胶、车厢白漆、玻璃、黄色安全漆和锈蚀件分别使用独立的粗糙度/金属度设置。材质仅作用于可视 GLB，不修改碰撞或玩法。新 GLB 已由正式页面加载，RF-15 专项测试 5/5 通过。

## 2026-09-18 — RF-15-3 basket placement correction

Removed the duplicate floating legacy produce crate visuals from the shared field renderer. Moved the orange shipment basket to the intake table front at (-5.70, 0.82, -3.92), with a collision-safe approach stand at (-5.70, -3.34). The pickup grips now target the near rim; the home approach uses walking to resolve small lateral offsets rather than preserving an unreachable offset.

Verified the live page with the QA empty-basket offset fixture: F performs local walking, pickup and recovery, then reports `action: null`, `lastResult: orange-pickup` and shipment `location: carried`. First-person screenshots confirm the basket is removed from the tabletop and the old floating crate group is gone. This is an interaction fixture check, not a spawn-to-station navigation check.

The six RF-15 test files passed 26/26; production build passed (existing large-bundle warning). The broader existing official-model animation probe passed pickup but failed at the subsequent `orange-place-scale` reach timeout. That downstream scale animation remains unresolved; no full-route acceptance or Git commit is claimed. Working changes remain in field-scene.js, orange-task.js and the pre-existing untracked orange-animation.js. Build/test/probe logs are outside the repository under the authorized production directory.
