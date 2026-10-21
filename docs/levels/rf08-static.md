# RF-08 静态扫描网格（82 服务器预览）

本次改动仅部署在 127.0.0.1，用户确认前不得同步 49.233.44.228。

办公室使用现有清理及垃圾桶分离后的 `public/office-scan/office.ply` 作为离线输入。gsplat 离线渲染 130 个室内 RGB-D 视角，Open3D TSDF 融合表面，Poisson 重建修复孔洞，xatlas 分区展开 UV，颜色样本烘焙为纹理。连续墙面和地板使用扫描颜色补全。输出为 `public/office-scan/office-static.glb`，约 32 万三角形、24 个网格、24 张 2K 嵌入纹理，约 62 MiB。

运行时 `static-scene.js` 使用 Three.js GLTFLoader 加载 GLB；RF-08 不再加载 Spark 或任何 PLY。GLB 使用世界 Y-up 坐标及 KHR_materials_unlit 保留烘焙外观，不再次应用扫描的旋转和平移。既有 Rapier 碰撞保持独立加载。

垃圾桶仅使用不透明 Three.js 网格，移除动态 Gaussian 子实例，拾取后隐藏地面对象，携带与放置遵循既有交互动画状态。静态网格不参与高斯排序或透明混合，消除了该路径的残影来源。

烘焙脚本：`./tools/rf08-bake.py`。过程缓存、预览、报告位于 `./outputs/static-bake-20260908/`，不提交生成资产。可从 `render`、`repair`、`partitions` 阶段恢复。GPU 渲染依赖 gsplat、Torch；网格及纹理处理依赖 Open3D、trimesh、xatlas、Numba、SciPy。

重建表面与原始 3DGS 外观并非完全相同：反光、玻璃、细杆和未充分拍摄区域会损失细节，补全区域为推断结果，尺度未经现场测量。当前版本是供用户在 82 验收的静态预览。

验证：

```sh
node --test tests/rf08-static.test.mjs tests/rf08-bin.test.mjs tests/rf08-office.test.mjs tests/office-scan-physics.test.mjs
npm run build
```
