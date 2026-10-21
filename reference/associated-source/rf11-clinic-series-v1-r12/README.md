# Robot Archive / 四足机器人解谜 Demo

一个固定俯视视角的网页端四足机器人解谜 Demo。当前及后续关卡统一使用 Three.js + GLB 在浏览器运行；Godot 项目仅作为历史验证版本保留，不再同步新玩法。

## 运行网页端主版本

```bash
npm install
npm run dev
```

打开终端输出的本地地址，默认是 `http://localhost:4173`。完整的多关卡生产流程见 [`docs/WEB_LEVEL_PRODUCTION_PIPELINE.md`](docs/WEB_LEVEL_PRODUCTION_PIPELINE.md)。

当前仓库包含：

- `RF-01 / Relay Facility`：工业实验室供电与撤离
- `RF-02 / Chromatic Archives`：图书馆三色书籍归位
- `RF-03 / Parcel Sorting Line`：工业流水线三色快递分类
- 保留版本：`legacy/` 中的 `PR-01 / Pulse Relay` 2D 原型
- 无服务器、无登录、无遥测
- 可从 GitHub 克隆后在本地运行

## AI Agent 接入

三个 3D 关卡共用一个视觉 Agent 运行器。Agent 每轮接收固定相机的 RGB 游戏截图、可见 HUD、首次任务说明和动作历史，只能返回 `W`、`A`、`S`、`D`、`E`、`WAIT` 之一。方向动作最多执行 300ms；机器人先朝屏幕方向转正，再开始直行。`WAIT` 等待 300ms，场景动态物体仍继续运动。

复制 `.env.example` 为服务器上的 `.env`，填写支持图片输入的 OpenAI-compatible 模型：

```env
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=your-model-api-key
MODEL_NAME=your-vision-model
```

构建并启动带模型代理的生产服务：

```bash
npm run build
npm run preview
```

网页从 `/api/model/config` 检查模型状态，将截图发送到 `/api/agent/action`。API Key 只由服务器读取，不会发送到浏览器。评测成功或状态余量归零后，动作、状态、用量和结果保存在 `data/recordings/*.json`。评测进行中不能重置，也不设置人为动作数上限。

启动页可以选择关卡，也可以直接打开：

```text
http://localhost:4173/?level=rf01
http://localhost:4173/?level=rf02
http://localhost:4173/?level=rf03
```

## RF-01 关卡流程

1. 探索工业实验设施并找到能源模块。
2. 按 `E` 抓取模块，模块显示在机器人背部载物架。
3. 将模块运送至电源插槽并按 `E` 安装。
4. 设施通电后，在安全门附近按 `E` 打开门。
5. 穿过门，到达发光的撤离区域。

机器人具有“任务余量”进度条。移动会持续消耗余量，首次完成抓取电池、恢复供电和打开安全门会补充余量；归零时关卡失败。奖励只能领取一次，不能通过重复开关门刷取。

维护终端会根据当前状态显示能源模块、电力总线和安全门信息。携带模块时，如果附近没有更优先的互动对象，按 `E` 可将其放在当前地面。

## RF-02 关卡流程

1. 在现代公共图书馆中央归还桌找到红、黑、白三本书。
2. 一次抓取并携带一本书，背部载物架显示当前颜色。
3. 将书送往装有同色藏书的书架；红色在西侧、黑色在北侧、白色在东侧。
4. 放错书架时拒绝归位，不消耗额外任务余量；远离书架按 `E` 可放在任意地面并重新抓取。
5. 每本正确归位补充 18 点任务余量，第三本归位后立即通关并恢复到 100。

RF-02 当前不生成或播放音效，也不显示标签、提示、描边、光圈等视觉强调。可互动线索来自中央桌上的三本书、三个书架内一致的藏书颜色，以及目录终端的状态文本。

## RF-03 关卡流程

1. 靠近持续运行的工业传送带，截取红色 A-01、黄色 B-02、蓝色 C-03 快递。
2. 一次携带一件快递，根据颜色和编号送往对应快递栏。
3. 错误快递栏拒绝接收；快递可以放在地面并重新抓取。
4. 初始状态余量为 100，方向操作每秒消耗 3，每次互动尝试消耗 5，正确投递奖励 15。
5. 三件正确投递后立即通关并将状态余量恢复到 100。

RF-03 已按真实中国快递分拨中心重做为“自动供包机 → DWS 扫码称重 → 摆轮分流 → 滑槽/笼车集包”布局。不可互动厂房与设备使用一个环境 GLB，三件快递、三只路由笼车和 DWS 终端分别使用独立 GLB；加载失败时保留米制程序化回退。未取下的快递会由回流逻辑送回西端供包机。

## 操作

| 按键 | 动作 |
| --- | --- |
| `W` `A` `S` `D` | 相对屏幕方向连续移动 |
| `E` | 与机器人周围最近的对象互动 |
| `R` | 重置关卡 |
| `Esc` | 关闭终端 |

相机使用与关卡坐标轴对齐的固定世界机位：横向墙体正对观察点，纵向墙体沿观察方向延伸；相机不跟随机器人、不旋转、不缩放。机器人会自动朝输入方向平滑转向。场景不显示靠近提示、描边或交互光圈，成功互动通过空间音效反馈。

## 本地 Cardinal 音效

RF-01 当前接入三个由 Cardinal 生成的本地 MP3：抓取电池、放下电池，以及电池插入并恢复设施供电。它们使用 Three.js `PositionalAudio` 从互动发生位置播放，失败互动保持静默。

资源放置在以下目录，该目录已被 Git 忽略：

```text
public/local-assets/cardinal/rf01/audio/
```

需要以下固定文件名：

```text
rf01_battery_pickup.mp3
rf01_battery_drop.mp3
rf01_power_module_insert_and_startup.mp3
```

缺少本地音效不会阻止游戏运行。门和终端将在对应 Cardinal 音效生成后接入。

## Cardinal 写实场景资产

RF-01 依照环境参考图重新搭建为一个拆除屋顶的工业盒景：约 16×13 米的主实验室、约 7×13 米的设备间以及中央滑动安全门。电池机架、终端、地面电源槽、撤离区、设备柜、泵机、管网、灯具、墙板、横梁、地面线槽和英文功能标线都按参考图的空间关系布置。相机采用接近垂直、仅带轻微透视的固定全景视角。

本地参考图固定存放为：

```text
public/local-assets/cardinal/rf01/reference/rf01_environment_concept.png
```

该目录仍受 `.gitignore` 保护，不会随仓库上传。

整张概念图生成的单体环境模型会形成不可拆分的盒景，因此不作为关卡运行时场景。建筑壳体和碰撞继续使用尺寸准确的程序化 3D 几何，Cardinal 用于生成可替换、可复用的独立 GLB 模块。这样既保留固定俯视构图与可靠碰撞，也能逐步提高写实度。

当前十一个运行时 GLB：

```text
public/local-assets/cardinal/rf01/models/runtime/*.glb
```

Cardinal 还生成了两张 1024×1024 写实贴图：

```text
public/local-assets/cardinal/rf01/textures/generated/rf01_concrete_floor.png
public/local-assets/cardinal/rf01/textures/generated/rf01_painted_steel.png
```

网页关卡使用 Three.js `GLTFLoader` 并行加载十一个优化后的 GLB，自动按游戏尺寸校验、居中和落地。门框、门板、电池、插槽与终端分别挂在独立根节点上，因此门板仍能升降，电池仍能从机架抓取、携带和插入。控制柜、货箱、阀组和灯具各只加载一次原型，再在场景内复用实例。任一模型缺失时只回退该类物体的程序化版本。

已有的十一个 Cardinal 原始高模合计约 878 MB，已转换为约 33–36 MB 的网页 GLB。新关卡首先通过 Cardinal REST 明确请求 `outputFormat: "glb"`；平台在 0% 失败时使用图生 FBX 作为本地中间产物，再统一转换为网页 GLB。

```text
public/local-assets/cardinal/rf01/models/runtime/
```

该目录仍然只保存在本机并受 Git 忽略。生成参考图、纹理、任务号、下载状态和断点续传由 `tools/cardinal-rf01-assets.mjs` 管理；脚本读取本机 Cardinal 登录信息，但不会把 token 写入项目。

RF-02 使用 9 个独立 GLB：书架、阅读桌、红/黑/白书、阅读椅、目录终端、还书车和吊灯。生成与优化命令：

```bash
node tools/cardinal-rf02-assets.mjs submit
node tools/cardinal-rf02-assets.mjs status
node tools/cardinal-rf02-assets.mjs produce
node tools/cardinal-rf02-assets.mjs reference-submit
node tools/cardinal-rf02-assets.mjs reference-produce
node tools/prepare-rf02-assets.mjs
```

优先使用 `submit` / `produce` 请求 Cardinal 直接输出 GLB。平台在 0% 返回通用 3D 失败时，改用 `reference-submit` / `reference-produce` 生成产品参考图并串行执行图生高模；当前平台稳定产物为 FBX，再由 `prepare-rf02-assets.mjs` 转换、减面并输出网页 GLB。原始文件保存到 `public/local-assets/cardinal/rf02/models/generated/`，网页优化文件保存到 `public/local-assets/cardinal/rf02/models/runtime/`。两者都仅在本机保存。

RF-02 的 9 个原始高模约 610.67 MB，最终运行时 GLB 共约 29.40 MB。尺寸验证与真实浏览器 `9/9` 加载检查均通过。

## 本地运行

需要 Node.js 20.19+。如果端口被占用，Vite 会自动选择下一个端口。

也可以使用 pnpm：

```bash
pnpm install
pnpm dev
```

## 测试与构建

```bash
npm test
npm run build
npm run preview
```

自动化测试覆盖：

- 连续移动与安全门碰撞
- 抓取、携带及任意地面放下
- 电池插槽、设施通电与门开关
- 终端开关
- 完整通关条件
- RF-02 三色书抓取、地面放下、错误书架拒绝、正确归位与即时通关
- RF-02 所有书籍、书架和目录终端的可达性
- RF-03 动态传送带、全动作状态消耗、三色编号分类与即时通关
- 保留 2D 引擎的确定性、帧格式与回放格式

## 项目结构

```text
native/                       历史 Godot 验证版本，不再同步后续玩法
docs/                         网页关卡生产流程与批量规范
index.html                    3D Demo 界面与 HUD
styles.css                    全屏游戏 UI 和视觉系统
game/level.js                 RF-01 坐标、碰撞体与关卡参数
game/engine.js                纯状态机、移动、碰撞和互动规则
game/audio.js                 Cardinal 本地资源映射与 3D 空间音效
game/robot.js                 程序化四足机器人及动画
game/scene.js                 工业设施、灯光、材质和动态物件
game/app.js                   Three.js 渲染循环、输入、相机与 UI
game/levels/rf01/runtime.js   RF-01 通用运行时适配层
game/levels/rf02/             RF-02 配置、状态机、场景和运行时适配层
legacy/                       完整保留的 2D 原型
tests/                        3D 与 legacy 引擎测试
```

## 替换为写实资产

初版机器人和设施全部使用程序化几何体，没有使用宇树商标或官方模型。后续可在不修改关卡状态机的前提下：

1. 使用 `GLTFLoader` 加载获得授权的 Go2/B2 风格 `.glb` 模型。
2. 在 `game/robot.js` 中把模型动画映射到待机、移动、转向和携带状态。
3. 保持机器人根节点面向本地 `+Z` 方向，并保留背部载物挂点。
4. 将 `game/scene.js` 中的程序化场景逐步替换为 PBR 场景资产。

玩法、碰撞和任务状态都集中在 `game/engine.js`，因此美术替换不会影响关卡规则。

## GitHub Pages

仓库保留了可选的 Pages 工作流。推送至 `main` 后，在仓库设置中选择 **GitHub Actions** 作为 Pages Source，工作流会安装依赖、构建并部署 `dist/`。本地试玩不依赖 Pages。

## License

MIT
