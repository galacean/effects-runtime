`effects-runtime` 遵循 [Semantic Versioning 2.0.0](http://semver.org/lang/zh-CN/) 语义化版本规范。

#### 发布周期

- 修订版本号：每周末会进行日常 bugfix 更新（如果有紧急的 bugfix，则任何时候都可发布）。
- 次版本号：每月发布一个带有新特性的向下兼容的版本。
- 主版本号：含有破坏性更新和新特性，不在发布周期内。

---

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
