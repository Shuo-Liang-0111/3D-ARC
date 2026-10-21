# 关卡真实性重构手册（Cardinal + Three.js）

本手册用于在不改变关卡核心玩法的前提下，把 ARC 中任意关卡升级为真实性优先的 3D 垂直切片，并逐步扩展到完整关卡。RF-01 是本流程的首个完整案例，但本文的阶段门、资产规范、请求模板、碰撞方法和验收标准适用于所有关卡。

## 1. 最终目标

一次合格的真实化不是“把低模换成高模”，而是让以下系统同时成立：

- 场景符合真实空间尺度、安装关系和使用状态。
- 关键物体具有真实几何、PBR 材质和一致光照。
- 第一视角、第三视角和任务交互看到的是同一套资产状态。
- 可视模型、碰撞代理、交互点和机器人包络对齐。
- 远距离、屏幕边缘和动态状态不存在突然消失或外观切换。
- 源高模、运行时模型、请求、task ID、优化命令和验收证据可以复现。
- 原玩法状态机、奖励、输入、任务顺序和可达性保持不变，除非需求明确允许调整。

## 2. 不可违反的原则

### 2.1 玩法与视觉分层

玩法状态保留在关卡 engine/runtime 中；Three.js 场景只负责把状态表现出来。不要把任务进度、奖励或交互规则写进 Cardinal 模型节点。

### 2.2 Cardinal 生成可视资产，不生成权威碰撞

Cardinal GLB 默认只作为可视网格和 PBR 材质来源。即使模型看起来封闭，也不能假设它自带符合玩法的碰撞体。碰撞必须在项目中显式定义或由专用低模 GLB提供。

### 2.3 米制坐标是唯一空间真相

关卡坐标、模型尺寸、交互距离、门洞、相机远裁剪和碰撞都使用米。生成模型的任意单位、pivot 和朝向必须在进入运行时前或加载时归一化。

### 2.4 先做最高质量垂直切片

不要一开始批量生成整关所有资产。先完成一个能代表最终质量的切片，覆盖主建筑、核心交互物、目标设施、近景表面、碰撞和两个视角。切片通过后再扩展。

### 2.5 失败时保留可用后备

只有新资产成功加载后才隐藏旧对象。不要因为单个 GLB 下载或解码失败让关卡出现空洞、缺门或缺任务物。

## 3. 开始前的 95% 需求确认

每个关卡开始前至少确认以下问题。不能从现有代码、文档或截图中确定的答案，必须向用户询问。

1. 核心玩法、任务顺序、奖励和失败条件是否完全不变？
2. 第一视角是否允许修改？相机位置、FOV、裁剪距离分别能否调整？
3. 第三视角是否固定？是否允许改变俯角、距离和构图？
4. 是否需要保留双视角？
5. 场景类型和地域是什么？例如中国工业园区、图书馆、住宅或实验室。
6. 场景处于正常使用、停业、废弃、灾后还是施工状态？
7. 是否允许重新布局？如果允许，哪些任务坐标必须冻结？
8. 哪些现有资产必须保留，哪些必须替换？
9. 是否允许 Cardinal、开源资产和扫描资产混用？
10. 资产许可是否必须为 CC0，还是允许其他可商用许可？
11. 是否存在下载体积、显存、帧率或目标设备限制？
12. 是否优先追求真实性上限，暂时不计生成和运行成本？
13. 不可通行生成资产是否默认实心？门洞、窗洞和货架空隙如何处理？
14. 哪些物体会拾取、携带、放下、打开、移动、旋转或改变灯态？
15. 是否允许新增环境声、交互音效或动态灯光？
16. 验收以哪些固定截图、路线和操作为准？
17. 是否先交付最高质量垂直切片，再扩展完整关卡？

把答案写入关卡 brief，而不是只保留在聊天记录中。

## 4. 每个关卡的建议目录

```text
docs/levels/<level-id>-realism-brief.md
tools/<level-id>-cardinal-assets.*
tools/<level-id>-prepare-assets.*
public/local-assets/cardinal/<level-id>/
  requests/
  references/
  models/source/
  models/runtime/
  audio/
  manifests/
  review/
game/levels/<level-id>/
tests/<level-id>-*.test.mjs
```

`requests/` 和 `manifests/` 不能包含凭据、下载签名 URL 或用户隐私数据。大体积资产可以受 Git 忽略，但脱敏请求、task ID、哈希、许可证和优化参数应尽量提交。

## 5. 阶段 A：冻结玩法和基线

### 5.1 冻结玩法契约

记录并测试：

- 初始玩家位置与朝向。
- 所有任务物、目标点和交互半径。
- 状态机步骤、奖励、消耗、失败和完成条件。
- 动态门、可携带物和终端行为。
- 第一视角、第三视角和双视角契约。
- 机器人半径、前向包络、移动速度和转向速度。

在真实化前先运行现有测试并保存结果。视觉重构不能以“测试本来就坏了”为前提继续。

### 5.2 固定基线截图

至少保存：

- 第三视角全景。
- 第一视角起点。
- 核心任务物近景。
- 主建筑入口和目标设施。
- 拾取前、手持中、放置后或安装后的状态。

截图必须使用固定 URL、视角、窗口尺寸和关卡状态，便于迭代对比。

## 6. 阶段 B：真实性 brief 与资产审计

### 6.1 brief 必须描述的内容

- 地域、建筑年代、行业和运营状态。
- 天气、时段、光照方向和空气状态。
- 真实材料基调及磨损程度。
- 场地尺寸、道路宽度、门洞、层高和通行净距。
- 安装逻辑：设备如何落地、靠墙、接电、接管或固定。
- 禁止出现的视觉语言，例如科幻霓虹、全新展厅、悬浮 UI 或过度做旧。
- 目标设备、分辨率、帧率和质量档位。

### 6.2 资产审计分类

给场景中每类可见物体建立清单，并分为：

| 分类 | 处理方式 |
| --- | --- |
| 核心交互物 | 独立 GLB，必须跨状态复用同一外观 |
| 动态结构 | 可视模型与运动节点分离，例如门框和门扇 |
| 主建筑 | 独立高质量资产或可靠扫描资产，碰撞另做 |
| 重复模块 | 生成一个标准件，运行时克隆，例如围栏和灯具 |
| 普通近景道具 | Cardinal 或合规开源资产 |
| 大面积表面 | 使用可平铺 PBR 材质，不用高模覆盖整块地面 |
| 远景 | 优先低成本几何、LOD 或环境贴图 |
| 不可见玩法代理 | 保留现有逻辑，不需要 Cardinal 生成 |

同时标记每个对象是保留、替换、删除还是仅需材质升级。

## 7. 阶段 C：选择垂直切片

一个合格切片建议包含：

- 一个主建筑或主空间。
- 一个可拾取核心物体。
- 一个任务目标设施。
- 一个动态结构。
- 一组重复模块。
- 一块近景地面和一面近景墙体。
- 第一视角与第三视角均能看到的完整任务路径。

优先选择玩家停留时间长、交互多、能暴露材质和比例问题的区域。切片不是漂亮的静态角落，而是能完成至少一个主要任务步骤的真实场景。

## 8. 阶段 D：Cardinal 准备、能力和成本

### 8.1 当前推荐入口

使用已安装 Cardinal Skill 的 helper，不要在新关卡复制 RF-01 的历史直连 API 客户端。

在首次计费请求前执行：

```bash
python scripts/cardinal_aigc.py doctor
python scripts/cardinal_aigc.py capabilities
python scripts/cardinal_aigc.py token-costs
```

规则：

- 不向用户索要 Base URL，也不修改 Skill 自带的 `runtime.json`。
- API Key 只进入当前进程或用户私有安全存储，不进入仓库、`.env`、请求 JSON、URL 或日志。
- 明确选择 `fast-lowpoly` 或 `high-highpoly`；复刻 RF-01 的真实性上限时使用 `high-highpoly`。
- 单个明确生成请求可以直接提交；批量生成、rigging 或 retargeting 必须先确认。
- 在提交前报告当前操作的 token 成本；能力不可用时不得提交。

### 8.2 何时用 text-to-model

适合：

- 机械结构明确的独立设备。
- 箱体、柜体、灯具、货架、泵组、消防柜等工业道具。
- 可通过真实尺寸和部件列表清楚描述的对象。

### 8.3 何时用 image-to-model

适合：

- text-to-model 多次出现结构漂移。
- 外形比例、门窗位置或材料分区需要稳定参考。
- 已有经过批准的产品图、现场照片或生成参考图。

先上传参考图：

```bash
python scripts/cardinal_aigc.py upload-model-source references/<asset>.png
```

把返回的 `sourceImageId` 写入 image-to-model 请求。禁止把本地绝对路径当作 `imagePath` 发给 API。

### 8.4 何时不用 Cardinal

- 已有高质量、许可明确且比例正确的扫描资产。
- 对门洞、墙厚、楼梯和拓扑连续性有毫米级要求的大型建筑。
- 只需要平铺材质、HDRI 或远景环境。
- 需要精确 CAD、工程连接或可验证机械运动的对象。

这些情况优先使用开源资产、程序化建模、Blender/CAD 清理或混合方案。

## 9. 阶段 E：提示词工程

### 9.1 通用 3D 提示词模板

```text
Photorealistic game-ready <asset type> for <real place and use>.
Real-world size approximately <width> m × <height> m × <depth> m.
Describe the primary silhouette, structural parts, mounting method, materials,
fasteners, connectors, wear level, and all openings that must remain empty.
Y axis up, front facing positive Z, centered at world origin, bottom-center pivot.
Clean watertight topology, physically based materials, restrained realistic wear.
One isolated object only. No environment, floor, wall, pedestal, character, robot,
hands, floating parts, animation, neon glow, outline, arrows, UI, readable text,
logo, trademark, or baked lighting. Export as GLB for Three.js.
```

提示词必须同时描述“应该有什么”和“绝对不能有什么”。只写“真实工业设备”通常会产生贴图感、错误开口、附带地面或不可用的复合场景。

### 9.2 核心交互物模板补充

- 描述抓取位置、把手、接触面和重心。
- 指定放置方向、插槽方向和连接器所在短边。
- 明确生成一个对象，不附带手、机器人、支架或目标容器。
- 任务状态变化通过运行时代码表现，不烘焙灯光和 UI。

### 9.3 建筑和门洞模板补充

- 写出外尺寸、檐高、屋脊、墙厚和主轴方向。
- 写出每个必须保留的门洞位置和净尺寸。
- 门框、门扇和墙体尽量拆分生成。
- 不依赖生成模型的总 AABB 作为门洞碰撞。
- 对精确开口要求高时优先使用参考图或在 DCC 中修整。

### 9.4 重复模块模板补充

- 只生成一个标准模块。
- 指定模块净长度、连接端面和重复方向。
- 两端不得附带不对称杂物，避免拼接露缝。
- 运行时克隆，不要让 Cardinal 生成整排重复对象。

### 9.5 参考图模板

```text
Create one photorealistic isolated product reference image for single-image 3D
reconstruction. Show the complete object in a clean three-quarter front view so
the front, right side, and top are visible. Neutral light-gray seamless background,
realistic studio lighting, sharp focus, minimal soft contact shadow, straight edges,
real engineering proportions, no crop, no environment, no text, no logo, no extras.
```

## 10. 阶段 F：请求、轮询和产物记录

### 10.1 最小 text-to-model 请求

```json
{
  "prompt": "<完整提示词>",
  "taskType": "text_to_model",
  "qualityPreset": "high-highpoly",
  "outputFormat": "glb",
  "geometryQuality": "detailed",
  "enablePbr": true,
  "texture": true,
  "pivotToCenterBottom": true,
  "refineAfterGeneration": false
}
```

提交、轮询和下载：

```bash
python scripts/cardinal_aigc.py submit model3d --file requests/<asset>.json
python scripts/cardinal_aigc.py task <task-id>
python scripts/cardinal_aigc.py artifact <task-id> --output models/source/<asset>.highpoly.glb
```

轮询间隔应为数秒，不要高频请求。遇到网络失败先读取现有 task 状态，不要直接重复提交，否则可能产生重复计费任务。

### 10.2 每个资产必须记录的 manifest

```json
{
  "assetId": "<stable-id>",
  "role": "interactive|static|dynamic|repeatable",
  "requestFile": "requests/<asset>.json",
  "taskId": "<task-id>",
  "taskType": "text_to_model",
  "qualityPreset": "high-highpoly",
  "modelVersion": "<returned-or-requested-version>",
  "sourceImageId": null,
  "sourceArtifact": "models/source/<asset>.highpoly.glb",
  "sourceSha256": "<sha256>",
  "runtimeArtifact": "models/runtime/<asset>.glb",
  "runtimeSha256": "<sha256>",
  "targetSizeMeters": [1.0, 1.0, 1.0],
  "frontAxis": "+Z",
  "pivot": "bottom-center",
  "optimization": {
    "toolVersion": "<version>",
    "commandFile": "manifests/<asset>-optimize.txt"
  },
  "review": {
    "status": "pending|approved|rejected",
    "screenshots": []
  }
}
```

不要保存临时签名下载 URL。保存 task ID 和最终文件哈希即可。

## 11. 阶段 G：源资产入库检查

每个 Cardinal 产物必须先在隔离预览场景检查，不能下载后直接批量替换。

### 11.1 几何检查

- 只有目标对象，没有地板、墙、角色和漂浮碎片。
- 轮廓、开口、把手和连接器与 brief 相符。
- X/Z 主轴、正面和 Y-up 方向可确定。
- pivot 可修正到底部中心。
- 尺寸比例没有严重拉伸。
- 没有大面积自交、破面、反法线和透明遮挡片。

### 11.2 材质检查

- Base Color、Normal、Roughness、Metalness 等通道合理。
- 金属不会呈现塑料高光，非金属不会错误高金属度。
- 贴图没有烘焙文字、Logo、箭头、阴影或环境背景。
- 近景纹理分辨率足够，但不为不可见表面浪费显存。
- 透明材质数量受控，避免深度排序问题。

### 11.3 直接拒绝并重做的情况

- 主体结构缺失或用途错误。
- 必须为空的门洞、插槽或货架被封死。
- 附带不可分离的环境或重复对象。
- 正面和尺寸无法通过旋转、pivot 或合理缩放纠正。
- 生成内容含不可接受的文字、商标或许可风险。

不要用大量运行时代码掩盖本应重做的资产错误。

## 12. 阶段 H：高模转运行时 GLB

保留原始高模，再生成浏览器 runtime 版本。不要覆盖源文件。

典型流程：

1. 使用 glTF Validator 或 glTF Transform `inspect` 检查结构。
2. 清理无用节点、相机、灯光、动画和重复材质。
3. 应用或归一化变换，确认 Y-up、+Z 正面和底部中心 pivot。
4. 去重、prune，并按可见重要度简化网格。
5. 把贴图压缩为 WebP、AVIF 或 KTX2；近景和远景使用不同预算。
6. 选择 Meshopt 或 Draco，并在运行时配置对应解码器。
7. 再次检查尺寸、材质、纹理、节点名和包围盒。

参考命令必须先在当前 glTF Transform 版本验证，并把实际版本和完整参数写入 manifest：

```bash
npx gltf-transform inspect models/source/<asset>.highpoly.glb
npx gltf-transform optimize \
  models/source/<asset>.highpoly.glb \
  models/runtime/<asset>.glb \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 2048
```

不要为了文件小而破坏门洞轮廓、把手、连接器、格栅或近景法线。

## 13. 阶段 I：Three.js 运行时接入

### 13.1 资产注册

所有路径集中在关卡资产表中，不把 URL 散落在同步逻辑里。静态环境、交互物和动态结构分别注册。

### 13.2 共享加载与克隆

- 同一 URL 只加载一次并缓存 source scene。
- 重复道具使用 `clone(true)` 或经过验证的实例化方案。
- 地面、手持、放下和安装状态复用同一个交互物 GLB。
- 载荷模型加载完成前不要允许开始任务，或提供外观一致的后备。

### 13.3 成功后替换

加载结果返回 `{ loaded, name, url, model }`。只有 `loaded=true` 时才隐藏对应旧对象。失败时保留后备并记录明确的浏览器日志或 dataset 状态。

### 13.4 米制拟合

推荐顺序：

1. 计算原始世界包围盒。
2. 判断 X/Z 主轴是否交换。
3. 必要时先在子节点旋转。
4. 把水平中心移到原点，最低点移到 `y=0`。
5. 在旋转后的父坐标系中按目标米制尺寸缩放。
6. 更新世界矩阵后重新测量最终尺寸。

不要把非均匀缩放直接施加到已经旋转的模型局部轴，否则会交换目标宽度和深度。

### 13.5 摆放清单

每个资产记录：

- 世界坐标 `[x, y, z]`。
- 欧拉角或四元数。
- 最终世界尺寸。
- 地面、墙面或设备基座对齐面。
- 交互点和机器人接近方向。
- 是否克隆及克隆数量。

## 14. 阶段 J：材质、光照和接触关系

### 14.1 色彩空间

- Base Color 和 Emissive 贴图使用 sRGB。
- Normal、Roughness、Metalness、AO 和 Height 使用线性数据空间。

### 14.2 材质校正

- 高金属度表面设置合理粗糙度下限。
- 透明材料谨慎关闭 `depthWrite`，并检查排序。
- 建筑薄墙若确实缺背面，可在确认后使用双面材质；优先修复几何。
- 任务灯态使用运行时 emissive，不烘焙进 Base Color。

### 14.3 光照

- HDRI/IBL 提供环境反射和间接光感。
- 方向光负责稳定阴影和时间方向。
- GTAO/SSAO 只增强接触，不用于掩盖悬空或错误安装。
- Bloom 保持低强度、高阈值，不让工业场景变成科幻霓虹。

### 14.4 安装真实性

检查物体是否真正落地、靠墙、挂顶或连接到管线。真实感通常首先来自正确比例和接触关系，其次才是贴图分辨率。

## 15. 阶段 K：碰撞与交互代理

### 15.1 默认策略

- 不可通行生成资产默认实心。
- 可通行开口必须显式拆分碰撞。
- 货架、桌下空间、门洞和围栏间隙不能用一个总 AABB 粗暴覆盖。
- 动态门的碰撞随门状态移动或启停。
- 可拾取物被拾取后移除世界碰撞，放下后恢复。

### 15.2 专用低模碰撞 GLB

复杂建筑建议制作独立碰撞资产：

```text
COLLIDER_<LEVEL>_<ASSET>_<PART>
```

每个节点只使用简单 box、capsule 或低面数凸体，并通过 extras 标记：

```json
{
  "collision": true,
  "shape": "box"
}
```

运行时读取节点最终世界变换和包围盒，而不是假设可视 GLB 中每面墙都有可直接使用的游戏坐标。

### 15.3 机器人包络

碰撞验收必须包括机器人主体半径、前向肢体或载荷包络。代理贴着可视墙体不代表机器人视觉上不会穿进去。

### 15.4 碰撞验收矩阵

| 对象 | 正面 | 背面 | 左侧 | 右侧 | 开口 | 手持状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 主建筑 | 阻挡 | 阻挡 | 阻挡 | 阻挡 | 可通行/按需求 | 不适用 |
| 货架 | 按可见结构 | 按可见结构 | 按可见结构 | 按可见结构 | 不应有空气墙 | 不适用 |
| 动态门 | 关闭阻挡 | 关闭阻挡 | 轨迹对齐 | 轨迹对齐 | 打开可通行 | 不适用 |
| 任务物 | 可接近 | 可接近 | 可接近 | 可接近 | 不适用 | 世界碰撞关闭 |

## 16. 阶段 L：可见距离与性能

### 16.1 三种不同的“远处消失”

分别检查：

- 相机 `far` 裁剪面。
- 场景 fog 的 near/far 或 density。
- 对象 frustum culling、错误包围球或 LOD 距离。

不要只扩大相机 far 就宣布修复。

### 16.2 LOD 和裁剪

- 大型静态环境和重复资产应规划 LOD。
- 生成模型包围盒不可靠时先修复包围体；只对确认有问题的关键资产关闭 `frustumCulled`。
- 第一视角的传感器测距上限与渲染远裁剪可以不同，但必须在文档中明确。
- 双视角需要单独评估 draw call、后处理和显存成本。

### 16.3 预算表

每关至少记录：

- runtime GLB 总字节数。
- 解压后的纹理显存估算。
- 三角形、材质、纹理和 draw call 数量。
- 第一、第三和双视角 FPS。
- 首次加载时间和缓存后加载时间。

真实性优先阶段可以暂时放宽预算，但不能不测量。

## 17. 阶段 M：浏览器实机验收

DOM 状态只能证明代码运行，不能证明 WebGL 外观正确。每轮必须截图。

### 17.1 必测状态

- 加载完成、无控制台错误。
- 第三视角起点和全景。
- 第一视角起点和最远可见对象。
- 核心交互物拾取前、手持中、放下后和安装后。
- 动态门关闭、运动中和完全打开。
- 主建筑四面和所有可通行开口。
- 屏幕边缘、远距离和快速转向时的可见性。

### 17.2 视觉检查

- 没有贴图背景残留、漂浮部件和重复立面。
- 比例、落地、朝向和安装关系正确。
- PBR 高光、粗糙度、色温和阴影一致。
- 手持物不换模型、不缩放跳变、不穿过手臂。
- 旧资产只在新资产成功后隐藏，且没有重叠。

### 17.3 玩法检查

- 所有目标可达。
- 每个交互动作仍按原顺序完成。
- 碰撞阻挡与可见表面对齐。
- 相机、输入、任务消耗和奖励没有被视觉重构改变。

## 18. 阶段 N：自动测试、构建和提交

至少覆盖：

- 资产路径和 GLB 数量。
- runtime 模型是否存在、可加载并带纹理。
- 米制最终包围盒。
- 轴交换后的尺寸拟合。
- 专用碰撞节点名、数量和 extras。
- 任务路径可达性和关键门洞通行。
- 核心交互物跨状态复用同一资产。
- 第一视角远裁剪契约。

完成后执行仓库要求的全量测试和生产构建。只暂存本关卡和本任务修改，不把其他用户改动、凭据、缓存、日志、生成临时文件或构建产物带入提交。

## 19. Definition of Done

只有全部通过，关卡才能从 `runtime_candidate` 升级为可人工确认的候选版本：

### 19.1 内容

- brief、资产清单、请求和 manifest 完整。
- 垂直切片所有关键对象已替换或明确保留原因。
- 开源资产许可和来源可追溯。

### 19.2 视觉

- 第一和第三视角达到同一真实性标准。
- 无明显贴图感、错位、穿插、悬空和错误比例。
- 交互物所有状态外观一致。

### 19.3 碰撞

- 默认实心对象不可穿透。
- 所有设计开口可通行且无空气墙。
- 动态门和拾取物碰撞随状态正确变化。

### 19.4 工程

- runtime GLB 与源高模分离。
- 加载失败有后备或明确阻断。
- 资产大小、性能和可见距离已测量。
- 测试、构建和浏览器截图验收通过。
- 只提交本任务文件。

## 20. RF-01 复刻案例

RF-01 的真实化过程可以作为其他关卡的顺序模板，而不是资产模板。

### 20.1 第一次垂直切片

先冻结四步玩法、固定第三视角并保留第一视角。使用 Poly Haven HDRI/PBR 解决大面积表面，再用 Cardinal `high-highpoly` 替换能源模块、电源槽、动态门、终端和七类近景设备。

项目历史脚本 `tools/cardinal-rf01-assets.mjs` 保存了 11 类提示词和旧 API 编排逻辑。新关卡应改用 Cardinal Skill helper，但可以复用其“真实尺寸 + 工业用途 + 机械部件 + 公共负面约束”的提示词结构。

### 20.2 第二次扩展

垂直切片通过后，再替换厂房、围栏模块、门岗、消防站、排水格栅和绿篱花槽六类程序化资产。六个源高模共约 339 MB，17 个 runtime GLB 共约 48.4 MB。

### 20.3 工程修正

RF-01 暴露并修复了以下通用问题：

- X/Z 主轴交换后沿错误局部轴缩放，导致厂房目标尺寸与实际尺寸不符。
- 使用总包围盒近似建筑墙体，造成正门穿模和侧面空气墙。
- 生成门框与原结构重复，形成大块遮挡。
- 错误包围体和裁剪导致远处或屏幕边缘资产消失。
- 地面能源模块使用 Cardinal GLB，手持时却切换为程序化模型。
- 非通行生成资产没有统一实心策略。

最终采用：父坐标系米制拟合、成功后替换、同一 GLB 跨状态复用、40 m 第一视角渲染远裁剪、默认实心策略，以及带 8 个 `COLLIDER_*` 节点的专用碰撞 GLB。

### 20.4 RF-01 相关文件

```text
docs/levels/rf01.md
tools/cardinal-rf01-assets.mjs
tools/rf01-build-collision-glb.mjs
game/rf01-production-assets.js
game/rf01-collision-proxies.js
game/scene.js
game/level.js
game/engine.js
tests/web-model-assets.test.mjs
tests/facility-engine.test.mjs
```

### 20.5 不应复制的历史缺口

- 不复制旧脚本读取私有登录文件并直连 API 的方式。
- 不省略 `capabilities`、`token-costs` 和批量确认。
- 不把 task ID、请求 JSON 和优化命令只留在临时目录。
- 不依赖运行时不断打补丁来补救本应重做的源资产。
- 不把可视 GLB 当成权威碰撞。

## 21. 推荐执行顺序

对一个新关卡，按下面顺序复刻 RF-01：

1. 回答 95% 需求问题，写 brief。
2. 冻结玩法测试和固定截图。
3. 建立资产审计表与现实尺寸表。
4. 选择一个可完成任务步骤的垂直切片。
5. 检查 Cardinal 能力和成本，确认生成批次。
6. 先生成核心交互物、目标设施、主结构和一个重复模块。
7. 隔离检查源高模，拒绝结构错误资产。
8. 生成 runtime GLB 并记录完整优化命令。
9. 按米制坐标接入，成功后替换旧资产。
10. 单独实现碰撞、动态状态和机器人包络。
11. 完成第一/第三视角任务路径截图验收。
12. 垂直切片批准后再批量扩展剩余资产。
13. 跑全量测试和构建，精准提交。

如果任何阶段出现明显贴图感、模型错位、空气墙、穿模或远处消失，应回到对应阶段修正根因，而不是继续批量生成。
