`effects-runtime` 遵循 [Semantic Versioning 2.0.0](http://semver.org/lang/zh-CN/) 语义化版本规范。

#### 发布周期

- 修订版本号：每周末会进行日常 bugfix 更新（如果有紧急的 bugfix，则任何时候都可发布）。
- 次版本号：每月发布一个带有新特性的向下兼容的版本。
- 主版本号：含有破坏性更新和新特性，不在发布周期内。

---

## 2.6.8

`2025-10-17`

- Fix: bind pose color value reference issue. [#1231](https://github.com/galacean/effects-runtime/pull/1231) @wumaolinmaoan

## 2.6.7

`2025-10-10`

- Fix: text texture not released issue. [#1222](https://github.com/galacean/effects-runtime/pull/1222) @wumaolinmaoan

## 2.6.6

`2025-09-10`

- Fix: incorrect frame comparison pixel read. [#1180](https://github.com/galacean/effects-runtime/pull/1180) @Fryt1
- Fix: spine bounding box issue. [#1182](https://github.com/galacean/effects-runtime/pull/1182) @wumaolinmaoan

## 2.6.5

`2025-08-29`

- Fix: video `gotoAndStop` func. [#1159](https://github.com/galacean/effects-runtime/pull/1159) @ChengYi996

## 2.6.4

`2025-08-26`

- Fix: add video assets dispose logic. [#1157](https://github.com/galacean/effects-runtime/pull/1157) @wumaolinmaoan

## 2.6.3

`2025-08-22`

- Fix: the adapter returns a string when loading JSON from a relative path in the miniprogram. [#1145](https://github.com/galacean/effects-runtime/pull/1145) @yiiqii
- Fix: plain object judgment. [#1147](https://github.com/galacean/effects-runtime/pull/1147) @wumaolinmaoan

## 2.6.2

`2025-08-15`

- Fix: 3d editor mode demo. [#1112](https://github.com/galacean/effects-runtime/pull/1112) @wumaolinmaoan
- Fix: rendering scale was incorrect after setting the scale of spine. [#1132](https://github.com/galacean/effects-runtime/pull/1132) @wumaolinmaoan
  - Fix: spine start scale issue. [#1136](https://github.com/galacean/effects-runtime/pull/1136) @wumaolinmaoan

## 2.6.1

`2025-08-12`

- Fix: spine set animation list render issue. [#1128](https://github.com/galacean/effects-runtime/pull/1128) @wumaolinmaoan

## 2.6.0

`2025-07-29`

- Feat: add animation graph system. [#1064](https://github.com/galacean/effects-runtime/pull/1064) @wumaolinmaoan
  - Feat: add layer blend node data. [#1086](https://github.com/galacean/effects-runtime/pull/1086) @wumaolinmaoan
  - Chore: update imgui inspector panel. [#1087](https://github.com/galacean/effects-runtime/pull/1087) @wumaolinmaoan
  - Chore: update spec to 2.5.0. [#1091](https://github.com/galacean/effects-runtime/pull/1091) @wumaolinmaoan
  - Chore: update spec to 2.5.1. [#1095](https://github.com/galacean/effects-runtime/pull/1095) @wumaolinmaoan
  - Fix: reset sprite animation time when component disable. [#1092](https://github.com/galacean/effects-runtime/pull/1092) @wumaolinmaoan
  - Fix: 3d json converter type issue. [#1097](https://github.com/galacean/effects-runtime/pull/1097) @wumaolinmaoan
  - Fix: spine setAnimationListLoopEnd invalid issue. [#1099](https://github.com/galacean/effects-runtime/pull/1099) @wumaolinmaoan
  - Fix: migration add json version modify. [#1107](https://github.com/galacean/effects-runtime/pull/1107) @wumaolinmaoan
- Feat: add player and composition play/pause/resume events. [#1079](https://github.com/galacean/effects-runtime/pull/1079) @yiiqii
  - Fix: compatible player update logic, only emit when playing is true. [#1093](https://github.com/galacean/effects-runtime/pull/1093) @yiiqii
  - Chore: revert player update. [#1105](https://github.com/galacean/effects-runtime/pull/1105) @yiiqii
- Feat: drag event support border range invalid. [#1106](https://github.com/galacean/effects-runtime/pull/1106) @yiiqii
- Refactor: transform initialization. [#1076](https://github.com/galacean/effects-runtime/pull/1076) @wumaolinmaoan
- Refactor: mask processor. [#1108](https://github.com/galacean/effects-runtime/pull/1108) @wumaolinmaoan
- Fix: triggering issue of message item during reverse playback. [#1103](https://github.com/galacean/effects-runtime/pull/1103) @wumaolinmaoan
- Chore: remove unused particle-system function. [#1085](https://github.com/galacean/effects-runtime/pull/1085) @yiiqii

## 2.5.6

`2025-07-24`

- Fix: implemented a check for the BOM object in SSR environments before usage. [#1100](https://github.com/galacean/effects-runtime/pull/1100) @yiiqii
- Fix: touchcancel event unbind. [#1096](https://github.com/galacean/effects-runtime/pull/1096) @yiiqii

## 2.5.5

`2025-07-21`

- Fix: revert overflow fix. [#1088](https://github.com/galacean/effects-runtime/pull/1088) @Fryt1

## 2.5.4

`2025-07-17`

- Fix: 修复文本行数判断错误导致文本上移的问题。[#1080](https://github.com/galacean/effects-runtime/pull/1080) @Fryt1
- Fix: add video.play error processing in loadVideo. [#1081](https://github.com/galacean/effects-runtime/pull/1081) @wumaolinmaoan
- Fix: lockdown mode just check in iOS env. [#1078](https://github.com/galacean/effects-runtime/pull/1078) @yiiqii

## 2.5.3

`2025-07-11`

- Fix: composition autoplay issue. [#1069](https://github.com/galacean/effects-runtime/pull/1069) @wumaolinmaoan
  - Fix: composition play issue. [#1071](https://github.com/galacean/effects-runtime/pull/1071) @wumaolinmaoan
- Fix: bezier path build const bezier easing. [#1070](https://github.com/galacean/effects-runtime/pull/1070) @wumaolinmaoan

## 2.5.2

`2025-07-09`

- Fix: opt canvas dispose logic. [#1067](https://github.com/galacean/effects-runtime/pull/1067) @wumaolinmaoan

## 2.5.1

`2025-07-04`

- Fix: text render issue. [#1062](https://github.com/galacean/effects-runtime/pull/1062) @wumaolinmaoan

## 2.5.0

`2025-07-04`
- Feat: sprite component support custom geometry. [#1021](https://github.com/galacean/effects-runtime/pull/1021) @wumaolinmaoan
  - Fix: sprite geometry split rotate. [#1053](https://github.com/galacean/effects-runtime/pull/1053) @wumaolinmaoan
  - Fix: sprite split rotate issue. [#1055](https://github.com/galacean/effects-runtime/pull/1055) @wumaolinmaoan
- Feat: support custom stats metric callbacks. [#1036](https://github.com/galacean/effects-runtime/pull/1036) @yiiqii
- Feat: add runtime version check. [#1041](https://github.com/galacean/effects-runtime/pull/1041) @yiiqii
- Feat: add alpha mask option. [#1042](https://github.com/galacean/effects-runtime/pull/1042) @wumaolinmaoan
- Refactor: sprite shape geometry generation logic. [#1005](https://github.com/galacean/effects-runtime/pull/1005) @wumaolinmaoan
- Refactor: sprite geometry initialization. [#1048](https://github.com/galacean/effects-runtime/pull/1048) @wumaolinmaoan
- Perf: opt bezier evaluation performance. [#1059](https://github.com/galacean/effects-runtime/pull/1059) @wumaolinmaoan
- Fix: type issues. [#1008](https://github.com/galacean/effects-runtime/pull/1008) @zheeeng
- Fix: optimize Player dispose processing during loadScene. [#1037](https://github.com/galacean/effects-runtime/pull/1037) @wumaolinmaoan
- Fix: baseRender splits processing. [#1046](https://github.com/galacean/effects-runtime/pull/1046) @wumaolinmaoan
- Fix: text autosize. [#1050](https://github.com/galacean/effects-runtime/pull/1050) @Fryt1
- Fix: video update. [#1051](https://github.com/galacean/effects-runtime/pull/1051) @wumaolinmaoan
- Fix: ignore shader textures compile error. [#1054](https://github.com/galacean/effects-runtime/pull/1054) @wumaolinmaoan
- Fix: audio asset loading. [#1056](https://github.com/galacean/effects-runtime/pull/1056) @wumaolinmaoan
- Test: update pre runtime version for test. [#1047](https://github.com/galacean/effects-runtime/pull/1047) @yiiqii

## 2.4.8

`2025-06-27`

- Fix: rich-text character overlapping bug. [#1040](https://github.com/galacean/effects-runtime/pull/1040) @Fryt1
- Fix: composition freeze issue. [#1035](https://github.com/galacean/effects-runtime/pull/1035) @wumaolinmaoan

## 2.4.7

`2025-06-13`

- Fix: pre composition mask migration error. [#1030](https://github.com/galacean/effects-runtime/pull/1030) @wumaolinmaoan
- Fix: video will be downloaded twice when loaded using the assetManager. [#1029](https://github.com/galacean/effects-runtime/pull/1029) @wumaolinmaoan

## 2.4.6

`2025-06-06`

- Fix: particle hitTest is invalid. [#1023](https://github.com/galacean/effects-runtime/pull/1023) @wumaolinmaoan
- Fix: 3d mesh component modifies the original data. [#1022](https://github.com/galacean/effects-runtime/pull/1022) @wumaolinmaoan

## 2.4.5

`2025-05-28`

- Fix: spine and particle mask. [#1018](https://github.com/galacean/effects-runtime/pull/1018) @wumaolinmaoan

## 2.4.4

`2025-05-28`

- Fix: 修复 Spine 滤色模式问题。[#1011](https://github.com/galacean/effects-runtime/pull/1011) @RGCHN
- Fix: old json texture mask migration. [#1012](https://github.com/galacean/effects-runtime/pull/1012) @wumaolinmaoan
  - Fix: alpha mask default value. [#1013](https://github.com/galacean/effects-runtime/pull/1013) @wumaolinmaoan

## 2.4.3

`2025-05-21`

- Fix: harmony device detection. [#1006](https://github.com/galacean/effects-runtime/pull/1006) @wumaolinmaoan

## 2.4.2

`2025-05-16`

- Fix: 视频不重播、循环播放时闪烁。[#995](https://github.com/galacean/effects-runtime/pull/995) @yuufen
- Fix: rich text plugin name migration. [#999](https://github.com/galacean/effects-runtime/pull/999) @wumaolinmaoan

## 2.4.1

`2025-05-15`

- Fix: mask is still drawn when the component is not activated. [#993](https://github.com/galacean/effects-runtime/pull/993) @wumaolinmaoan
- Fix: recover when plugins not import will console the install tips. [#991](https://github.com/galacean/effects-runtime/pull/991) @yiiqii
- Fix: mask value distribution cache error. [#989](https://github.com/galacean/effects-runtime/pull/989) @wumaolinmaoan
- Fix: loaded composition array order is wrong. [#990](https://github.com/galacean/effects-runtime/pull/990) @wumaolinmaoan

## 2.4.0

`2025-05-14`

- Feat: 图像蒙版和指向性蒙版。[#901](https://github.com/galacean/effects-runtime/pull/901) @RGCHN
  - Feat: support mask render. [#982](https://github.com/galacean/effects-runtime/pull/982) @wumaolinmaoan
  - Fix: remove `setMaskMode` color mask parameter. [#984](https://github.com/galacean/effects-runtime/pull/984) @wumaolinmaoan
  - Fix: 增加蒙版相关版本转换处理。[#940](https://github.com/galacean/effects-runtime/pull/940) @RGCHN
  - Fix: 增加富文本元素的蒙版数据兼容。[#952](https://github.com/galacean/effects-runtime/pull/952) @RGCHN
  - Fix: mask draw order. [#977](https://github.com/galacean/effects-runtime/pull/977) @wumaolinmaoan
- Feat: shape support anchor and renderer settings. [#954](https://github.com/galacean/effects-runtime/pull/954) @wumaolinmaoan
- Feat: root item support multiple components. [#957](https://github.com/galacean/effects-runtime/pull/957) @wumaolinmaoan
- Refactor: remove redundant properties in `BaseRenderComponent`. [#941](https://github.com/galacean/effects-runtime/pull/941) @wumaolinmaoan
  - Refactor: remove composition source manager. [#945](https://github.com/galacean/effects-runtime/pull/945) @wumaolinmaoan
  - Refactor: `baseRenderComponent` material create. [#949](https://github.com/galacean/effects-runtime/pull/949) @wumaolinmaoan
  - Refactor: `baseRenderComponent` `setItem` logic. [#950](https://github.com/galacean/effects-runtime/pull/950) @wumaolinmaoan
  - Fix: 3d frame test. [#959](https://github.com/galacean/effects-runtime/pull/959) @wumaolinmaoan
- Refactor: effectsObject deserialization logic. [#961](https://github.com/galacean/effects-runtime/pull/961) @wumaolinmaoan
- Refactor: interact message trigger logic. [#973](https://github.com/galacean/effects-runtime/pull/973) @wumaolinmaoan
  - Fix: unit test. [#983](https://github.com/galacean/effects-runtime/pull/983) @wumaolinmaoan
- Fix: old shape data null check. [#960](https://github.com/galacean/effects-runtime/pull/960) @wumaolinmaoan
- Fix: interact item start time judgment. [#962](https://github.com/galacean/effects-runtime/pull/962) @wumaolinmaoan
  - Revert. [#970](https://github.com/galacean/effects-runtime/pull/970) @wumaolinmaoan
- Chore: add hit test demo page. [#955](https://github.com/galacean/effects-runtime/pull/955) @wumaolinmaoan
- Chore: update spec and resource-detection. [#958](https://github.com/galacean/effects-runtime/pull/958) @yiiqii

## 2.3.6

`2025-05-13`

- Fix: video pause error. [#985](https://github.com/galacean/effects-runtime/pull/985) @wumaolinmaoan

## 2.3.5

`2025-05-12`

- Fix: player hit test. [#974](https://github.com/galacean/effects-runtime/pull/974) @wumaolinmaoan
- Fix: 修复 Spine 混合模式渲染问题。[#972](https://github.com/galacean/effects-runtime/pull/972) @RGCHN

## 2.3.4

`2025-05-09`

- Fix: spine 无法循环最后一个动作。[#965](https://github.com/galacean/effects-runtime/pull/965) @RGCHN
- Test: add shape k frame property unit test. [#939](https://github.com/galacean/effects-runtime/pull/939) @wumaolinmaoan

## 2.3.3

`2025-04-18`

- Fix: custom shape do not draw the last segment when not closed. [#951](https://github.com/galacean/effects-runtime/pull/951) @wumaolinmaoan

## 2.3.2

`2025-04-13`

- Fix: camera rotation initialization. [#942](https://github.com/galacean/effects-runtime/pull/942) @wumaolinmaoan

## 2.3.1

`2025-04-03`

- Fix: shape control point use relative coordinates. [#930](https://github.com/galacean/effects-runtime/pull/930) @wumaolinmaoan
- Fix: scene load autoplay options invalid. [#931](https://github.com/galacean/effects-runtime/pull/931) @wumaolinmaoan
- Fix: webgl restore. [#932](https://github.com/galacean/effects-runtime/pull/932) @wumaolinmaoan

## 2.3.0

`2025-04-02`

- Feat: 增加安卓默认使用 WebGL2 的逻辑。[#861](https://github.com/galacean/effects-runtime/pull/861) @RGCHN
- Feat: 扩展 `setTexture` 方法，支持直接传入资源链接。[#862](https://github.com/galacean/effects-runtime/pull/862) @Sruimeng
- Feat: shape component support multi-shape and stroke attribute. [#870](https://github.com/galacean/effects-runtime/pull/870) @wumaolinmaoan
  - Feat: shape support both stroke and fill. [#899](https://github.com/galacean/effects-runtime/pull/899) @wumaolinmaoan
  - Feat: support custom shape close attribute. [#902](https://github.com/galacean/effects-runtime/pull/902) @wumaolinmaoan
  - Fix: shape bounding box error when draw line. [#896](https://github.com/galacean/effects-runtime/pull/896) @wumaolinmaoan
  - Fix: primitive shape default close path and build line return Nan when dist is zero. [#920](https://github.com/galacean/effects-runtime/pull/920) @wumaolinmaoan
- Feat: add vector2 curve. [#878](https://github.com/galacean/effects-runtime/pull/878) @wumaolinmaoan
- Feat: support rectangle roundness. [#891](https://github.com/galacean/effects-runtime/pull/891) @wumaolinmaoan
- Feat: support vector animation. [#882](https://github.com/galacean/effects-runtime/pull/882) @wumaolinmaoan
  - Refactor: remove vector property mixer setZero function call. [#883](https://github.com/galacean/effects-runtime/pull/883) @wumaolinmaoan
  - Feat: primitive shape support key frame animation. [#884](https://github.com/galacean/effects-runtime/pull/884) @wumaolinmaoan
- Feat: particle follow emitter transform. [#887](https://github.com/galacean/effects-runtime/pull/887) @wumaolinmaoan
- Feat: composition component add pause and resume. [#903](https://github.com/galacean/effects-runtime/pull/903) @wumaolinmaoan
- Feat: 初始化 `Player` 的参数增加 `onError`，支持捕获 `new Player` 或 `loadScene` 时的所有异常。[#905](https://github.com/galacean/effects-runtime/pull/905) @yiiqii
- Feat: 支持动态修改最大粒子数。[#913](https://github.com/galacean/effects-runtime/pull/913) @RGCHN
  - Feat: opt max particles properties name and note. [#918](https://github.com/galacean/effects-runtime/pull/918) @wumaolinmaoan
- Feat: 开放 multimedia 插件的视频播放和暂停方法，并修复视频 freeze 逻辑。[#871](https://github.com/galacean/effects-runtime/pull/871) @Sruimeng
- Feat: enhance video component for transparent video support. [#888](https://github.com/galacean/effects-runtime/pull/888) @Sruimeng
  - Fix: improve alpha blending in transparent video shader. [#907](https://github.com/galacean/effects-runtime/pull/907) @Sruimeng
- Feat: 添加富文本组件不支持的方法实现。[#892](https://github.com/galacean/effects-runtime/pull/892) @Sruimeng
- Feat: 添加文本溢出模式支持，优化文本行数计算。[#898](https://github.com/galacean/effects-runtime/pull/898) @Sruimeng
  - Fix: 修复文本组件行数计算和字体描述逻辑。[#927](https://github.com/galacean/effects-runtime/pull/927) @Sruimeng
- Feat(rich-text): 增加富文本大小参数支持，重构文本渲染逻辑。[#900](https://github.com/galacean/effects-runtime/pull/900) @Sruimeng
- Feat(rich-text): 支持字母间距调整，优化文本渲染逻辑。[#906](https://github.com/galacean/effects-runtime/pull/906) @Sruimeng
- Fix: camera view matrix calculate. [#912](https://github.com/galacean/effects-runtime/pull/912) @wumaolinmaoan
- Fix: 优化 `ThreeMaterial` 中颜色和统一变量的处理。[#917](https://github.com/galacean/effects-runtime/pull/917) @Sruimeng
- Fix: geometry bounding box. [#915](https://github.com/galacean/effects-runtime/pull/915) @wumaolinmaoan
- Fix: camera gesture rotation. [#926](https://github.com/galacean/effects-runtime/pull/926) @wumaolinmaoan
- Refactor: 重构 `version31Migration` 函数及其计算位置。[#890](https://github.com/galacean/effects-runtime/pull/890) @Sruimeng
- Refactor: base render component set color use math.Color type. [#908](https://github.com/galacean/effects-runtime/pull/908) @wumaolinmaoan
  - Fix: sprite color unit test. [#910](https://github.com/galacean/effects-runtime/pull/910) @wumaolinmaoan
- Refactor: scene load and pre composition instantiation logic. [#909](https://github.com/galacean/effects-runtime/pull/909) @wumaolinmaoan
  - Refactor: THREE 插件跟随 `Player` 的 `loadScene` 多合成改造。[#928](https://github.com/galacean/effects-runtime/pull/928) @yiiqii
    - test: 补充帧对比测试案例
    - fix: typo issue
  - Refactor: plugin system register and precompile logic. [#922](https://github.com/galacean/effects-runtime/pull/922) @wumaolinmaoan
    - fix 3d rendering error caused by precompile timing
  - Fix: composition index issue. [#921](https://github.com/galacean/effects-runtime/pull/921) @yiiqii
  - Fix: 3d unit test. [#923](https://github.com/galacean/effects-runtime/pull/923) @wumaolinmaoan
- Perf: 移除 `string-hash` 依赖，统一使用内部方法。[#877](https://github.com/galacean/effects-runtime/pull/877) @yiiqii
- Build: 对小程序产物进行 minify 处理。[#911](https://github.com/galacean/effects-runtime/pull/911) @yiiqii
- Chore: 替换 Spine 多合成 demo 使用的资源。[#919](https://github.com/galacean/effects-runtime/pull/919) @RGCHN

## 2.2.7

`2025-02-28`

- Fix: 曲线起止采点不区分关键帧类型。[#889](https://github.com/galacean/effects-runtime/pull/889) @RGCHN

## 2.2.6

`2025-02-21`

- Fix: 修复富文本插件名称。[#873](https://github.com/galacean/effects-runtime/pull/873) @Sruimeng
- Fix: 修复定格关键帧结尾的错误。[#876](https://github.com/galacean/effects-runtime/pull/876) @RGCHN
- Fix: 修复 player 销毁后，事件系统报错。[#872](https://github.com/galacean/effects-runtime/pull/872) @Sruimeng
- Chore(deps): bump @vvfx/resource-detection to 0.7.1. [#875](https://github.com/galacean/effects-runtime/pull/875) @yiiqii

## 2.2.5

`2025-02-14`

- Fix: 修复富文本渲染白屏问题。[#857](https://github.com/galacean/effects-runtime/pull/857) @Sruimeng
- Fix: 移除粒子点击后会多移除一个的逻辑。[#863](https://github.com/galacean/effects-runtime/pull/863) @RGCHN
- Fix: 移除 http 请求 response 代码 0 表示成功的逻辑。[#860](https://github.com/galacean/effects-runtime/pull/860) @RGCHN
- Fix: 3d mesh max joint and camera rotation error. [#858](https://github.com/galacean/effects-runtime/pull/858) @wumaolinmaoan

## 2.2.4

`2025-02-07`

- Fix: update texture and material in TextComponentBase. [#855](https://github.com/galacean/effects-runtime/pull/855) @Sruimen

## 2.2.3

`2025-02-07`

- Fix: interact item drag invalid when delayed. [#849](https://github.com/galacean/effects-runtime/pull/849) @wumaolinmaoan
- Fix: 修复文本遮罩问题。[#848](https://github.com/galacean/effects-runtime/pull/848) @Sruimeng
- Fix: opt render level filter logic. [#844](https://github.com/galacean/effects-runtime/pull/844) @wumaolinmaoan
- Chore: add gl lost check when framebuffer failed. [#841](https://github.com/galacean/effects-runtime/pull/841) @wumaolinmaoan

## 2.2.2

`2025-01-13`

- Chore: add framebuffer creation failed error. [#836](https://github.com/galacean/effects-runtime/pull/836) @wumaolinmaoan

## 2.2.1

`2025-01-03`

- Fix: 修复安卓机富文本字重问题。[#824](https://github.com/galacean/effects-runtime/pull/824) @Sruimeng
- Fix: bounding box offset. [#822](https://github.com/galacean/effects-runtime/pull/822) @wumaolinmaoan

## 2.2.0

`2024-12-31`

- Feat: 优化富文本大小处理，文本支持垂直对齐。[#789](https://github.com/galacean/effects-runtime/pull/789) @Sruimeng
- Feat: 增加富文本 `overflow` 接口。[#813](https://github.com/galacean/effects-runtime/pull/813) @Sruimeng
- Feat: 增加是否禁用 `avif/webp` 参数。[#805](https://github.com/galacean/effects-runtime/pull/805) @RGCHN
- Feat: 导出 rich-text-loader。[#814](https://github.com/galacean/effects-runtime/pull/814) @yiiqii
- Refactor: 重构 Stats 插件初始化入参，支持自定义容器和是否可见。[#798](https://github.com/galacean/effects-runtime/pull/798) @yiiqii
- Refactor: timeline playables structure. [#788](https://github.com/galacean/effects-runtime/pull/788) @wumaolinmaoan
- Perf: opt timeline evaluate performance. [#809](https://github.com/galacean/effects-runtime/pull/809) @wumaolinmaoan
- Fix: item render order. [#816](https://github.com/galacean/effects-runtime/pull/816) @wumaolinmaoan
- Fix: 修复 WebGL 创建失败， player 销毁报错问题。[#817](https://github.com/galacean/effects-runtime/pull/817) @Sruimeng
- Fix: 修复 threejs 渲染报错。[#818](https://github.com/galacean/effects-runtime/pull/818) @Sruimeng
- Chore: upgrade devDependencies. [#793](https://github.com/galacean/effects-runtime/pull/793) @yiiqii

## 2.1.5

`2024-12-27`

- Fix: 修复消息元素触发问题。[#801](https://github.com/galacean/effects-runtime/pull/801) @Sruimeng
  - Fix: message item triggering issue caused by time accuracy. [#804](https://github.com/galacean/effects-runtime/pull/804) @wumaolinmaoan
- Fix: player fps setting. [#802](https://github.com/galacean/effects-runtime/pull/802) @wumaolinmaoan

## 2.1.4

`2024-12-20`

- Perf: opt sprite shader alpha clip performance. [#794](https://github.com/galacean/effects-runtime/pull/794) @wumaolinmaoan
- Test: 完善部分单测类型，优化帧对比失败提示。[#792](https://github.com/galacean/effects-runtime/pull/792) @yiiqii

## 2.1.3

`2024-12-16`

- Perf: opt particle rotation calculate performance. [#787](https://github.com/galacean/effects-runtime/pull/787) @wumaolinmaoan
- Fix: 修复富文本自定义字体问题。[#784](https://github.com/galacean/effects-runtime/pull/784) @Sruimeng
- Fix: restore default font settings in richtext component rendering. [#781](https://github.com/galacean/effects-runtime/pull/781) @Sruimeng
- Fix: particle system rotation over lifetime always exist. [#779](https://github.com/galacean/effects-runtime/pull/779) @wumaolinmaoan
- Fix: 补充新增插件的使用时未 install 提示。[#778](https://github.com/galacean/effects-runtime/pull/778) @yiiqii
- Fix: support rich text type in player and enhance rich text component. [#777](https://github.com/galacean/effects-runtime/pull/777) @Sruimeng
- Fix: 兼容 SSR 环境 BOM 对象使用前的判断。[#767](https://github.com/galacean/effects-runtime/pull/767) @RGCHN
  - Refactor: avoid BOM access when server-side rendering. [#782](https://github.com/galacean/effects-runtime/pull/782) @PeachScript
  - Fix: return can only be used within a function body. [#783](https://github.com/galacean/effects-runtime/pull/783) @yiiqii
- Fix: texture source from cache error. [#775](https://github.com/galacean/effects-runtime/pull/775) @wumaolinmaoan
- Fix: sprite billboard. [#774](https://github.com/galacean/effects-runtime/pull/774) @wumaolinmaoan
- Fix: track bindings are set incorrectly when there are reused precompositions. [#773](https://github.com/galacean/effects-runtime/pull/773) @wumaolinmaoan
- Test: 整理并优化帧对比测试代码。[#780](https://github.com/galacean/effects-runtime/pull/780) @yiiqii
- Chore: imgui add node graph. [#786](https://github.com/galacean/effects-runtime/pull/786) @wumaolinmaoan

## 2.1.2

`2024-11-29`

- Fix: 修复播放器尺寸计算逻辑，确保在不同环境下正确获取宽高。[#762](https://github.com/galacean/effects-runtime/pull/762) @Sruimeng
- Fix: composition setVisible and texture load error. [#764](https://github.com/galacean/effects-runtime/pull/764) @wumaolinmaoan
- Fix: interact mesh rendering has offset. [#768](https://github.com/galacean/effects-runtime/pull/768) @wumaolinmaoan
- Chore: update frame test old player versio. [#770](https://github.com/galacean/effects-runtime/pull/770) @wumaolinmaoan
- Chore: imgui add object field. [#771](https://github.com/galacean/effects-runtime/pull/771) @wumaolinmaoan
  - opt imgui assets loading logic
- Chore: add imgui widgets. [#765](https://github.com/galacean/effects-runtime/pull/765) @wumaolinmaoan

## 2.1.1

`2024-11-26`

- Fix: spine transform update. [#758](https://github.com/galacean/effects-runtime/pull/758) @wumaolinmaoan
  - fix: interact mesh render error
  - fix: shape data null check
  - fix: composition not rendered when auto play false
  - Fix: player auto play false rendering. [#759](https://github.com/galacean/effects-runtime/pull/759) @wumaolinmaoan
- Fix: time precision issues caused by floating point errors. [#757](https://github.com/galacean/effects-runtime/pull/757) @wumaolinmaoan

## 2.1.0

`2024-11-20`

- Feat: cpu particle system. [#613](https://github.com/galacean/effects-runtime/pull/613) @wumaolinmaoan
  - Feat: 增加编译耗时的统计。[#660](https://github.com/galacean/effects-runtime/pull/660) @yiiqii
  - Refactor: expand particle calculation function. [#632](https://github.com/galacean/effects-runtime/pull/632) @wumaolinmaoan
  - Perf: opt CPU particle computing performance. [#623](https://github.com/galacean/effects-runtime/pull/623) @wumaolinmaoan
  - Perf: reduce object gc during particle update. [#627](https://github.com/galacean/effects-runtime/pull/627) @wumaolinmaoan
  - Perf: opt particle calculation performance. [#644](https://github.com/galacean/effects-runtime/pull/644) @wumaolinmaoan
  - Fix: particle linear move calculate. [#641](https://github.com/galacean/effects-runtime/pull/641) @wumaolinmaoan
  - Fix: unit test and particle draw count warning. [#654](https://github.com/galacean/effects-runtime/pull/654) @wumaolinmaoan
  - Fix: composition time reset. [#658](https://github.com/galacean/effects-runtime/pull/658) @wumaolinmaoan
  - Fix: particle reset. [#659](https://github.com/galacean/effects-runtime/pull/659) @wumaolinmaoan
- Feat: effect component uses track time. [#640](https://github.com/galacean/effects-runtime/pull/640) @wumaolinmaoan
- Feat: support diffuse render mode and add demo for editor mode. [#643](https://github.com/galacean/effects-runtime/pull/643) @liuxi150
- Feat: bloom support transparency. [#651](https://github.com/galacean/effects-runtime/pull/651) @wumaolinmaoan
- Feat: add shape component. [#665](https://github.com/galacean/effects-runtime/pull/665) @wumaolinmaoan
  - Feat: add curve property track. [#679](https://github.com/galacean/effects-runtime/pull/679) @wumaolinmaoan
  - Feat: add rect shape. [#685](https://github.com/galacean/effects-runtime/pull/685) @wumaolinmaoan
  - Feat: add shape component hit test. [#698](https://github.com/galacean/effects-runtime/pull/698) @wumaolinmaoan
  - Feat: add support for shape property in item renderer. [#696](https://github.com/galacean/effects-runtime/pull/696) @Sruimeng
  - Feat: add poly star shape. [#705](https://github.com/galacean/effects-runtime/pull/705) @wumaolinmaoan
  - Feat: shape component support fill color. [#715](https://github.com/galacean/effects-runtime/pull/715) @wumaolinmaoan
  - Feat: shape component support alpha blend. [#754](https://github.com/galacean/effects-runtime/pull/754) @wumaolinmaoan
  - Fix: shape bounding box. [#703](https://github.com/galacean/effects-runtime/pull/703) @wumaolinmaoan
  - Fix: rect shape drawing and bounding box. [#723](https://github.com/galacean/effects-runtime/pull/723) @wumaolinmaoan
  - Fix: shape mask. [#729](https://github.com/galacean/effects-runtime/pull/729) @wumaolinmaoan
- Feat: 增加音视频插件。[#666](https://github.com/galacean/effects-runtime/pull/666) @Sruimeng
  - Feat(mutilmedia): 增加音视频加载器检查自动播放权限的逻辑。[#680](https://github.com/galacean/effects-runtime/pull/680) @Sruimeng
  - Feat: add autoplay permission check in audio and video loaders. [#713](https://github.com/galacean/effects-runtime/pull/713) @Sruimeng
  - Refactor: 优化插件 assets 调用逻辑。[#682](https://github.com/galacean/effects-runtime/pull/682) @yiiqii
  - Fix(video): 修复视频渲染与元素结束行为不符问题。[#690](https://github.com/galacean/effects-runtime/pull/690) @Sruimeng
  - Fix: 修复 video component 对蒙版的支持。[#731](https://github.com/galacean/effects-runtime/pull/731) @Sruimeng
  - Fix: 修复视频和音频加载插件，简化预编译逻辑并增强视频播放控制。[#736](https://github.com/galacean/effects-runtime/pull/736) @Sruimeng
- Feat: add material track. [#683](https://github.com/galacean/effects-runtime/pull/683) @wumaolinmaoan
- Feat: improve the track binding update. [#688](https://github.com/galacean/effects-runtime/pull/688) @wumaolinmaoan
- Feat: add color and vector4 track. [#691](https://github.com/galacean/effects-runtime/pull/691) @wumaolinmaoan
- Feat: 增加交互元素拖拽范围修改接口。[#689](https://github.com/galacean/effects-runtime/pull/689) @RGCHN
- Feat: add vector4 property mixer. [#692](https://github.com/galacean/effects-runtime/pull/692) @wumaolinmaoan
- Feat: editor mode support external skybox. [#697](https://github.com/galacean/effects-runtime/pull/697) @liuxi150
- Feat: fake 3d component. [#701](https://github.com/galacean/effects-runtime/pull/701) @wumaolinmaoan
- Feat: property clip use normalized time. [#714](https://github.com/galacean/effects-runtime/pull/714) @wumaolinmaoan
- Feat: item active setting. [#716](https://github.com/galacean/effects-runtime/pull/716) @wumaolinmaoan
  - fix: ref compostion `setVisible()` invalid
- Feat: material add color and mainTexture interface. [#722](https://github.com/galacean/effects-runtime/pull/722) @wumaolinmaoan
- Feat: 增加富文本插件。[#704](https://github.com/galacean/effects-runtime/pull/704) @Sruimeng
  - Fix: update default text value and adjust scaling in rich text component. [#739](https://github.com/galacean/effects-runtime/pull/739) @Sruimeng
  - Fix: the reporting words for unexpected parse result. [#745](https://github.com/galacean/effects-runtime/pull/745) @zheeeng
  - Fix: 在富文本仅包含换行符时添加空格，并优化无内容时的脏标志处理。[#749](https://github.com/galacean/effects-runtime/pull/749) @Sruimeng
- Feat: add goto event for composition and improve texture cleanup on destroy. [#743](https://github.com/galacean/effects-runtime/pull/743) @Sruimeng
- Feat: timeline asset add flattened tracks property. [#748](https://github.com/galacean/effects-runtime/pull/748) @wumaolinmaoan
- Refactor: remove processTextures dependency on engine. [#662](https://github.com/galacean/effects-runtime/pull/662) @wumaolinmaoan
- Refactor: vfx item find use BFS. [#667](https://github.com/galacean/effects-runtime/pull/667) @wumaolinmaoan
- Refactor: 移除无用的 `imgUsage` 和 `usedImages` 逻辑。[#672](https://github.com/galacean/effects-runtime/pull/672) @yiiqii
  - fix(demo): 本地 demo 资源统一到 public 目录下
  - style(type): 规范 shape 类型
- Refactor: unify item parent setup. [#681](https://github.com/galacean/effects-runtime/pull/681) @liuxi150
- Refactor: composition component create. [#669](https://github.com/galacean/effects-runtime/pull/669) @wumaolinmaoan
- Refactor: post processing setting. [#686](https://github.com/galacean/effects-runtime/pull/686) @wumaolinmaoan
  - Refactor: shape and post process volume data. [#717](https://github.com/galacean/effects-runtime/pull/717) @wumaolinmaoan
  - Fix(demo): post processing gui create issue. [#695](https://github.com/galacean/effects-runtime/pull/695) @yiiqii
- Refactor: clean model tree item. [#687](https://github.com/galacean/effects-runtime/pull/687) @liuxi150
- Refactor: opt shader variant create logic. [#712](https://github.com/galacean/effects-runtime/pull/712) @wumaolinmaoan
  - optimize judgment logic to avoid repeated creation of shader variants
- Refactor: color and vector4 curve value. [#730](https://github.com/galacean/effects-runtime/pull/730) @wumaolinmaoan
- Refactor: opt global uniforms setting perfromance. [#735](https://github.com/galacean/effects-runtime/pull/735) @wumaolinmaoan
  - add `effects_WorldSpaceCameraPos` shader built-in property
- Refactor: opt render frame add render component logic. [#747](https://github.com/galacean/effects-runtime/pull/747) @wumaolinmaoan
- Perf: opt lifetime function performance. [#596](https://github.com/galacean/effects-runtime/pull/596) @wumaolinmaoan
- Fix: player adds composition timing. [#635](https://github.com/galacean/effects-runtime/pull/635) @wumaolinmaoan
- Fix: 补充 `TextDecoder` 的适配。[#642](https://github.com/galacean/effects-runtime/pull/642) @yiiqii
- Fix: `onStart` is called twice. [#645](https://github.com/galacean/effects-runtime/pull/645) @wumaolinmaoan
- Fix: composition reverse delay. [#648](https://github.com/galacean/effects-runtime/pull/648) @wumaolinmaoan
- Fix: remove unnecessary alpha multiplication in color grading. [#653](https://github.com/galacean/effects-runtime/pull/653) @wumaolinmaoan
- Fix: image asset load error. [#663](https://github.com/galacean/effects-runtime/pull/663) @wumaolinmaoan
- Fix: 修复 `AssetManager` 加载 JSON 对象的问题。[#668](https://github.com/galacean/effects-runtime/pull/668) @yiiqii
  - style(type): 规范 `Image` 和 `Assets` 数据类型，并完善 `AssetManager` 相关类型
  - test: 补充 `AssetManager` 及 `loadScene` 单测
  - style: 统一 buildin object 使用 spec 中的定义
- Fix: 修复 threejs 粒子渲染问题 & video 无法重播问题。[#684](https://github.com/galacean/effects-runtime/pull/684) @Sruimeng
- Fix: interact item click invalid when composition restart. [#693](https://github.com/galacean/effects-runtime/pull/693) @wumaolinmaoan
- Fix: 增加 player `pause` 事件。[#700](https://github.com/galacean/effects-runtime/pull/700) @yiiqii
  - docs: 补充相关 tsdoc
- Fix: 修复 Spine 元素遮罩问题。[#706](https://github.com/galacean/effects-runtime/pull/706) @RGCHN
- Fix: on end called too early. [#711](https://github.com/galacean/effects-runtime/pull/711) @wumaolinmaoan
- Fix: message interact item. [#721](https://github.com/galacean/effects-runtime/pull/721) @wumaolinmaoan
- Fix: 增加降级插件 `window` 使用前的判断。[#728](https://github.com/galacean/effects-runtime/pull/728) @RGCHN
- Fix: playable asset export. [#737](https://github.com/galacean/effects-runtime/pull/737) @wumaolinmaoan
- Fix: color property track create wrong mixer. [#738](https://github.com/galacean/effects-runtime/pull/738) @wumaolinmaoan
- Chore: imgui add show canvas menu button. [#652](https://github.com/galacean/effects-runtime/pull/652) @wumaolinmaoan
- Chore: 移除 `loadScene` 为 scene object 时的动态数据逻辑。[#678](https://github.com/galacean/effects-runtime/pull/678) @yiiqii
- Chore: update specification. [#694](https://github.com/galacean/effects-runtime/pull/694) @wumaolinmaoan
- Chore: unit test add canvas display. [#724](https://github.com/galacean/effects-runtime/pull/724) @wumaolinmaoan
- Chore: add half float texture support check. [#725](https://github.com/galacean/effects-runtime/pull/725) @wumaolinmaoan
- Chore: remove item duration zero error check. [#732](https://github.com/galacean/effects-runtime/pull/732) @wumaolinmaoan
- Chore: opt composition start logic. [#742](https://github.com/galacean/effects-runtime/pull/742) @wumaolinmaoan
- Chore: remove test shape interface. [#744](https://github.com/galacean/effects-runtime/pull/744) @wumaolinmaoan
- Chore: update resource-detection and fix type issue. [#752](https://github.com/galacean/effects-runtime/pull/752) @yiiqii
- Test: 完善 `AssetManager` 动态视频单测。[#661](https://github.com/galacean/effects-runtime/pull/661) @yiiqii
- Style: 统一 `effectsClass` 枚举入参类型。[#677](https://github.com/galacean/effects-runtime/pull/677) @yiiqii

## 2.0.7

`2024-10-30`

- Fix: 修复 Spine 元素遮罩问题。[#706](https://github.com/galacean/effects-runtime/pull/706) @RGCHN
- Fix: 移除 Player 类中关于渲染错误队列的无用代码。[#664](https://github.com/galacean/effects-runtime/pull/664) @Sruimeng

## 2.0.6

`2024-09-13`

- Fix: 补充 TextDecoder 的适配。[#642](https://github.com/galacean/effects-runtime/pull/642) @yiiqii

## 2.0.5

`2024-09-10`

- Fix: sprite unit test. [#636](https://github.com/galacean/effects-runtime/pull/636) @wumaolinmaoan
- Fix: draw count value error. [#625](https://github.com/galacean/effects-runtime/pull/625) @wumaolinmaoan
- Fix: timeline clip end judgment. [#626](https://github.com/galacean/effects-runtime/pull/626) @wumaolinmaoan
- Fix: 调整 Player disposed 判断，避免 Texture initialize 报错。[#616](https://github.com/galacean/effects-runtime/pull/616) @yiiqii
- Fix: revert busrt once and disabled property. [#615](https://github.com/galacean/effects-runtime/pull/615) @yiiqii
- Fix: materal uniform dirty flag setting when shader changed. [#614](https://github.com/galacean/effects-runtime/pull/614) @wumaolinmaoan

## 2.0.4

`2024-08-30`

- Fix: shader compile check on return will block code execute. [#609](https://github.com/galacean/effects-runtime/pull/609) @yiiqii
- Fix: shader program set twice on async compile. [#608](https://github.com/galacean/effects-runtime/pull/608) @wumaolinmaoan
- Fix: particle render on composition restart. [#607](https://github.com/galacean/effects-runtime/pull/607) @wumaolinmaoan
- Fix: 修复 variable text 不生效问题。[#606](https://github.com/galacean/effects-runtime/pull/606) @Sruimeng
- Fix: 修复倒播和帧对比问题。[#598](https://github.com/galacean/effects-runtime/pull/598) @RGCHN
- Fix: subcomposition end behavior not rendering as expected. [#605](https://github.com/galacean/effects-runtime/pull/605) @wumaolinmaoan
- Fix: effect material depthTest and depthMask default value. [#602](https://github.com/galacean/effects-runtime/pull/602) @wumaolinmaoan
- Fix: reset fps when renderLevel update. [#600](https://github.com/galacean/effects-runtime/pull/600) @yiiqii
- Fix: runtime 2.0 component export. [#597](https://github.com/galacean/effects-runtime/pull/597) @wumaolinmaoan
- Fix: stats should dispose when player is dispose. [#599](https://github.com/galacean/effects-runtime/pull/599) @yiiqii
- Chore: 优化 video 加载失败后报错提示。[#577](https://github.com/galacean/effects-runtime/pull/577) @Sruimeng

## 2.0.3

`2024-08-26`

- Fix: frame animation loop on composition restart. [#588](https://github.com/galacean/effects-runtime/pull/588) @wumaolinmaoan

## 2.0.2

`2024-08-23`

- Fix: Migration of text item animation track. [#584](https://github.com/galacean/effects-runtime/pull/584) @wumaolinmaoan

## 2.0.1

`2024-08-23`

- Fix: Frame animation loop. [#580](https://github.com/galacean/effects-runtime/pull/580) @wumaolinmaoan

## 2.0.0

`2024-08-22`

- Refactor: componentization transformation. [#47](https://github.com/galacean/effects-runtime/pull/47) [#62](https://github.com/galacean/effects-runtime/pull/62) [#71](https://github.com/galacean/effects-runtime/pull/71) [#72](https://github.com/galacean/effects-runtime/pull/72) [#73](https://github.com/galacean/effects-runtime/pull/73) [#81](https://github.com/galacean/effects-runtime/pull/81) [#94](https://github.com/galacean/effects-runtime/pull/94) [#161](https://github.com/galacean/effects-runtime/pull/161) [#163](https://github.com/galacean/effects-runtime/pull/163) [#177](https://github.com/galacean/effects-runtime/pull/177) [#191](https://github.com/galacean/effects-runtime/pull/191) [#192](https://github.com/galacean/effects-runtime/pull/192) [#194](https://github.com/galacean/effects-runtime/pull/194) [#196](https://github.com/galacean/effects-runtime/pull/196) [#197](https://github.com/galacean/effects-runtime/pull/197) [#204](https://github.com/galacean/effects-runtime/pull/204) [#205](https://github.com/galacean/effects-runtime/pull/205) [#213](https://github.com/galacean/effects-runtime/pull/213) [#225](https://github.com/galacean/effects-runtime/pull/225) [#228](https://github.com/galacean/effects-runtime/pull/228) [#229](https://github.com/galacean/effects-runtime/pull/229) [#232](https://github.com/galacean/effects-runtime/pull/232) [#234](https://github.com/galacean/effects-runtime/pull/234) [#237](https://github.com/galacean/effects-runtime/pull/237) [#238](https://github.com/galacean/effects-runtime/pull/238) [#239](https://github.com/galacean/effects-runtime/pull/239) [#241](https://github.com/galacean/effects-runtime/pull/241) [#250](https://github.com/galacean/effects-runtime/pull/250) [#253](https://github.com/galacean/effects-runtime/pull/253) [#254](https://github.com/galacean/effects-runtime/pull/254) [#255](https://github.com/galacean/effects-runtime/pull/255) [#266](https://github.com/galacean/effects-runtime/pull/266) [#265](https://github.com/galacean/effects-runtime/pull/265) [#267](https://github.com/galacean/effects-runtime/pull/267) [#269](https://github.com/galacean/effects-runtime/pull/269) [#273](https://github.com/galacean/effects-runtime/pull/273) [#279](https://github.com/galacean/effects-runtime/pull/279) [#281](https://github.com/galacean/effects-runtime/pull/281) [#271](https://github.com/galacean/effects-runtime/pull/271) [#283](https://github.com/galacean/effects-runtime/pull/283) [#285](https://github.com/galacean/effects-runtime/pull/285) [#286](https://github.com/galacean/effects-runtime/pull/286) [#287](https://github.com/galacean/effects-runtime/pull/287) [#295](https://github.com/galacean/effects-runtime/pull/295) [#302](https://github.com/galacean/effects-runtime/pull/302) [#307](https://github.com/galacean/effects-runtime/pull/307) [#304](https://github.com/galacean/effects-runtime/pull/304) [#308](https://github.com/galacean/effects-runtime/pull/308) [#311](https://github.com/galacean/effects-runtime/pull/311) [#330](https://github.com/galacean/effects-runtime/pull/330) [#334](https://github.com/galacean/effects-runtime/pull/334) [#335](https://github.com/galacean/effects-runtime/pull/335) [#338](https://github.com/galacean/effects-runtime/pull/338) [#351](https://github.com/galacean/effects-runtime/pull/351) [#353](https://github.com/galacean/effects-runtime/pull/353) [#354](https://github.com/galacean/effects-runtime/pull/354) [#349](https://github.com/galacean/effects-runtime/pull/349) [#355](https://github.com/galacean/effects-runtime/pull/355) [#358](https://github.com/galacean/effects-runtime/pull/358) [#359](https://github.com/galacean/effects-runtime/pull/359) [#365](https://github.com/galacean/effects-runtime/pull/365) [#366](https://github.com/galacean/effects-runtime/pull/366) [#368](https://github.com/galacean/effects-runtime/pull/368) [#369](https://github.com/galacean/effects-runtime/pull/369) [#372](https://github.com/galacean/effects-runtime/pull/372) [#375](https://github.com/galacean/effects-runtime/pull/375) [#377](https://github.com/galacean/effects-runtime/pull/377) [#378](https://github.com/galacean/effects-runtime/pull/378) [#379](https://github.com/galacean/effects-runtime/pull/379) [#387](https://github.com/galacean/effects-runtime/pull/387) [#390](https://github.com/galacean/effects-runtime/pull/390) [#395](https://github.com/galacean/effects-runtime/pull/395) [#401](https://github.com/galacean/effects-runtime/pull/401) [#402](https://github.com/galacean/effects-runtime/pull/402) [#403](https://github.com/galacean/effects-runtime/pull/403) [#410](https://github.com/galacean/effects-runtime/pull/410) [#412](https://github.com/galacean/effects-runtime/pull/412) [#413](https://github.com/galacean/effects-runtime/pull/413) [#414](https://github.com/galacean/effects-runtime/pull/414) [#415](https://github.com/galacean/effects-runtime/pull/415) [#416](https://github.com/galacean/effects-runtime/pull/416) [#417](https://github.com/galacean/effects-runtime/pull/417) [#420](https://github.com/galacean/effects-runtime/pull/420) [#421](https://github.com/galacean/effects-runtime/pull/421) [#423](https://github.com/galacean/effects-runtime/pull/423) [#426](https://github.com/galacean/effects-runtime/pull/426) [#428](https://github.com/galacean/effects-runtime/pull/428) [#439](https://github.com/galacean/effects-runtime/pull/439) [#445](https://github.com/galacean/effects-runtime/pull/445) [#453](https://github.com/galacean/effects-runtime/pull/453) [#457](https://github.com/galacean/effects-runtime/pull/457) [#464](https://github.com/galacean/effects-runtime/pull/464) [#459](https://github.com/galacean/effects-runtime/pull/459) [#465](https://github.com/galacean/effects-runtime/pull/465) [#468](https://github.com/galacean/effects-runtime/pull/468) [#474](https://github.com/galacean/effects-runtime/pull/474) [#477](https://github.com/galacean/effects-runtime/pull/477) [#478](https://github.com/galacean/effects-runtime/pull/478) [#479](https://github.com/galacean/effects-runtime/pull/479) [#485](https://github.com/galacean/effects-runtime/pull/485) [#487](https://github.com/galacean/effects-runtime/pull/487) [#486](https://github.com/galacean/effects-runtime/pull/486) [#490](https://github.com/galacean/effects-runtime/pull/490) [#492](https://github.com/galacean/effects-runtime/pull/492) [#493](https://github.com/galacean/effects-runtime/pull/493) [#494](https://github.com/galacean/effects-runtime/pull/494) [#496](https://github.com/galacean/effects-runtime/pull/496) [#497](https://github.com/galacean/effects-runtime/pull/497) [#498](https://github.com/galacean/effects-runtime/pull/498) [#501](https://github.com/galacean/effects-runtime/pull/501) [#506](https://github.com/galacean/effects-runtime/pull/506) [#508](https://github.com/galacean/effects-runtime/pull/508) [#509](https://github.com/galacean/effects-runtime/pull/509) [#511](https://github.com/galacean/effects-runtime/pull/511) [#512](https://github.com/galacean/effects-runtime/pull/512) [#519](https://github.com/galacean/effects-runtime/pull/519) [#517](https://github.com/galacean/effects-runtime/pull/517) [#437](https://github.com/galacean/effects-runtime/pull/437) [#495](https://github.com/galacean/effects-runtime/pull/495) [#525](https://github.com/galacean/effects-runtime/pull/525) [#526](https://github.com/galacean/effects-runtime/pull/526) [#528](https://github.com/galacean/effects-runtime/pull/528) [#531](https://github.com/galacean/effects-runtime/pull/531) [#532](https://github.com/galacean/effects-runtime/pull/532) [#536](https://github.com/galacean/effects-runtime/pull/536) [#538](https://github.com/galacean/effects-runtime/pull/538) [#542](https://github.com/galacean/effects-runtime/pull/542) [#543](https://github.com/galacean/effects-runtime/pull/543) [#545](https://github.com/galacean/effects-runtime/pull/545) [#546](https://github.com/galacean/effects-runtime/pull/546) [#547](https://github.com/galacean/effects-runtime/pull/547) [#549](https://github.com/galacean/effects-runtime/pull/549) [#548](https://github.com/galacean/effects-runtime/pull/548) [#551](https://github.com/galacean/effects-runtime/pull/551) [#552](https://github.com/galacean/effects-runtime/pull/552) [#558](https://github.com/galacean/effects-runtime/pull/558) [#559](https://github.com/galacean/effects-runtime/pull/559) [#556](https://github.com/galacean/effects-runtime/pull/556) [#560](https://github.com/galacean/effects-runtime/pull/560) [#553](https://github.com/galacean/effects-runtime/pull/553) [#565](https://github.com/galacean/effects-runtime/pull/565) [#562](https://github.com/galacean/effects-runtime/pull/562) [#564](https://github.com/galacean/effects-runtime/pull/564) [#566](https://github.com/galacean/effects-runtime/pull/566) [#567](https://github.com/galacean/effects-runtime/pull/567) [#571](https://github.com/galacean/effects-runtime/pull/571) [#573](https://github.com/galacean/effects-runtime/pull/573) @yiiqii @RGCHN @wumaolinmaoan @Sruimeng @liuxi150
  - Feat: add EffectComponent hit test. [#165](https://github.com/galacean/effects-runtime/pull/165) @wumaolinmaoan
  - Feat: add effectsClass decorator. [#193](https://github.com/galacean/effects-runtime/pull/193) @wumaolinmaoan
  - Feat: support builtin object. [#300](https://github.com/galacean/effects-runtime/pull/300) @wumaolinmaoan
  - Feat: material texture property. [#294](https://github.com/galacean/effects-runtime/pull/294) @wumaolinmaoan
  - Feat: sprite component api and composition api. [#306](https://github.com/galacean/effects-runtime/pull/306) @Sruimeng
  - Feat: add image asset. [#331](https://github.com/galacean/effects-runtime/pull/331) @wumaolinmaoan
  - Feat: add subMesh and animationClip. [#347](https://github.com/galacean/effects-runtime/pull/347) @wumaolinmaoan
  - Feat: add sub composition track. [#411](https://github.com/galacean/effects-runtime/pull/411) @wumaolinmaoan
  - Feat: add render order. [#418](https://github.com/galacean/effects-runtime/pull/418) @wumaolinmaoan
  - Feat: add miscs. [#427](https://github.com/galacean/effects-runtime/pull/427) @wumaolinmaoan
  - Feat: 修改 Spine 数据结构和加载解析流程。[#429](https://github.com/galacean/effects-runtime/pull/429) @RGCHN
  - Feat: add camera fov ratio. [#475](https://github.com/galacean/effects-runtime/pull/475) @wumaolinmaoan
  - Feat: 增加 Canvas2D 渲染相关帧对比测试。[#476](https://github.com/galacean/effects-runtime/pull/476) @Sruimeng
  - Feat: add gizmo coordinateSpace. [#491](https://github.com/galacean/effects-runtime/pull/491) @wumaolinmaoan
  - Feat: add geometry binary serialize. [#505](https://github.com/galacean/effects-runtime/pull/505) @wumaolinmaoan
  - Feat: Spine 资源的 ECS 改造和旧数据兼容。[#520](https://github.com/galacean/effects-runtime/pull/520) @RGCHN
  - Feat: open awake lifetime function. [#572](https://github.com/galacean/effects-runtime/pull/572) @wumaolinmaoan
- Refactor: update alipay downgrade plugin. [#202](https://github.com/galacean/effects-runtime/pull/202) @liuxi150
- Refactor: 移除滤镜相关代码。[#297](https://github.com/galacean/effects-runtime/pull/297) @yiiqii
- Refactor: 移除动态文本代码，使用文本元素替代。[#301](https://github.com/galacean/effects-runtime/pull/301) @yiiqii
  - Chore: 移除 template v2 的判断，完善数据模版相关单测。[#303](https://github.com/galacean/effects-runtime/pull/303) @yiiqii
- Refactor: 迁移 fallback 代码，完善相关类型。[#332](https://github.com/galacean/effects-runtime/pull/332) @yiiqii
- Refactor: 抽离 TextComponentBase，提供给 engine-effects 使用。[#454](https://github.com/galacean/effects-runtime/pull/454) @yiiqii
- Refactor: event 系统。[#488](https://github.com/galacean/effects-runtime/pull/488) @Sruimeng
  - Test: 增加 player 相关事件测试。[#555](https://github.com/galacean/effects-runtime/pull/555) @Sruimeng
  - Chore: 增加 player update demo。[#563](https://github.com/galacean/effects-runtime/pull/563) @yiiqii
  - Refactor: 收窄 event 应用范围。[#569](https://github.com/galacean/effects-runtime/pull/569) @Sruimeng
- Feat: add trail scene for custom material testing. [#64](https://github.com/galacean/effects-runtime/pull/64) @wumaolinmaoan
- Feat: demo add custom material selection menu. [#83](https://github.com/galacean/effects-runtime/pull/83) @wumaolinmaoan
- Feat: add geometry normals support. [#201](https://github.com/galacean/effects-runtime/pull/201) @wumaolinmaoan
- Feat: material asset texture property add offset and scale. [#231](https://github.com/galacean/effects-runtime/pull/231) @wumaolinmaoan
- Feat: add vignette effect. [#284](https://github.com/galacean/effects-runtime/pull/284) @wumaolinmaoan
- Feat: 增加 Composition/VFXItem setPositionByPixel API。[#357](https://github.com/galacean/effects-runtime/pull/357) @Sruimeng
- Feat: 移除 Player 初始化参数 gl，不再支持。[#376](https://github.com/galacean/effects-runtime/pull/376) @yiiqii
  - chore: 统一默认 Texture 创建方法
- Feat: 增加 textLayout 及 textStyle 导出。[#424](https://github.com/galacean/effects-runtime/pull/424) @Sruimeng
- Feat: 更新 inspire 示例的 pre player 版本。[#425](https://github.com/galacean/effects-runtime/pull/425) @yiiqii
- Feat: add postprocess volume. [#510](https://github.com/galacean/effects-runtime/pull/510) @wumaolinmaoan
  - Perf: opt post process. [#524](https://github.com/galacean/effects-runtime/pull/524) @wumaolinmaoan
- Feat: add new downgrade plugin and refactor Alipay downgrade plugin. [#513](https://github.com/galacean/effects-runtime/pull/513) @liuxi150
- Feat: 支持 avif 格式图片的加载。[#534](https://github.com/galacean/effects-runtime/pull/534) @yiiqii
- Feat: 增加性能监测插件。[#544](https://github.com/galacean/effects-runtime/pull/544) @Sruimeng
- Feat: 移除粒子 mesh 上的 getPointPosition 方法，增加 particleSystem 上的 getPointPositionByIndex 方法。[#554](https://github.com/galacean/effects-runtime/pull/554) @RGCHN
- Feat: add shader factory for shader code preprocessing. [#557](https://github.com/galacean/effects-runtime/pull/557) @liuxi150
- Build: use swc plugin for generate. [#240](https://github.com/galacean/effects-runtime/pull/240) @yiiqii
  - 编译速度更快，整体提升 6 倍（170s => 27s）
  - helper/assets 不再打包
  - Fix(build): 修复 swc 本地 link 报错。[#268](https://github.com/galacean/effects-runtime/pull/268) @yiiqii
  - Build: core 产物使用 es5，部分代码优化。[#444](https://github.com/galacean/effects-runtime/pull/444) @yiiqii
- Build: fix windows command line problem. [#350](https://github.com/galacean/effects-runtime/pull/350) @liuxi150
- Build: 统一 glsl 导入方式为 include，优化部分 glsl。[#430](https://github.com/galacean/effects-runtime/pull/430) @yiiqii
- Build: 支持抖音小程序。[#521](https://github.com/galacean/effects-runtime/pull/521) @yiiqii
- Chore: Code consolidation and normalization. [#341](https://github.com/galacean/effects-runtime/pull/341) @yiiqii
  - chore: player 文件代码整理
  - style: 规范 framebuffer 和 renderbuffer 拼写
  - refactor: 下线不推荐的 handleEnd 回掉，使用 onEnd 替换
  - chore: 移除不推荐的 forEach 方法
- Chore: 统一 GLType 类型。[#389](https://github.com/galacean/effects-runtime/pull/389) @yiiqii
- Chore: 增加插件版本不一致时的错误提示。[#404](https://github.com/galacean/effects-runtime/pull/404) @yiiqii
- Chore: 增加渲染等级示例并移除 composition 上的 renderLevel。[#419](https://github.com/galacean/effects-runtime/pull/419) @yiiqii
- Chore: 优化插件版本对比的 Player 版本获取逻辑。[#433](https://github.com/galacean/effects-runtime/pull/433) @yiiqii
- Chore: 暴露 composition 部分属性和方法。[#436](https://github.com/galacean/effects-runtime/pull/436) @yiiqii
- Chore: 规范并优化报错信息。[#438](https://github.com/galacean/effects-runtime/pull/438) @yiiqii

## 1.6.6

`2024-08-02`

- Fix: 修复极端情况下 textMesh 销毁时序问题。[#535](https://github.com/galacean/effects-runtime/pull/535) @Sruimeng

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
