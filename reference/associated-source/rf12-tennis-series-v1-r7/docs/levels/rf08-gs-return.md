# RF-08 恢复 3DGS，保留无动态高斯的垃圾桶

2026-09-08 按用户反馈取消静态 GLB 及颜色合并版本，仅在 127.0.0.1 部署；49.233.44.228 不同步。

`runtime.js` 恢复 `scan-scene.js`：办公室使用 Spark 加载已分离目标垃圾桶并修补原位置的 `office.ply`。场景不加载 `office-static.glb`。静态实验文件保留作备份，不在 RF-08 运行时引用。

`bin.js` 仅创建不透明 Three.js 网格。地面和携带实例都不再创建 SplatMesh、请求 bin.ply 或应用高斯坐标变换，从源头移除可移动垃圾桶的高斯排序、透明混合残影路径。拾放仍使用原交互动画及 Rapier 碰撞，放下受阻时保持携带。

邻近第二个扫描垃圾桶是原场景真实物体，保持原位，不当成目标桶残影删除。

验证命令：

```sh
node --test tests/rf08-gs-bin.test.mjs tests/rf08-bin.test.mjs tests/rf08-office.test.mjs tests/office-scan-physics.test.mjs
npm run build
```

服务器浏览器验收脚本：`./tools/rf08-gs-review.mjs`，输出在 `./outputs/gs-return-20260908/`。测试通过请求拦截将机器人放在桶旁，正式出生点不变；执行拿起、后退、放下并记录截图及网络请求。
