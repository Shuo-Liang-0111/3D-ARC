# RF-08 颜色容差与去斑点预览

仅部署至 127.0.0.1。用户验收前不更新 49 服务器。

`tools/rf08-clean-colors.py` 读取现有静态 GLB，使用 3×3 中值滤波与双边滤波去除细小颜色噪点，再在 OpenCV Lab 空间按 L=10、a=6、b=6 的量化间隔合并相近颜色。量化间隔是 OpenCV 的 8 位 Lab 数值，不是标准 Delta E 阈值。

墙边平面和天花板使用统一暖白色材质，家具及地板保留颜色纹理。材质分区依据三角形坐标和朝向，适用于当前 RF-08 坐标系，不应直接复用到其他场景。碰撞数据和交互逻辑不变。

运行于服务器已有环境：

```sh
/opt/arc-runtime/envs/embodiedgen/bin/python tools/rf08-clean-colors.py INPUT.glb OUTPUT.glb
.tooling/gltf-transform/node_modules/.bin/gltf-transform prune OUTPUT.glb PACKED.glb
```

不要用输出再次作为输入反复量化。原始备份、颜色统计及同机位浏览器对比保存在 `./outputs/color-cleanup-20260908/`。清理后的 GLB 约 32.35 MB（十进制），不提交生成资产。

验收包括：白墙及走道前后截图、浏览器加载错误检查、RF-08 六项测试和生产构建。白墙灰度杂斑已显著减少；走道局部几何碎片、地板的大尺度斑驳仍存在，颜色合并不等于重新修复网格。
