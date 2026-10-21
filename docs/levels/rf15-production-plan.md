# RF-15 生产方案与部署

- 用户指定服务器 `127.0.0.1`，账号 `chenhaoyuan`，授权根 `/path/to/arc-workspace`。
- 权威项目 `.`；运行环境 `/opt/arc-runtime`；生产记录 `./authoring/server-production/rf15`。
- 当前网站由项目内 Vite 在 4173 端口提供；构建产物在项目 `dist`。关卡入口 `/?mode=play&level=rf15&view=third&robot=g1`。
- 用户已选定两种农产品、各一箱、厢式冷藏车和尾板、正常难度。范围内 Cardinal 生产及部署已授权，不重复请求。
- 共享入口只增加 RF15 关卡注册、导入与目标；选关页面及构建复制清单只增 RF15。
- 必需 GLB、货物、碰撞和机器人全部加载后才开放开始按钮。无灰模回退。
- 正常流程 19 次必要互动。移动每米消耗 0.8，受阻每秒 1.8，合法互动 1，错误互动 5，首次称重/封箱/尾板节点奖励 2，上限 100。
- 原点、支撑面、碰撞代理来自同一布局；动态货物独立于场景。尾板操作区始终不可步入，升降中货物无法拾走。
- 自动验收入口额外带 `qa=rf15`，按钮调用正式 Agent 动作与正常键盘输入，不传送或改写任务状态。

## 恢复记录

网站故障是错误的旧入口覆盖了服务器现行入口，导致模块加载失败及关卡注册缺失。已将入口恢复到服务器 Git 基线，再仅添加三处 RF15 注册。覆盖前文件保存在生产根 `recovery-20260914/app.overwritten.js`。未用 Mac 旧检出覆盖其他共享文件。

## 资产复现

`tools/rf15/build-assets.py` 参数：项目根、含 source/ 和 layout.json 的生产目录、新资产版本、中文字体文件。通过 Blender `-b --python ... -- 参数` 执行。

`tools/rf15/normalize-prop.py` 参数：道具名、生产目录、新版本输出目录。每件道具必须在独立 Blender 进程执行，以保留嵌入纹理。四件道具为 tomato-crate、apple-crate、platform-scale、pallet-jack。苹果移除源模型高度 49% 以上多余堆筐，番茄长轴旋转 90 度；保持等比缩放。

将 RF14 树木资产复制到候选目录。`tools/rf15/audit-assets.py` 参数：项目根、版本、全新审计 JSON 路径。审核后再更新 level.js 的 REVISION 及 vite.config.js 的版本白名单。禁止覆盖活动 GLB 试错。

生成源、高模、GLB、日志、证据与运行环境留在服务器，不进入 Git。项目内清单、生产脚本、关卡代码与测试可独立审查。
