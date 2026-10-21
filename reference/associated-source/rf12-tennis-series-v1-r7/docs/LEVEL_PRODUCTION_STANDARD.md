# ARC 关卡批量生产标准

版本：1.0  
适用范围：RF-02～RF-07 及后续普通 GLB 场景关卡  
特殊路线：RF-10 使用第 2.1 节的真实 3DGS 路线
不适用：RF-01 的 HDR/PBR 专用管线、RF-08 的 Gaussian 管线

## 1. 核心结论

后续普通场景全部采用同一个运行时合同：

> 最终环境 GLB + 独立交互 GLB + 独立碰撞 GLB + 统一 Draco 解码 + 统一资产门禁。

运行时只有在机器人、环境、碰撞、交互货物和任务目标资产全部成功加载后，才允许玩家开始任务。任何失败都必须停留在加载界面并提供重试，不能用旧灰模继续游玩。

fallback 只能用于开发期诊断，不能作为发布版本的可玩资产，也不能参与“加载成功”判断。

## 2. RF-01 与 RF-02～07 的差异

### RF-01：独立生产管线

RF-01 不是普通 GLB 场景模板，核心资产链路如下：

1. HDR 环境图：public/local-assets/polyhaven/rf01/environment/*.hdr
2. PBR 表面库：混凝土、沥青、金属覆板的 diffuse/normal/roughness/AO/displacement。
3. Cardinal 生产模型：工坊、围栏、岗亭、泵组、管汇等独立 GLB。
4. Meshopt 压缩：通过 GLTFLoader.setMeshoptDecoder(MeshoptDecoder) 解码。
5. 独立碰撞代理：由 rf01-collision-proxies.js 加载并安装。
6. 加载完成后调用 hideRF01LegacyAssets() 隐藏旧 EmbodiedGen/程序化对象。

RF-01 的 HDR 环境图负责反射和整体光照，不能把它当作普通关卡的场景模型。

### 2.1 RF-10 真实 3DGS 路线（发布标准）

RF-10 的视觉目标是完整还原真实会议室，不使用 Spark 的 Gaussian 渲染路径。发布版本必须采用以下真实路线：

1. 使用 Aholo 训练得到的完整原始 PLY（`rf10-room-full.ply`）作为唯一视觉环境源，不删减 splat，不降采样成低模视觉层。
2. 使用 PlayCanvas `GSplatComponent` / GSplat renderer 在独立透明 canvas 上渲染 PLY；PlayCanvas 负责 splat 的资源解析、深度排序、屏幕空间绘制和 LOD。
3. Three.js 继续负责机器人、交互对象、碰撞逻辑和游戏相机；每帧将 Three.js 的第一/第三视角矩阵同步到 PlayCanvas 相机。
4. PLY 使用与 SuperSplat 一致的坐标变换；当前 RF-10 通过 Z 轴 180° 变换完成 Y 轴向上对齐。该变换已经过房间朝向验收，禁止在运行时重复叠加或擅自改轴。
5. RF-10 的验收以 SuperSplat 的真实场景效果为基准：房间上下方向正确、地板连续、无 Spark 圆斑/椭圆斑/漂浮点，且第三视角相机位于房间内部。
6. 深度采用第二路 Spark Gaussian pass：仅写入 Three.js 深度缓冲，不写颜色；深度 pass 必须使用透明度、屏幕半径和标准差过滤，禁止低透明度噪声 Gaussian 遮挡机器人脚部或其他细部。

这是一条真实场景发布路线，而不是 Spark 参数调优或临时 fallback。RF-10 使用 PlayCanvas 彩色 pass + Spark 深度 pass + Three.js 机器人/交互的双通道渲染组合；`IMG_7207_collider.glb` 作为低模碰撞兜底。深度层和碰撞层均不得直接显示，机器人在桌面、墙体和椅子后的遮挡必须稳定，脚部不得出现孤立圆斑遮挡。

### RF-02～07：普通 GLB 场景管线

共同结构：

1. 一个最终环境 GLB，负责墙体、地面、固定设施和背景视觉。
2. 多个独立交互 GLB，负责可拾取物、目标容器和任务道具。
3. Three.js GLTFLoader 加载；使用 Draco 时必须配置 /vendor/draco/。
4. 场景创建函数返回 assetReady，由主应用统一等待。
5. 资产成功后隐藏对应 fallback；资产失败不得被标记为成功。
6. 关卡逻辑只操作语义对象和状态，不直接依赖随机模型名称。

当前历史实现仍有差异：

- RF-02/03：Cardinal 静态切片 + EmbodiedGen 交互资产。
- RF-04：EmbodiedGen 最终住宅环境 + Cardinal 家具/洗衣交互资产。
- RF-05：程序化房间壳体 + Cardinal 家具/表面/交互资产。
- RF-06：EmbodiedGen 最终住宅环境 + EmbodiedGen 任务资产，Cardinal 家具属于可选增强。
- RF-07：EmbodiedGen BSL-2 实验室环境 + Cardinal 设备/交互资产。

这些差异是历史包袱，不应继续复制到新关卡。新关卡必须使用下述统一合同。

## 3. 标准资产交付包

每个新关卡使用以下目录：

~~~text
public/local-assets/levels/<level-id>/
├── models/runtime/
│   ├── <level-id>_final.glb
│   ├── <level-id>_collision.glb
│   ├── interactables/
│   │   ├── <object-a>.glb
│   │   └── <object-b>.glb
│   ├── generated_textures/
│   └── manifest.json
├── source/
└── README.md
~~~

### 3.1 最终环境 GLB

- 文件名固定为 <level-id>_final.glb。
- 包含静态墙、地面、门、固定设施和环境装饰。
- 不包含机器人、动态任务货物或碰撞专用网格。
- 单位为米，Y 轴向上，地面最低点接近 y=0。
- 必须有稳定节点名；可见节点不得依赖导出工具随机编号。
- 纹理必须内嵌在 GLB，不能依赖本地绝对路径。
- 允许 Draco 压缩，但必须通过浏览器解码验收。

### 3.2 碰撞 GLB

- 文件名固定为 <level-id>_collision.glb。
- 只包含静态碰撞网格，节点名统一使用 COLLIDER_<semantic-id>。
- 不渲染到视觉层；材质、纹理、灯光和摄像机全部可省略。
- 碰撞网格允许接近表面的三角网格，但必须去除细碎噪声、悬空片和封闭空气墙。
- 必须覆盖地面、外墙、固定大型设备和门框；门洞必须保持可通行。
- 碰撞 GLB 与最终环境 GLB 必须使用相同坐标系、原点、尺度和朝向。

### 3.3 交互 GLB

- 每个可拾取物、目标容器或任务道具一个独立 GLB。
- 文件名使用语义名，例如 wrench.glb、transport_case.glb。
- 必须嵌入纹理，保持真实尺寸和可复用原点。
- 动态状态优先使用同一模型的节点切换；只有几何差异显著时才拆分多个 GLB。

## 4. manifest.json 合同

每个关卡必须提供机器可读清单：

~~~json
{
  "schema": "arc-level-assets/v1",
  "level": "rfXX",
  "units": "meters",
  "environment": {
    "visual": "models/runtime/rfXX_final.glb",
    "collision": "models/runtime/rfXX_collision.glb"
  },
  "interactables": [
    {
      "id": "object-a",
      "path": "models/runtime/interactables/object-a.glb",
      "dimensions": [0.8, 1.2, 0.6],
      "support": "floor"
    }
  ],
  "optional": [],
  "compression": {
    "geometry": "draco",
    "decoderPath": "/vendor/draco/"
  },
  "validation": {
    "embeddedTextures": true,
    "stableNodeNames": true,
    "collisionReviewed": true
  }
}
~~~

environment.visual、environment.collision 和全部 interactables[].path 是发布必需资产。可选家具必须单独列在 optional，不能混入必需列表。

## 5. 运行时接口

每个关卡的 runtime.js 必须导出：

~~~js
export const LEVEL = ...;
export const ui = ...;
export const camera = ...;
export function createScene() { ... }
export function createCargoModel() { ... }
export function syncVisuals(world, state) { ... }
export function syncRobotCargo(robot, state) { ... }
~~~

createScene() 返回值至少包含 scene、assetReady、collisionReady、assetRoots。

assetReady 的成功结果：

~~~js
{ loaded: true, name, url, model }
~~~

失败结果：

~~~js
{ loaded: false, name, url, error }
~~~

禁止：

- 用 Promise.race 超时后把未完成资产当作可玩。
- 在失败后把 loaded 改成 true。
- 让 fallback 的存在掩盖最终资产失败。
- 在场景逻辑中重新发起同一个资产的第二套加载。

## 6. Three.js 加载约定

普通 GLB 场景统一使用：

~~~js
const dracoLoader = new DRACOLoader();
dracoLoader.setWorkerLimit(2);
dracoLoader.setDecoderPath("/vendor/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
~~~

服务器必须提供：

~~~text
public/vendor/draco/draco_decoder.js
public/vendor/draco/draco_decoder.wasm
public/vendor/draco/draco_wasm_wrapper.js
~~~

资产 URL 使用绝对公共路径，例如 /local-assets/levels/rfXX/models/runtime/rfXX_final.glb。

## 7. 视觉层、碰撞层和 fallback 生命周期

初始化顺序：

1. 创建场景节点和隐藏的碰撞根节点。
2. 创建最终环境根节点。
3. 创建交互对象槽位，槽位初始不可见。
4. 并行加载所有必需资产。
5. 环境和交互资产成功后切换可见性。
6. 碰撞资产成功后安装碰撞检测。
7. 全部必需资产成功后，主应用显示画布并启用开始按钮。

加载失败时保持画布隐藏，按钮显示“最终场景资产加载失败 · 点击重试”，不允许进入任务，并记录具体 name、url 和 error。

发布模式必须满足：

~~~text
最终资产成功 -> fallback.visible = false
最终资产失败 -> 不允许开始任务
~~~

## 8. 尺度、朝向和碰撞验收

生成资产时必须记录场景包围盒、门/走廊/桌面尺寸、玩家起点、交互点、碰撞包围盒和视觉/碰撞坐标变换。

最低验收要求：

1. 玩家出生点可行走。
2. 每个任务点存在至少一个可达交互位置。
3. 门洞、入口和开放通道没有空气墙。
4. 大型家具、墙体和固定设备不会穿模。
5. 视觉表面与碰撞表面误差在可接受范围内。
6. 碰撞网格不被渲染到视觉画面。

## 9. 批量生成流程

### A. 需求定义

先确定关卡 ID、任务目标、场景尺寸、坐标原点、玩家起点、相机、交互范围、固定对象、可拾取对象、目标对象、门洞和不可碰撞区域。

### B. 资产生成

生成：

1. <level-id>_final.glb
2. <level-id>_collision.glb
3. interactables/*.glb
4. manifest.json
5. layout.md 和审核截图

### C. 资产预处理

应用变换和单位归一化；清理摄像机、灯光和生成器节点；检查纹理内嵌；使用 Draco 压缩；检查节点名、原点、朝向和包围盒；独立可视化审核碰撞层。

### D. 运行时接入

实现 level.js、scene.js、runtime.js。必需资产全部挂入 assetReady；交互对象绑定语义 ID，不通过随机网格名判断任务。

### E. 自动验收

~~~bash
node --check game/levels/rfXX/scene.js
node --check game/levels/rfXX/runtime.js
npm run build
node --test tests/rfXX-*.test.mjs
~~~

浏览器必须确认：

~~~text
data-required-assets-ready="true"
data-world-assets-loaded == data-world-assets-total
开始按钮 = “开始任务”
~~~

并使用真实 WebGL 截图检查环境 GLB、纹理、灯光、阴影、尺度、无旧灰模和可达性。

## 10. 新关卡生成提示词模板

后续生成关卡时，将以下内容与需求一起提供：

~~~text
请严格遵循 docs/LEVEL_PRODUCTION_STANDARD.md。

关卡 ID：RF-XX
场景类型：
场景尺寸：
任务目标：
可拾取对象：
目标容器/目标位置：
玩家起点：
入口和门洞：
固定碰撞对象：
视觉风格：

必须交付：
1. <level-id>_final.glb
2. <level-id>_collision.glb
3. interactables/*.glb
4. manifest.json
5. layout.md
6. scene.js、runtime.js、level.js
7. 对应单元测试和浏览器加载验收

禁止复用旧关卡 fallback 作为发布资产；禁止用超时绕过加载门禁；禁止把加载失败标记为 loaded=true；禁止使用未登记的绝对路径或外部纹理；禁止渲染碰撞层。
~~~

## 11. 发布前检查表

- [ ] 最终环境 GLB 存在且能在浏览器解码
- [ ] 碰撞 GLB 存在且与视觉层坐标一致
- [ ] 全部交互 GLB 存在、纹理内嵌、尺寸正确
- [ ] manifest.json 与实际文件一致
- [ ] 所有 Draco 资产能访问 /vendor/draco/
- [ ] assetReady 覆盖全部必需资产
- [ ] 失败资产不会被 fallback 冒充
- [ ] 画布在门禁完成前保持隐藏
- [ ] data-required-assets-ready="true"
- [ ] 入口、门洞和任务点通过碰撞测试
- [ ] 浏览器截图通过人工视觉检查
- [ ] 构建和关卡测试通过

## 12. 规范化目标

从 RF-XX 开始，普通场景关卡只允许存在一套生产资产定义：

~~~text
manifest.json
    ↓
scene.js 加载 manifest 指定的 GLB
    ↓
assetReady 汇总最终资产
    ↓
app.js 统一门禁
    ↓
开始任务
~~~

任何程序化几何、旧环境、灰模和备用 GLB 都必须明确标记为开发诊断资源，不能成为发布链路中的隐式第二套真相。
