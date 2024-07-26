`effects-runtime` 遵循 [Semantic Versioning 2.0.0](http://semver.org/lang/zh-CN/) 语义化版本规范。

#### 发布周期

- 修订版本号：每周末会进行日常 bugfix 更新（如果有紧急的 bugfix，则任何时候都可发布）。
- 次版本号：每月发布一个带有新特性的向下兼容的版本。
- 主版本号：含有破坏性更新和新特性，不在发布周期内。

---

## 1.6.5

`2024-07-26`

- Fix: 增加 Spine 元素新旧缩放规则下大小转换函数，兼容老版本问题。[#522](https://github.com/galacean/effects-runtime/pull/522) @RGCHN

## 1.6.4

`2024-07-19`

- Fix: 修复微信小程序 spine 和 model 插件的支持。[#507](https://github.com/galacean/effects-runtime/pull/507) @Sruimeng

## 1.6.3

`2024-07-12`

- Fix: Spine 插件缩放兼容相机水平裁切。[#500](https://github.com/galacean/effects-runtime/pull/500) @RGCHN

## 1.6.2

`2024-07-08`

- Fix: 修复当 variable 为 number 时文本设置失效问题。[#480](https://github.com/galacean/effects-runtime/pull/480) @Sruimeng
- Fix: 修复 camera 不在原点时的像素坐标转换错误。[#481](https://github.com/galacean/effects-runtime/pull/481) @RGCHN

## 1.6.1

`2024-07-02`

- Fix: 修复 fontSize 导致的文本布局问题。[#469](https://github.com/galacean/effects-runtime/pull/469) @Sruimeng

## 1.6.0

`2024-06-28`

- Feat: 增加交互元素控制参数。[#443](https://github.com/galacean/effects-runtime/pull/443) @RGCHN
- Feat: 增加加载时分段时长。[#442](https://github.com/galacean/effects-runtime/pull/442) @Sruimeng
- Feat: 增加合成和 Spine 元素接口。[#432](https://github.com/galacean/effects-runtime/pull/432) @RGCHN
- Build: 增加 alpha/beta 发布命令。[#434](https://github.com/galacean/effects-runtime/pull/434) @yiiqii
- Fix: 修复多行文字上下对齐问题。[#455](https://github.com/galacean/effects-runtime/pull/455) [#456](https://github.com/galacean/effects-runtime/pull/456) @Sruimeng
- Fix: transparent object sort problem. [#458](https://github.com/galacean/effects-runtime/pull/458) @liuxi150

## 1.5.2

`2024-06-21`

- Fix: base color index problem. [#441](https://github.com/galacean/effects-runtime/pull/441) @liuxi150

## 1.5.1

`2024-06-05`

- Fix: 增加 window 是否监听 WebGL Context Lost 事件开关。[#405](https://github.com/galacean/effects-runtime/pull/405) @liuxi150
- Chore: 修改 resizeRule 类型。[#407](https://github.com/galacean/effects-runtime/pull/407) @RGCHN

## 1.5.0

`2024-06-03`

- Feat: 增加支付宝小程序兼容和打包处理。[#370](https://github.com/galacean/effects-runtime/pull/370) @RGCHN
  - Feat: 降级插件支持小程序。[#385](https://github.com/galacean/effects-runtime/pull/385) @RGCHN
  - Build: 增加 alipay 小程序打包配置。[#388](https://github.com/galacean/effects-runtime/pull/388) @RGCHN
- Feat: Spine 升级和缩放规则修改。[#367](https://github.com/galacean/effects-runtime/pull/367) @RGCHN
- Fix: 移除 player 销毁时触发 webglcontextlost 事件。[#371](https://github.com/galacean/effects-runtime/pull/371) @RGCHN
- Test: fix frame compare. [#386](https://github.com/galacean/effects-runtime/pull/386) @liuxi150

## 1.4.5

`2024-05-29`

- Fix: 增加渲染过程中错误捕捉。[#380](https://github.com/galacean/effects-runtime/pull/380) @Sruimeng

## 1.4.4

`2024-05-17`

- Fix: 修复 iOS11/12 fontFamily 解析错误问题。[#356](https://github.com/galacean/effects-runtime/pull/356) [#361](https://github.com/galacean/effects-runtime/pull/361) @Sruimeng @yiiqii
- Fix: 兼容 Spine 产物没有 default 皮肤的情况。[#352](https://github.com/galacean/effects-runtime/pull/352) @RGCHN

## 1.4.3

`2024-05-14`

- Fix: 3d editor problem. [#344](https://github.com/galacean/effects-runtime/pull/344) @liuxi150

## 1.4.2

`2024-05-10`

- Feat: 陀螺仪以用户初始角度作变化基准。[#323](https://github.com/galacean/effects-runtime/pull/323) @RGCHN

## 1.4.1

`2024-05-06`

- Fix: BEZIER_CURVE_PATH 计算返回都改为 Vector3。[#326](https://github.com/galacean/effects-runtime/pull/326) @RGCHN

## 1.4.0

`2024-04-28`

- Feat: 支持贝塞尔速度和路径曲线处理。[#288](https://github.com/galacean/effects-runtime/pull/288) @RGCHN
- Fix: 修复贝塞尔积分和部分粒子卡顿问题。[#305](https://github.com/galacean/effects-runtime/pull/305) @RGCHN
- Test: 曲线相关单测更新。[#318](https://github.com/galacean/effects-runtime/pull/318) @RGCHN

## 1.3.2

`2024-04-26`

- Fix: 修复多次引用同一个预合成元素的渲染顺序问题。[#312](https://github.com/galacean/effects-runtime/pull/312) @RGCHN
- Fix: 预合成元素初始化时未创建的问题。[#309](https://github.com/galacean/effects-runtime/pull/309) @RGCHN
- Fix: 修复预合成缩放设置不生效的问题。[#296](https://github.com/galacean/effects-runtime/pull/296) @RGCHN

## 1.3.1

`2024-04-19`

- Fix: image template variables is images. [#282](https://github.com/galacean/effects-runtime/pull/282) @Sruimeng

## 1.3.0

`2024-04-16`

- Feat: 陀螺仪支持元素的旋转角度变化。[#259](https://github.com/galacean/effects-runtime/pull/259) @RGCHN
- Feat: video template。[#224](https://github.com/galacean/effects-runtime/pull/224) @Sruimeng

## 1.2.6

`2024-04-12`

- Fix: 修复更新顺序导致的图层大小继承问题。[#256](https://github.com/galacean/effects-runtime/pull/256) @RGCHN

## 1.2.5

`2024-04-09`

- Fix: 修复 reusable 时消息元素结束无法触发的问题。[#247](https://github.com/galacean/effects-runtime/pull/247) @RGCHN

## 1.2.4

`2024-04-08`

- Fix: 修复 assetManager 参数未隔离的问题。[#242](https://github.com/galacean/effects-runtime/pull/242) @RGCHN
- Fix: 修复 fonts 和 bins 文件路径问题。[#226](https://github.com/galacean/effects-runtime/pull/226) @RGCHN
- Fix: 修复像素和世界坐标转换错误。[#233](https://github.com/galacean/effects-runtime/pull/233) @RGCHN
- Fix: miniprogram canvas type. [#230](https://github.com/galacean/effects-runtime/pull/230) @Sruimeng

## 1.2.3

`2024-03-22`

- Fix: 兼容数据模板文本修改方式。[#214](https://github.com/galacean/effects-runtime/pull/214) @Sruimeng

## 1.2.2

`2024-03-15`

- Fix: 修复 `loadScene` 的类型推断问题。[#206](https://github.com/galacean/effects-runtime/pull/206) @RGCHN
- Fix: 修复 spine 动作切换闪烁问题。[#200](https://github.com/galacean/effects-runtime/pull/200) @RGCHN
- Fix: text line height bug with `setFontSize`. [#199](https://github.com/galacean/effects-runtime/pull/199) @Sruimeng
- Test: fix memory cases. [#190](https://github.com/galacean/effects-runtime/pull/190) @liuxi150

## 1.2.1

`2024-03-01`

- Fix: 修复 `Arraybuffer` 导致的 Spine 版本信息获取错误。[#179](https://github.com/galacean/effects-runtime/pull/179) @RGCHN
- Fix: add type assertion for `isString` util function. [#171](https://github.com/galacean/effects-runtime/pull/171) @zheeeng
- Fix: 增加 `loadScene` 中函数错误捕获。[#164](https://github.com/galacean/effects-runtime/pull/164) @RGCHN
- Fix: 修复 `AssetManager` 定时器未及时取消的问题。[#159](https://github.com/galacean/effects-runtime/pull/159) @RGCHN

## 1.2.0

`2024-01-30`

- Feat: Import spine-core by npm package instead of copy code. [#59](https://github.com/galacean/effects-runtime/pull/59) @RGCHN
  - Feat: 增加 TextDecoder 的 polyfill。[#125](https://github.com/galacean/effects-runtime/pull/125) @RGCHN
  - Feat: 增加 Spine 版本不匹配错误提示。[#127](https://github.com/galacean/effects-runtime/pull/127) @RGCHN
  - Fix: 修复 spine 帧对比和版本警告问题。[#154](https://github.com/galacean/effects-runtime/pull/154) @RGCHN
- Refactor: handleEnd 改为 onEnd 并注释。[#92](https://github.com/galacean/effects-runtime/pull/92) @RGCHN
- Refactor: 重构日志函数，采用独立函数实现。[#150](https://github.com/galacean/effects-runtime/pull/150) @RGCHN
- Fix(build): 修复 spine-core 不编译的问题。[#128](https://github.com/galacean/effects-runtime/pull/128) @yiiqii
- Perf: remove polyfill, add compat lint rules. [#126](https://github.com/galacean/effects-runtime/pull/126) @yiiqii
  - chore: replace Object.values with Object.keys
  - chore: update specification for remove Object.entries as it is not supported on low-end devices
  - build: add eslint plugin compat for auto check browser compatibility

## 1.1.8

`2024-01-26`

- Fix: windows shader compile problem and update case test player version. [#141](https://github.com/galacean/effects-runtime/pull/141) @liuxi150
- Fix: 修复合成重播时 Spine 元素的内存泄漏。[#116](https://github.com/galacean/effects-runtime/pull/116) @RGCHN
- Fix: 去除多余的 WebGL 版本不一致警告。[#115](https://github.com/galacean/effects-runtime/pull/115) @liuxi150
- Test: 修复预合成顺序单测。[#140](https://github.com/galacean/effects-runtime/pull/140) @RGCHN
- Style: 图片加载错误提示优化。[#143](https://github.com/galacean/effects-runtime/pull/143) @RGCHN

## 1.1.7

`2024-01-22`

- Fix: 修复预合成的渲染顺序问题。[#132](https://github.com/galacean/effects-runtime/pull/132) @RGCHN

## 1.1.6

`2024-01-16`

- Fix: 3d resize problem. [#118](https://github.com/galacean/effects-runtime/pull/118) @liuxi150

## 1.1.5

`2024-01-12`

- Fix: 增加编辑器错误的处理。[#107](https://github.com/galacean/effects-runtime/pull/107) @RGCHN
- Perf: 优化合成的时间跳转逻辑。[#106](https://github.com/galacean/effects-runtime/pull/106) @RGCHN
- Fix: 修复粒子重播时无法点击的问题。[#105](https://github.com/galacean/effects-runtime/pull/105) @RGCHN
- Fix(demo): iOS postMessage targetOrigin is required. [#104](https://github.com/galacean/effects-runtime/pull/104) @yiiqii

## 1.1.4

`2024-01-05`

- Fix: 合成销毁后画面未清空。[#91](https://github.com/galacean/effects-runtime/pull/91) @RGCHN
- Fix: 修复重复 load 时数据模板无法更新的问题。[#89](https://github.com/galacean/effects-runtime/pull/89) @RGCHN
- Fix: Spine 顶点超出限制的 batch 问题。[#86](https://github.com/galacean/effects-runtime/pull/86) @RGCHN
- Fix: 修复粒子和相机的跟随移动问题。[#85](https://github.com/galacean/effects-runtime/pull/85) @RGCHN
- Fix: 配置 reusable 时 spine 元素未按预期消失。[#84](https://github.com/galacean/effects-runtime/pull/84) @RGCHN
- Fix: spine 首帧无 mesh 时导致的渲染错误。[#82](https://github.com/galacean/effects-runtime/pull/82) @RGCHN
- Perf: 优化多次加载时的图片更新逻辑。[#96](https://github.com/galacean/effects-runtime/pull/96) @RGCHN
- Chore: add Github issue template. [#87](https://github.com/galacean/effects-runtime/pull/87) @zheeeng

## 1.1.3

`2023-12-22`

- Fix: Fix the frame drop problem caused by ticker. [#65](https://github.com/galacean/effects-runtime/pull/65) @wumaolinmaoan
- Fix: Spine 元素的纹理获取和动作设置问题。[#63](https://github.com/galacean/effects-runtime/pull/63) @RGCHN
- Fix: 多层蒙版穿透问题。[#60](https://github.com/galacean/effects-runtime/pull/60) @RGCHN
- Fix: Gizmo rendering problem. [#58](https://github.com/galacean/effects-runtime/pull/58) @liuxi150
- Fix: Render sprite incorrectly when config reusable caused by diff algorithm. [#45](https://github.com/galacean/effects-runtime/pull/45) @RGCHN
- Fix: Typo and refactor code style. [#24](https://github.com/galacean/effects-runtime/pull/24) @zheeeng
- Perf: Add JSON.stringify to show load error message. [#42](https://github.com/galacean/effects-runtime/pull/42) @RGCHN
- Chore: Update math library version. [#61](https://github.com/galacean/effects-runtime/pull/61) @liuxi150

## 1.1.2

`2023-12-19`

- Fix: Render bugs caused by diff algorithm and pre-comp. [#53](https://github.com/galacean/effects-runtime/pull/53) @RGCHN

## 1.1.1

`2023-12-14`

- Fix: Error about delay and disappear in pre-comp item. [#38](https://github.com/galacean/effects-runtime/pull/38) @RGCHN

## 1.1.0

`2023-12-11`

- Feat: 支持直接解析和播放预合成，统一数学库。[#3cd9c82](https://github.com/galacean/effects-runtime/commit/3cd9c8265013407f4aa9b52fe0c838e7ffecb66d)
- Fix: Solve pre composition problem in 3D plugin. [#27](https://github.com/galacean/effects-runtime/pull/27) @liuxi150
- Fix: Errors about visible and transform when setting. [#25](https://github.com/galacean/effects-runtime/pull/25) @RGCHN
- Fix: HitTest bug in pre-composition. [#9](https://github.com/galacean/effects-runtime/pull/9) @RGCHN
- Fix: 修复拖拽问题。[#8](https://github.com/galacean/effects-runtime/pull/8) @liuxi150
- Fix: Add id and transform setting from pre-composition item. [#5](https://github.com/galacean/effects-runtime/pull/5) @RGCHN
- Chore: Auto tigger bot review for specific branches. [#23](https://github.com/galacean/effects-runtime/pull/23) @zheeeng
- Test: Fix plugin unit test. [#28](https://github.com/galacean/effects-runtime/pull/28) @liuxi150
- Test: Fix unit and case test problems. [#26](https://github.com/galacean/effects-runtime/pull/26) @liuxi150
- Build: Support CHANGELOG generation script. [#4](https://github.com/galacean/effects-runtime/pull/4) @yiiqii
- Build: Add vite legacy polyfill. [#29](https://github.com/galacean/effects-runtime/pull/29) @yiiqii

## 1.0.1

`2023-12-04`

- Feat: Add name suggestion after player dispose. [#6](https://github.com/galacean/effects-runtime/pull/6) @RGCHN
- Fix: Plugin error message optimization. [#10](https://github.com/galacean/effects-runtime/pull/10) @liuxi150
- Fix: setRotation does not work after rotate in transform. [#11](https://github.com/galacean/effects-runtime/pull/11) @RGCHN
- Chore: Add dependabot. [#14](https://github.com/galacean/effects-runtime/pull/14) @zheeeng
- Chore: Add top language and license badge for README.md. [#13](https://github.com/galacean/effects-runtime/pull/13) @zheeeng

## 1.0.0

`2023-11-21`

init
