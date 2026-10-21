# 网页 3D 关卡批量生产唯一标准

> 本文是 `.` 后续网页关卡设计、生成、接入、测试和提交的唯一入口。开始新关卡前只需要阅读本文；其他历史流程、关卡复盘和实现说明只能作为案例，冲突时一律以本文和当前源码为准。

本文描述的是主题无关的 RF-XX 生产合同。家庭、酒店、仓库、实验室、办公室等场景只能替换关卡内容，不能复制或改变 G1 控制、视角、HUD、Agent、运行时接口和质量门。

## 1. 不可覆盖的产品合同

### 1.1 权威工作区与安全

- 所有编辑、生成、依赖下载、测试、构建、浏览器服务和 Git 操作都在 `.` 执行。
- 保留服务器工作区中与当前任务无关的修改；禁止 reset、restore、覆盖或提交用户的其他工作。
- 不提交 `.env`、API key、令牌、密码、Conda 环境、缓存、构建产物、备份、生成中间文件或进程日志。
- 完成变更后运行适当测试和构建；全部通过才暂存本任务文件并创建一个简洁提交，不自动推送。

### 1.2 唯一机器人与共享控制

所有关卡使用同一个官方 Unitree G1 EDU2 29DOF + Dex1 机器人、同一个输入模块、同一个动作动画模块和同一个 D435 第一视角。关卡不得生成或实例化自己的机器人控制器。

固定人工操作：

| 输入 | 行为 |
| --- | --- |
| `W` | 沿机器人当前朝向前进 |
| `S` | 沿机器人当前朝向后退 |
| `A` | 原地向左转 |
| `D` | 原地向右转 |
| `↑` / `↓` | 持续调整头部 D435 观察角度 |
| `E` | 与机器人附近最近的合法对象互动，不检查朝向 |
| `R` | 非评测状态下重置关卡 |
| `Esc` | 关闭已打开的终端 |

移动语义是机器人本体坐标，不是屏幕坐标。任何文档、提示词或 Agent 提示不得再写成“WASD 对应屏幕上下左右”。

统一运动参数的唯一来源是：

```js
// game/g1-locomotion.js
export const G1_LOCOMOTION = Object.freeze({
  moveSpeed: 1.4,
  turnSpeed: 1.8,
});
```

每个 `level.js` 必须导入并展开共享配置：

```js
import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const LEVEL = Object.freeze({
  // 本关坐标和规则
  ...G1_LOCOMOTION,
});
```

禁止在任何关卡写 `moveSpeed: <数字>` 或 `turnSpeed: <数字>`。如需重新校准机器人，必须只修改 `game/g1-locomotion.js`，运行所有关卡测试，并记录这是全局产品变更。

### 1.3 固定视角合同

全局视角模式由 `game/view-mode.js` 管理：

```text
first  第一视角
third  第三视角（默认）
dual   第一与第三同步双视角
```

固定规则：

- 三种模式共享同一个状态机、机器人和世界；切换视角不重置关卡、余量、任务进度或动作日志。
- 第三视角由每关 `runtime.js` 提供固定 `position`、`lookAt` 和 `fov`，玩家不能旋转或缩放。
- 第一视角只能使用官方 G1 头部 D435 深度相机的世界姿态、视场和宽高比；禁止关卡自定义眼高或创建假第一人称相机。
- 双视角横屏左右等分、竖屏上下等分；D435 画面按传感器宽高比适配，不能拉伸。
- 第一视角渲染时隐藏会自遮挡的头部表面，但保留真实身体和 Dex1 双手。
- 每关出生位置和朝向必须让第一视角首屏不贴墙、不埋入家具、不被近距离桌面或柜体完全遮挡。

### 1.4 HUD 与界面合同

关卡复用 `index.html`、`styles.css` 和 `game/app.js` 的同一套 DOM HUD，不为单关创建独立页面或另一套界面。

常驻信息：

- 顶部身份、任务余量和系统状态。
- 左侧一个当前目标区域。
- 右下三行遥测：机器人状态、携带物、关卡阶段。
- AI Agent 控制台和动作日志。
- 左下控制提示。

界面约束：

- 正常游玩时中心和下方中部必须保持清空，不新增常驻大面板。
- 任务目标使用一句稳定的最终目标；阶段细节通过终端、遥测和互动反馈表达。
- 长说明只能放在启动卡、终端或完成/失败覆盖层。
- 新关卡只能通过 `runtime.ui`、`getTelemetry()`、`getTerminal()` 和 `eventMessages` 填充现有槽位。
- 失败时冻结移动、互动和终端；完成时余量恢复到 100 并显示完成覆盖层。
- HUD 的结构化 Agent 转录必须与同一帧人类可见文字等价，不能包含隐藏坐标或状态真值。

### 1.5 Agent 动作合同

模型可返回的语义动作固定为：

```text
W A S D E WAIT
```

每个方向动作最多执行 `300 ms`，`E` 执行一次互动，`WAIT` 等待 `300 ms`。一轮只允许一个动作，动作后截图再推理。浏览器执行器使用语义动作 `W/A/S/D/E/WAIT`；评测 observation 继续公布共享的 `ACTION1` 至 `ACTION5` 与 `WAIT` ID。ID 与语义动作的映射属于全局 Agent 服务合同，关卡不得自行增加、删除或改变动作含义。

`server/model-client.mjs` 的系统提示必须与当前控制一致：`W/S` 前后移动、`A/D` 原地转向。若共享提示仍出现“屏幕上下左右”之类的历史表述，必须先全局修正并运行 `tests/model-client.test.mjs`；禁止在单关文案里补丁式解释。

Agent 只能获得：

- 当前第一、第三或双视角截图。
- 同一帧人类可见的最终目标、任务余量、携带状态、系统状态、阶段状态和结果。
- 最近动作历史与可见互动反馈。

Agent 不得获得：

- 玩家、物品和目标的世界坐标。
- 碰撞矩形、导航网格、路径点或距离查询结果。
- 未显示的状态机字段、正确答案、最近对象 ID 或建议动作。
- 额外自由相机、透视墙体或人类没有的观察。

## 2. 每关只允许变化的内容

新关卡只负责定义：

- 场景主题、功能区、真实尺寸、光照与材质方向。
- 一个主要新玩法概念和清晰任务链。
- 玩家出生位置与朝向、交互半径、碰撞半径。
- 任务对象、交互点、状态机、奖惩、失败与完成条件。
- 固定第三视角构图。
- HUD 文案、遥测语义、终端内容和互动消息。
- 程序化灰盒、独立视觉资产与场景同步。
- 本关自动化测试和 `docs/levels/rfXX.md`。

新关卡不得改变：

- G1 模型、加载、移动、转向、D435、视角模式或输入键。
- `game/g1-locomotion.js` 的参数，除非用户明确要求全局校准。
- 全局 HUD 结构、Agent 动作集合、300 ms 动作时长或评测记录格式。
- GLB 坐标标准：米制、Y 轴向上、运行时只加载 GLB。
- “逻辑/碰撞在代码，生成模型只负责视觉”的架构边界。

每关只引入一个主要新概念。移动、转向、携带、放下、终端、失败和视角不是新玩法；它们是共享基础能力。

## 3. 关卡编号与批量规划

批量生成前先检查：

```bash
cd .
find game/levels -maxdepth 1 -type d -name 'rf*' | sort
grep -n 'runtimeLoaders\|FINAL_OBJECTIVES' game/app.js
grep -n 'data-level-option' index.html
```

使用下一个未占用的两位编号 `rfXX`。批量任务先为每关创建独立简报，冻结任务链后再并行生成资产；不得让多个关卡共享写入目录、日志、manifest 或临时文件。

### 3.1 关卡简报模板

每关先创建 `docs/levels/rfXX.md`：

```yaml
id: rfXX
title: English Runtime Title
theme: 写实场所类型与视觉基调
space:
  - 功能区 A
  - 功能区 B
  - 功能区 C
primary_concept: 本关唯一主要新概念
task_chain:
  - 第一步
  - 第二步
  - 最终完成动作
failure_conditions:
  - 任务余量归零
items:
  - id: item_a
    real_dimensions_m: [宽, 高, 深]
    initial_area: 区域
    target: 目标
terminal: 终端用途
completion: 最终判定
special_risk: 顺序、时间、动态目标或路线中的一个
camera_goal: 固定第三视角需要同时看清的区域
first_person_goal: D435 近距离必须能辨认的线索
production_status: gameplay_complete | visual_candidate | final
```

简报还必须记录：概念图候选、用户选择、资产拆分、生成任务、seed、提示词、源文件、运行时文件、尺寸、纹理、图元、体积、碰撞来源、截图和验收结论。

## 4. 标准源码结构与接口

RF-01 仍保留历史根级 `game/level.js` 和 `game/engine.js`。所有新关卡统一使用：

```text
game/levels/rfXX/level.js
game/levels/rfXX/engine.js
game/levels/rfXX/scene.js
game/levels/rfXX/runtime.js
tests/rfXX-<slug>.test.mjs
docs/levels/rfXX.md
```

### 4.1 `level.js`：纯配置

必须包含：

```js
import { G1_LOCOMOTION } from "../../g1-locomotion.js";

export const LEVEL = Object.freeze({
  id: "rfXX",
  title: "...",
  bounds: Object.freeze({ minX, maxX, minZ, maxZ }),
  playerStart: Object.freeze({ x, z, yaw }),
  playerRadius: 0.32,
  interactionRange: 1.75,
  ...G1_LOCOMOTION,
  progress: Object.freeze({ /* 本关余量规则 */ }),
  staticColliders: Object.freeze([ /* XZ 矩形 */ ]),
});
```

约束：

- 只保存坐标、尺寸、枚举、顺序、计时、余量和碰撞；不创建 Three.js 对象。
- 所有嵌套常量尽量 `Object.freeze`。
- `playerStart` 必须可行走，且出生后 D435 首屏可读。
- `staticColliders` 必须与可见实体一致并保留真实门洞。
- 不写独立 `moveSpeed` 或 `turnSpeed` 数字。

### 4.2 `engine.js`：确定性状态机

至少导出：

```js
createInitialState()
cloneState(state)
isWalkable(state, x, z)
updateMovement(state, input, deltaSeconds)
getInteraction(state)       // 推荐，供 QA 使用
interact(state)
closeTerminal(state)
getObjective(state)         // 推荐，供本关测试和文档使用
```

状态至少包含：

```js
{
  player: { x, z, yaw },
  progress,
  motion: "idle" | "moving" | "turning" | "carrying",
  elapsed,
  interactions,
  lastEvent,
  terminalOpen,
  complete,
  failed,
  // 本关任务字段
}
```

移动实现必须遵守：

- `input.move` 与 `input.turn` 归一化到 `[-1, 1]`。
- `yaw += turn * LEVEL.turnSpeed * dt`。
- 位移沿 `sin(yaw), cos(yaw)`，速度来自 `LEVEL.moveSpeed`。
- `dt` 上限 `0.05 s`，避免后台恢复后穿透。
- X、Z 分轴碰撞，允许沿墙滑动。
- 按下移动或转向即按本关规则消耗余量；是否实际位移必须由关卡简报明确，现有关卡默认按输入消耗。
- 待机和 `WAIT` 不消耗移动余量，但动态系统和计时继续推进。
- `complete`、`failed` 或需要冻结的终端状态不得继续移动。
- 余量到 0 后固定失败、关闭终端并冻结后续操作。

互动实现必须遵守：

- `E` 只选择交互半径内最近的合法对象，不检查机器人朝向。
- 失败互动默认不改变关键状态；是否扣互动余量由本关规则决定。
- 携带物可在合法地面放下并重新拾取，除非简报明确禁止。
- 奖励只在里程碑首次达成时发放，不能刷取。
- 所有状态转换设置稳定的 `lastEvent`；事件名同时驱动消息、音效和机器人动作。
- 通关将 `complete=true`、`motion="idle"`、`progress=maximum`。

### 4.3 `scene.js`：视觉适配器

必须导出创建场景和同步视觉的函数，并可选导出携带物模型函数：

```js
create<Theme>Scene(renderer?)
sync<Theme>Visuals(world, presentationState, delta?)
create<Theme>CargoModel()        // 有携带物时
set<Theme>CargoModel(root, state)
```

`createScene()` 返回的 world 至少包含：

```js
{
  scene,
  assetReady: Promise<Array<{ loaded, url?, model?, error? }>>,
  // 本关视觉根节点
}
```

规则：

- 场景图只表现状态，不保存任务真值。
- 程序化灰盒始终是可玩的加载失败回退。
- 环境 GLB、每个可抓取物、插槽、门板、终端和会变状态的对象拥有独立根节点。
- GLB 加载成功后只隐藏对应后备物，不隐藏整个玩法世界。
- 加载失败返回明确结果并保留后备物，不能空白页或未处理 Promise rejection。
- 视觉同步根据 `presentationState` 显隐和移动对象，不修改逻辑状态。
- 可携带物必须同时支持世界状态和机器人 cargo 根节点，不创建跟随世界的重复副本。

### 4.4 `runtime.js`：与全局应用的适配合同

必须导出：

```js
LEVEL
createInitialState
interact
updateMovement
closeTerminal
ui
camera
audio
eventMessages
createScene()
syncVisuals(world, state, delta)
isCarrying(state)
getTelemetry(state)
getTerminal(state)
getSoundPosition(beforeState, state)
getDebugState(state)
```

有携带物时同时导出：

```js
createCargoModel()
syncRobotCargo(robot, state)
```

推荐导出 `getInteraction`、`getObjective` 和 `getProgressSteps` 供测试与后续界面使用。

`ui` 固定字段：

```js
{
  id,
  brand,
  unit,
  systemLabel,
  cargoLabel,
  gateLabel,
  startKicker,
  startTitle,
  startCopy,
  completeKicker,
  completeTitle,
  completeCopy,
  terminalHeading,
}
```

`camera` 固定格式：

```js
{ position: [x, y, z], lookAt: [x, y, z], fov }
```

`getTelemetry()` 固定返回：

```js
{
  system: "HUD STRING",
  systemOnline: true | false,
  cargo: "HUD STRING",
  gate: "HUD STRING",
}
```

`getTerminal()` 固定返回 `title`、`copy` 和三行 `rows`。现有 DOM 只绑定三行，不得返回第四行后假设它会显示。

### 4.5 机器人抓取与放置动画

共享动作时序位于 `game/robot-action.js`：总时长 `0.8 s`，接触点为进度 `0.5`。新关卡的抓取/放置事件必须加入 `EVENT_TO_ACTION`，映射为 `pickup` 或 `place`，否则状态虽变化但 G1 不会做双手动作。

要求：

- `isCarrying(state)` 与 `syncRobotCargo()` 使用同一个携带字段。
- 接触帧之前用交互前状态渲染，接触帧后才切到交互后状态。
- 动作期间冻结移动和重复 `E`。
- 切换视角不能取消动作。
- 新事件必须补 `tests/robot-action.test.mjs`。

## 5. 全局注册步骤

新增 RF-XX 后只修改以下注册点：

1. `game/app.js`
   - `levelId` 白名单。
   - `runtimeLoaders` 动态导入。
   - `FINAL_OBJECTIVES` 一句稳定最终目标。
2. `index.html`
   - 在 `.level-select` 增加一个 `data-level-option="rfXX"` 链接。
3. `vite.config.js`
   - 关卡拥有本地运行资产时，在 `runtimeAssetDirectories` 增加对应 `embodiedgen/rfXX/models/runtime`、音效或其他实际目录。
   - 纯程序化灰盒不添加不存在的资产目录。
4. 测试
   - 在 `tests/g1-motion-calibration.test.mjs` 导入新 `LEVEL` 并加入共享控制检查。

不得为新关卡复制 `app.js`、`index.html`、`robot.js`、`view-mode.js`、`g1-locomotion.js` 或 Agent 服务。

## 6. 生产阶段与用户决策点

每关严格按顺序执行：

1. 填写关卡简报。
2. 冻结任务链、失败条件和余量规则。
3. 搭建可玩程序化灰盒。
4. 验证 G1、三视角、HUD、碰撞和完整通关。
5. 冻结第三视角构图和 D435 近距离可读性。
6. 从正式第三视角并行生成 4 张概念图。
7. 用户选择一个整体视觉方向。
8. 建立静态环境与独立交互资产清单。
9. 并行生成环境和资产候选。
10. 用户只对少量核心交互物选择最终参考图；技术性背景物由生产过程筛选。
11. 清理、米制归一、减面、压缩并导出运行时 GLB。
12. 从最终运行 GLB 重新标定视觉位置和碰撞。
13. 接入场景、音效、HUD、终端和机器人动作。
14. 运行定向测试、全量测试和构建。
15. 完成第一、第三、双视角浏览器验收和完整任务流。
16. 通过质量门后冻结资产、更新文档并提交。

用户正常只需在两个节点选择：4 张整体概念图中的视觉方向，以及少量核心物体的参考图。玩法存在重大歧义时先请求用户决定，不带着不确定任务链生成高成本资产。

## 7. 灰盒空间与碰撞质量门

真实资产生成前，灰盒必须满足：

- 起点和全部任务目标在碰撞空间中可达。
- 每个交互对象附近至少有一个合法站位。
- G1 的转弯空间、门宽和通道宽符合本关 `playerRadius`。
- 可见实体有碰撞，可见门洞可通过，不存在空气墙。
- 关闭的动态门不可穿过，打开后两侧可通行。
- 第一视角出生不被近距离几何遮满；核心小物件放在 D435 可观察高度并有清楚轮廓。
- 第三视角一次看清主要空间关系；HUD 不遮住任务物和路线。
- 双视角显示同一时刻、同一物体位置和同一 HUD 状态。
- 最短路线和一次合理探索绕路都能在余量预算内完成。
- 错误互动、失败、重置和完成流程均可恢复或正确终止。

碰撞始终使用代码中的简单代理。静态环境为程序化几何时，碰撞与灰盒坐标同源；接入生成环境后，网页实际加载的最终 GLB 是视觉空间真值，必须核对并重新提取/标定墙体和不可穿越家具。

禁止：

- 给整个房间 GLB 加一个总包围盒。
- 用一个矩形跨过可见门洞。
- 为消除穿模无限扩大碰撞。
- 修改环境 GLB 后沿用旧碰撞。
- 让 GLB 节点名承担任务判断。

## 8. 概念图、环境和资产生成

### 8.1 概念图

概念图必须模拟最终固定第三视角，而不是自由室内效果图：

- 与冻结灰盒保持相同房间范围、入口、功能分区、路线和核心物体位置。
- 高位斜俯视或接近垂直的固定游戏构图，开放顶部，无屋顶或天花板遮挡。
- 真实米制比例、清楚门洞、可读路线、合理材质和适度使用痕迹。
- 不出现机器人、人物、UI、互动高亮、箭头、品牌、水印或无法控制的文字。
- 一轮固定并行生成 4 张，分别记录 seed、提示词和结果。

选择优先级：玩法路线、三视角可读性、真实尺度、门洞清晰、材质光照、场景不过度拥挤。

### 8.2 资产拆分

整体静态环境可以包含：地板、墙、门洞、不可互动家具、装饰和灯具。

以下对象必须独立：

- 可抓取、携带、放下、插入或投递的物体。
- 插槽、目标容器和状态会变化的底座。
- 门框与动态门板。
- 终端和动态屏幕。
- 运动设备的静态主体与运动部件。
- 完成前后外观不同且无法用材质切换表达的对象。

不要生成不可拆分的整屋模型来替代玩法灰盒。生成资产只替换视觉，不改变状态机、任务坐标或碰撞语义。

### 8.3 独立物体提示词

```text
Photorealistic game-ready [single object] for a realistic [scene theme].
Real-world dimensions: [width] m × [height] m × [depth] m.
[construction, materials, functional details, restrained wear].
Correct real-world scale, physically plausible PBR materials,
Y axis up, front facing positive Z, centered at world origin,
bottom-center pivot, complete object fully visible,
clean watertight geometry suitable for GLB export.
Single isolated object on an evenly lit neutral background,
no room, no floor, no person, no robot, no hands, no extra objects,
no logo, no brand, no readable text, no watermark, no UI,
no outline, no arrow, no pedestal, no floating parts.
```

一张输入图只对应一个孤立对象。生成后检查 360 度轮廓、背面、底部、开口、纹理、比例、枢轴、面数和浏览器性能；自动评分只能排序，不能替代人工几何检查。

## 9. EmbodiedGen 与运行资产

固定服务器位置：

```text
.
./public/local-assets/embodiedgen/rfXX
./external/EmbodiedGen
./external/EmbodiedGen/outputs/rfXX_*
/opt/arc-runtime/envs/embodiedgen
/opt/arc-runtime/envs/build_311
```

优先使用绝对路径：

```bash
ENV_ROOT=/opt/arc-runtime/envs/embodiedgen
"$ENV_ROOT/bin/python" --version
"$ENV_ROOT/bin/text3d-cli" --help
```

Blender：

```text
./external/EmbodiedGen/thirdparty/infinigen/blender/blender
```

运行前：

```bash
export LD_LIBRARY_PATH=/opt/arc-runtime/envs/build_311/lib:/opt/arc-runtime/envs/embodiedgen/lib:${LD_LIBRARY_PATH:-}
```

密钥只存放于 EmbodiedGen 私有配置或进程环境，不写入 Arc 仓库或日志。

推荐运行目录：

```text
public/local-assets/embodiedgen/rfXX/models/runtime/
  rfXX_final.glb
  interactables/
    rfXX_<asset>.glb
  manifest.json
```

网页运行目录只允许当前引用的 GLB 与 manifest；`.blend`、FBX、OBJ、PLY、概念图、缓存、候选和日志留在 EmbodiedGen 输出工程。

资产状态只有三种：

| 状态 | 命名 | 含义 |
| --- | --- | --- |
| 灰盒 | `rfXX_graybox_baseline.glb` 或纯程序化场景 | 玩法与空间已验证，视觉未完成 |
| 候选 | `candidate_<seed>.glb` | 等待筛选、修复或验收 |
| 最终 | `rfXX_final.glb` | 通过全部视觉、空间、性能和浏览器质量门 |

禁止把程序化回退、零纹理模型、失败任务或未审候选重命名为 `final`。

## 10. GLB 导出与运行时要求

所有运行资产：

- GLB/glTF 2.0、单位米、Y 轴向上、正面 `+Z`、底部中心枢轴。
- 删除模型内相机、灯光和无关动画。
- 清理屋顶、天花板、外壳和遮挡固定相机的大平面。
- 清理水印、错误品牌、烘焙乱码、漂浮物和生成器残片。
- 尺寸校正在离线导出阶段完成，不在浏览器按“看起来差不多”随意缩放。
- 减面、合并材质并控制纹理尺寸；PBR 纹理可解析且颜色纹理使用 sRGB。
- 重复静态资产加载一个原型并复用，不复制下载。
- 环境与交互资产在 manifest 中记录哈希、包围盒、纹理数、图元数、三角面数和大小。

运行时总下载大小是上限预算，不是视觉质量证明。默认以 `40–60 MB` 为单关软上限；更小且通过视觉质量门更好，超过时必须说明并优化。

`scene.js` 使用 `GLTFLoader`，压缩资产配置 `DRACOLoader`。生产构建必须把对应 `public/local-assets` 复制到 `dist/local-assets`。任何资产缺失都只能回退该对象，不得阻断玩法。

## 11. 任务余量与失败规则

每关在简报和 `LEVEL.progress` 明确：

- 初始值与上限。
- 移动/转向消耗方式。
- `E` 互动成本。
- 首次拾取奖励。
- 阶段完成奖励。
- 动态等待是否消耗。
- 余量到 0 的冻结行为。

调参方法：

1. 用共享 `1.4 m/s`、`1.8 rad/s` 测量最短完整路线。
2. 加入必要转向、互动动画和等待时间。
3. 熟练玩家完成后建议剩余 30–55。
4. 第一次探索允许一次短绕路和一两次错误互动。
5. 奖励只能首次发放，完成后余量固定为 100。

禁止通过修改单关机器人速度来补偿地图过大、路线过长或余量不合理；应调整空间、任务位置或余量。

## 12. 自动化测试合同

每关测试至少覆盖：

- 初始位置、朝向、物品、状态、余量和失败标志。
- W/S 沿当前朝向移动，A/D 原地转向。
- 关卡使用 `G1_LOCOMOTION`，没有独立速度数字。
- 被碰撞阻挡时位置不穿透，并按规则消耗或保持余量。
- 每个 `E` 分支、错误分支、放下、重新拾取和奖励不可刷取。
- 完整成功链、余量归零失败、完成/失败后的冻结。
- 所有任务目标从出生点存在合法可达站位。
- 可见家具有碰撞，入口和每个可见门洞保持开放。
- 场景的环境/交互资产边界、文件名和回退加载契约。
- 有本地资产时，`vite.config.js` 已注册运行目录且构建产物包含相同文件。
- 新抓取/放置事件的 G1 动作映射。
- `game/app.js`、`index.html` 和共享移动校准测试已注册新关卡。

全局 `tests/g1-motion-calibration.test.mjs` 必须包含所有关卡，并验证：

```text
LEVEL.moveSpeed === G1_LOCOMOTION.moveSpeed
LEVEL.turnSpeed === G1_LOCOMOTION.turnSpeed
所有 level.js 导入 G1_LOCOMOTION
所有 level.js 不含独立 moveSpeed/turnSpeed 数字
```

## 13. 测试、构建与浏览器验收

服务器 Node 固定入口：

```bash
cd .
export PATH=./.tooling/node-v22.14.0-linux-x64/bin:$PATH
npm test
npm run build
```

构建警告可以记录，但错误、测试失败或资产缺失必须修复后才能提交。

浏览器至少验证：

1. 选关卡能进入 RF-XX，启动页文案和三个视角选项正确。
2. G1 资源完成加载后才能开始任务，控制台无错误。
3. 第三视角首屏看清主要空间关系和目标线索。
4. 第一视角首屏无遮挡，D435 上下看有效，小物体近距离可辨。
5. 双视角画面同步，切换不重置状态。
6. W/S、A/D、E、WAIT/计时、携带和动作锁表现正确。
7. 贴墙行走、所有门洞、交互站位和失败流程正常。
8. 完整通关一次，完成覆盖层、余量和 HUD 状态正确。
9. 无 GLB/纹理/Draco 404、Promise rejection、shader 错误、重复世界或重复事件监听。

浏览器截图至少保留：第三视角初始、第一视角初始、双视角、携带/关键阶段、完成状态。仅单元测试通过不能替代视觉验收。

## 14. 视觉最终质量门

只有以下全部通过才允许 `production_status: final`：

- 灰盒完整玩法、失败和重置已通过。
- 概念图由正式第三视角生成并由用户选择。
- 环境和核心交互物生成任务、seed、提示词和日志可追溯。
- 环境无房顶/天花板遮挡，交互物未烘焙进静态环境。
- PBR 材质和纹理可解析，无水印、品牌、乱码或生成器残片。
- 门、桌面、家具、机器人和互动物尺度合理。
- 最终 GLB 与冻结灰盒对齐，碰撞重新标定，无穿模或空气墙。
- 第三、第一、双视角人工检查通过。
- Agent 信息不超过人类界面。
- manifest 完整，运行时资产在体积预算内。
- 全量测试、生产构建、浏览器控制台和完整通关通过。

验收记录：

```yaml
production_status: gameplay_complete | visual_candidate | final
generator_success: true | false
human_visual_review: pass | fail | pending
reference_match: pass | fail | pending
textures_embedded: <integer>
primitive_count: <integer>
runtime_size_mb: <number>
first_view_review: pass | fail | pending
third_view_review: pass | fail | pending
dual_view_review: pass | fail | pending
tests: pass | fail
build: pass | fail
browser_console: pass | fail
final_name_allowed: true | false
```

## 15. 并行批量生产规则

可以并行：

- 不同关卡的灰盒与测试，前提是文件目录不重叠。
- 同一关 4 张概念图。
- 不同 seed 的环境候选。
- 相互独立的交互资产候选。
- 资产生成期间完善本关状态机、测试、HUD 文案和加载器。

必须串行或等待依赖：

- 玩法与灰盒未冻结前不生成最终环境。
- 用户未选概念图前不冻结视觉方向。
- 最终环境 GLB 未确定前不冻结碰撞。
- 真实比例未校准前不冻结交互点。
- 构建未成功前不做最终浏览器验收。
- 三视角与完整通关未通过前不标记最终或提交冻结版本。

每个任务使用独立输出目录、manifest 和日志。失败任务只重跑自己的目录，不覆盖其他候选。批量完成后逐关运行定向测试，再运行一次全量测试和构建。

## 16. 提交与清理

提交前：

```bash
git status --short
git diff --check -- <本任务文件>
npm test
npm run build
```

只暂存本任务文件。若与用户未提交修改共享同一文件，使用交互式暂存或精确 cached patch，只提交本任务 hunk。

不提交：

- `dist/`、缓存、日志、PID、临时截图和浏览器下载。
- EmbodiedGen 原始工程和大模型中间文件。
- 未被网页引用的候选、备份和旧运行资产。
- 密钥、令牌和认证数据。

视觉最终版冻结后，网页运行目录只保留一个当前环境和当前交互资产；删除前先只读列出精确目标，禁止对资产根目录递归清空。原始可恢复工程、seed、提示词和日志保留在 `./external/EmbodiedGen/outputs/`。

## 17. 单关完成定义

- [ ] `docs/levels/rfXX.md` 简报和状态完整。
- [ ] 一个主要新概念与清晰任务链已冻结。
- [ ] `level/engine/scene/runtime` 四个模块满足接口合同。
- [ ] 新关卡引用共享 `G1_LOCOMOTION`，未定义独立速度。
- [ ] `app.js`、`index.html`、共享校准测试完成注册。
- [ ] 有本地资产时，`vite.config.js` 已登记运行目录且 `dist` 中资产完整。
- [ ] 程序化灰盒可完整通关并有加载失败回退。
- [ ] 所有目标可达、碰撞正确、门洞无空气墙。
- [ ] G1 抓取/放置事件有共享动作动画。
- [ ] 第一、第三、双视角同步且首屏可读。
- [ ] HUD 与 Agent 只使用共享接口和人类可见信息。
- [ ] 环境与互动资产拆分正确，GLB 米制、Y-up、枢轴和材质合格。
- [ ] 概念图、资产、manifest 和生成记录可追溯。
- [ ] 定向测试与全量测试全部通过。
- [ ] `npm run build` 成功。
- [ ] 浏览器完整通关、失败、重置和控制台检查通过。
- [ ] 只提交本任务文件，其他用户修改保持原样。

任一项未满足时，只能标记为 `gameplay_complete` 或 `visual_candidate`，不能宣布最终完成。

## 18. 新关卡最短执行清单

```text
读本文
→ 找下一个 rfXX
→ 写 docs/levels/rfXX.md
→ 冻结任务链
→ 复制四模块结构，不复制共享控制模块
→ level.js 展开 G1_LOCOMOTION
→ 完成灰盒、碰撞和状态机
→ 注册 app.js / index.html / 校准测试
→ 跑定向测试
→ 浏览器验证三视角
→ 生成 4 张概念图并让用户选择
→ 生成环境与独立交互资产
→ 优化并接入 GLB
→ 重标碰撞与交互点
→ 全量测试 + build + 浏览器完整通关
→ 更新 manifest 和关卡文档
→ 精确暂存并提交
```

这一清单适用于单关，也适用于批量关卡。批量生产只扩大并行数量，不得跳过任何单关质量门，也不得为任何关卡复制或改写共享 G1 控制、视角、HUD 和 Agent 合同。
