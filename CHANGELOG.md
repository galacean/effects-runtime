`effects-runtime` follows [Semantic Versioning 2.0.0](http://semver.org/).

#### Release Schedule
- **Weekly release**: patch version at the end of every week for routine bugfix (anytime for urgent bugfix).
- **Monthly release**: minor version at the end of every month for new features.
- Major version release is not included in this schedule for breaking change and new features.

---

## 2.0.6

`2024-09-13`

- Fix: Extend support for TextDecoder compatibility. [#642](https://github.com/galacean/effects-runtime/pull/642) @yiiqii

## 2.0.5

`2024-09-10`

- Fix: sprite unit test. [#636](https://github.com/galacean/effects-runtime/pull/636) @wumaolinmaoan
- Fix: draw count value error. [#625](https://github.com/galacean/effects-runtime/pull/625) @wumaolinmaoan
- Fix: timeline clip end judgment. [#626](https://github.com/galacean/effects-runtime/pull/626) @wumaolinmaoan
- Fix: Adjusted the judgment for Player disposal to prevent errors during Texture initialization. [#616](https://github.com/galacean/effects-runtime/pull/616) @yiiqii
- Fix: revert busrt once and disabled property. [#615](https://github.com/galacean/effects-runtime/pull/615) @yiiqii
- Fix: materal uniform dirty flag setting when shader changed. [#614](https://github.com/galacean/effects-runtime/pull/614) @wumaolinmaoan

## 2.0.4

`2024-08-30`

- Fix: shader compile check on return will block code execute. [#609](https://github.com/galacean/effects-runtime/pull/609) @yiiqii
- Fix: shader program set twice on async compile. [#608](https://github.com/galacean/effects-runtime/pull/608) @wumaolinmaoan
- Fix: particle render on composition restart. [#607](https://github.com/galacean/effects-runtime/pull/607) @wumaolinmaoan
- Fix: Resolve issue with variable text not applying correctly. [#606](https://github.com/galacean/effects-runtime/pull/606) @Sruimeng
- Fix: Correct reverse playback and frame comparison issues. [#598](https://github.com/galacean/effects-runtime/pull/598) @RGCHN
- Fix: subcomposition end behavior not rendering as expected. [#605](https://github.com/galacean/effects-runtime/pull/605) @wumaolinmaoan
- Fix: effect material depthTest and depthMask default value. [#602](https://github.com/galacean/effects-runtime/pull/602) @wumaolinmaoan
- Fix: reset fps when renderLevel update. [#600](https://github.com/galacean/effects-runtime/pull/600) @yiiqii
- Fix: runtime 2.0 component export. [#597](https://github.com/galacean/effects-runtime/pull/597) @wumaolinmaoan
- Fix: stats should dispose when player is dispose. [#599](https://github.com/galacean/effects-runtime/pull/599) @yiiqii
- Chore: Improve error messaging for failed video loading. [#577](https://github.com/galacean/effects-runtime/pull/577) @Sruimeng

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
  - Feat: Modified the Spine data structure and loading parsing process. [#429](https://github.com/galacean/effects-runtime/pull/429) @RGCHN
  - Feat: Added camera FOV ratio. [#475](https://github.com/galacean/effects-runtime/pull/475) @wumaolinmaoan
  - Feat: Added frame comparison tests related to Canvas2D rendering. [#476](https://github.com/galacean/effects-runtime/pull/476) @Sruimeng
  - Feat: Added gizmo coordinate space. [#491](https://github.com/galacean/effects-runtime/pull/491) @wumaolinmaoan
  - Feat: Added geometry binary serialization. [#505](https://github.com/galacean/effects-runtime/pull/505) @wumaolinmaoan
  - Feat: Revamped ECS for Spine resources and maintained compatibility with old data. [#520](https://github.com/galacean/effects-runtime/pull/520) @RGCHN
  - Feat: Opened awake lifetime function. [#572](https://github.com/galacean/effects-runtime/pull/572) @wumaolinmaoan
- Refactor: update alipay downgrade plugin. [#202](https://github.com/galacean/effects-runtime/pull/202) @liuxi150
- Refactor: Removed filter-related code. [#297](https://github.com/galacean/effects-runtime/pull/297) @yiiqii
- Refactor: Removed dynamic text code and replaced it with text elements. [#301](https://github.com/galacean/effects-runtime/pull/301) @yiiqii
  - Chore: Removed checks for template v2 and improved related unit tests for data templates. [#303](https://github.com/galacean/effects-runtime/pull/303) @yiiqii
- Refactor: Migrated fallback code and improved related types. [#332](https://github.com/galacean/effects-runtime/pull/332) @yiiqii
- Refactor: Extracted TextComponentBase for use by engine-effects. [#454](https://github.com/galacean/effects-runtime/pull/454) @yiiqii
- Refactor: Event system. [#488](https://github.com/galacean/effects-runtime/pull/488) @Sruimeng
  - Test: Added player-related event tests. [#555](https://github.com/galacean/effects-runtime/pull/555) @Sruimeng
  - Chore: Added player update demo. [#563](https://github.com/galacean/effects-runtime/pull/563) @yiiqii
  - Refactor: Narrowed the application scope of events. [#569](https://github.com/galacean/effects-runtime/pull/569) @Sruimeng
- Feat: add trail scene for custom material testing. [#64](https://github.com/galacean/effects-runtime/pull/64) @wumaolinmaoan
- Feat: demo add custom material selection menu. [#83](https://github.com/galacean/effects-runtime/pull/83) @wumaolinmaoan
- Feat: add geometry normals support. [#201](https://github.com/galacean/effects-runtime/pull/201) @wumaolinmaoan
- Feat: material asset texture property add offset and scale. [#231](https://github.com/galacean/effects-runtime/pull/231) @wumaolinmaoan
- Feat: add vignette effect. [#284](https://github.com/galacean/effects-runtime/pull/284) @wumaolinmaoan
- Feat: add Composition/VFXItem setPositionByPixel API. [#357](https://github.com/galacean/effects-runtime/pull/357) @Sruimeng
- Feat: Removed the Player initialization parameter gl, which is no longer supported. [#376](https://github.com/galacean/effects-runtime/pull/376) @yiiqii
  - chore: Unified the default Texture creation method.
- Feat: Added export for textLayout and textStyle. [#424](https://github.com/galacean/effects-runtime/pull/424) @Sruimeng
- Feat: Updated the pre-player version for the inspire example. [#425](https://github.com/galacean/effects-runtime/pull/425) @yiiqii
- Feat: add postprocess volume. [#510](https://github.com/galacean/effects-runtime/pull/510) @wumaolinmaoan
  - Perf: opt post process. [#524](https://github.com/galacean/effects-runtime/pull/524) @wumaolinmaoan
- Feat: add new downgrade plugin and refactor Alipay downgrade plugin. [#513](https://github.com/galacean/effects-runtime/pull/513) @liuxi150
- Feat: Support loading of images in avif format. [#534](https://github.com/galacean/effects-runtime/pull/534) @yiiqii
- Feat: Added performance monitoring plugin. [#544](https://github.com/galacean/effects-runtime/pull/544) @Sruimeng
- Feat: Removed the getPointPosition method from the particle mesh and added the getPointPositionByIndex method to the particleSystem. [#554](https://github.com/galacean/effects-runtime/pull/554) @RGCHN
- Feat: Add shader factory for shader code preprocessing. [#557](https://github.com/galacean/effects-runtime/pull/557) @liuxi150
- Build: Use swc plugin for generation. [#240](https://github.com/galacean/effects-runtime/pull/240) @yiiqii
  - Compilation speed increased, overall improvement of 6 times (170s => 27s)
  - helper/assets will no longer be packaged
  - Fix(build): Fixed swc local link error. [#268](https://github.com/galacean/effects-runtime/pull/268) @yiiqii
  - Build: Core output uses es5, with some code optimization. [#444](https://github.com/galacean/effects-runtime/pull/444) @yiiqii
- Build: Fixed Windows command line problem. [#350](https://github.com/galacean/effects-runtime/pull/350) @liuxi150
- Build: Standardized GLSL import method to include and optimized some GLSL. [#430](https://github.com/galacean/effects-runtime/pull/430) @yiiqii
- Build: Support for Douyin mini-programs. [#521](https://github.com/galacean/effects-runtime/pull/521) @yiiqii
- Chore: Code consolidation and normalization. [#341](https://github.com/galacean/effects-runtime/pull/341) @yiiqii
  - chore: Organize player file code
  - style: Standardize spelling of framebuffer and renderbuffer
  - refactor: Deprecated the handleEnd callback and replaced it with onEnd
  - chore: Removed the deprecated forEach method
- Chore: Unified GLType types. [#389](https://github.com/galacean/effects-runtime/pull/389) @yiiqii
- Chore: Added error messages for inconsistent plugin versions. [#404](https://github.com/galacean/effects-runtime/pull/404) @yiiqii
- Chore: Added rendering level examples and removed renderLevel from composition. [#419](https://github.com/galacean/effects-runtime/pull/419) @yiiqii
- Chore: Optimized player version retrieval logic for plugin version comparison. [#433](https://github.com/galacean/effects-runtime/pull/433) @yiiqii
- Chore: Exposed certain properties and methods of composition. [#436](https://github.com/galacean/effects-runtime/pull/436) @yiiqii
- Chore: Standardized and optimized error messages. [#438](https://github.com/galacean/effects-runtime/pull/438) @yiiqii


## 1.6.6

`2024-08-02`

- Fix: Resolve the timing issue of textMesh destruction in extreme cases. [#535](https://github.com/galacean/effects-runtime/pull/535) @Sruimeng

## 1.6.5

`2024-07-26`

- Fix: Added a size conversion function for Spine elements under the new and old scaling rules to ensure compatibility with older versions. [#522](https://github.com/galacean/effects-runtime/pull/522) @RGCHN

## 1.6.4

`2024-07-19`

- Fix: Fixed support for WeChat mini-program spine and model plugins. [#507](https://github.com/galacean/effects-runtime/pull/507) @Sruimeng

## 1.6.3

`2024-07-12`

- Fix: Ensure Spine plugin scaling is compatible with camera horizontal cropping. [#500](https://github.com/galacean/effects-runtime/pull/500) @RGCHN

## 1.6.2

`2024-07-08`

- Fix: Fixed the issue where text setting fails when the variable is a number. [#480](https://github.com/galacean/effects-runtime/pull/480) @Sruimeng
- Fix: Fixed the pixel coordinate conversion error when the camera is not at the origin. [#481](https://github.com/galacean/effects-runtime/pull/481) @RGCHN

## 1.6.1

`2024-07-02`

- Fix: Fixed the text layout issue caused by fontSize. [#469](https://github.com/galacean/effects-runtime/pull/469) @Sruimeng

## 1.6.0

`2024-06-28`

- Feat: Add control parameters for interactive elements. [#443](https://github.com/galacean/effects-runtime/pull/443) @RGCHN
- Feat: Add segment duration during loading. [#442](https://github.com/galacean/effects-runtime/pull/442) @Sruimeng
- Feat: Add interfaces for Composition and Spine elements. [#432](https://github.com/galacean/effects-runtime/pull/432) @RGCHN
- Build: Add alpha/beta release commands. [#434](https://github.com/galacean/effects-runtime/pull/434) @yiiqii
- Fix: Fix the vertical alignment issue with multi-line text. [#455](https://github.com/galacean/effects-runtime/pull/455) [#456](https://github.com/galacean/effects-runtime/pull/456) @Sruimeng
- Fix: transparent object sort problem. [#458](https://github.com/galacean/effects-runtime/pull/458) @liuxi150

## 1.5.2

`2024-06-21`

- Fix: base color index problem. [#441](https://github.com/galacean/effects-runtime/pull/441) @liuxi150

## 1.5.1

`2024-06-05`

- Fix: Added a toggle to enable or disable the listening for the WebGL Context Lost event on the window. [#405](https://github.com/galacean/effects-runtime/pull/405) @liuxi150
- Chore: Modify the resizeRule type. [#407](https://github.com/galacean/effects-runtime/pull/407) @RGCHN

## 1.5.0

`2024-06-03`

- Feat: Added compatibility and packaging for Alipay Mini Program. [#370](https://github.com/galacean/effects-runtime/pull/370) @RGCHN
  - Feat: Downgraded plugin support for mini programs. [#385](https://github.com/galacean/effects-runtime/pull/385) @RGCHN
  - Build: Added Alipay Mini Program packaging configuration. [#388](https://github.com/galacean/effects-runtime/pull/388) @RGCHN
- Feat: Spine upgrade and modification of scaling rules. [#367](https://github.com/galacean/effects-runtime/pull/367) @RGCHN
- Fix: Removed the triggering of webglcontextlost event upon player destruction. [#371](https://github.com/galacean/effects-runtime/pull/371) @RGCHN
- Test: fix frame compare. [#386](https://github.com/galacean/effects-runtime/pull/386) @liuxi150

## 1.4.5

`2024-05-29`

- Fix: Added error catching during the rendering process. [#380](https://github.com/galacean/effects-runtime/pull/380) @Sruimeng

## 1.4.4

`2024-05-17`

- Fix: Fixed an issue with fontFamily parsing errors on iOS11/12.
 [#356](https://github.com/galacean/effects-runtime/pull/356) [#361](https://github.com/galacean/effects-runtime/pull/361) @Sruimeng @yiiqii
- Fix: Added compatibility for Spine products that do not have a default skin.
 [#352](https://github.com/galacean/effects-runtime/pull/352) @RGCHN

## 1.4.3

`2024-05-14`

- Fix: 3d editor problem. [#344](https://github.com/galacean/effects-runtime/pull/344) @liuxi150

## 1.4.2

`2024-05-10`

- Feat: Gyroscope changes are based on the user's initial angle. [#323](https://github.com/galacean/effects-runtime/pull/323) @RGCHN


## 1.4.1

`2024-05-06`

- Fix: Changed all calculations returning from BEZIER_CURVE_PATH to Vector3. [#326](https://github.com/galacean/effects-runtime/pull/326) @RGCHN

## 1.4.0

`2024-04-28`

- Feat: Added support for Bezier velocity and path curve processing. [#288](https://github.com/galacean/effects-runtime/pull/288) @RGCHN
- Fix: Fixed issues with Bezier integration and occasional stuttering of some particles. [#305](https://github.com/galacean/effects-runtime/pull/305) @RGCHN
- Test: Updated unit tests related to curves. [#318](https://github.com/galacean/effects-runtime/pull/318) @RGCHN

## 1.3.2

`2024-04-26`

- Fix: Fixed a rendering order issue when multiple references to the same pre-composition element were made. [#312](https://github.com/galacean/effects-runtime/pull/312) @RGCHN
- Fix: Addressed the issue where pre-composition elements were not created at initialization. [#309](https://github.com/galacean/effects-runtime/pull/309) @RGCHN
- Fix: Resolved the issue where pre-composition scaling settings were not taking effect. [#296](https://github.com/galacean/effects-runtime/pull/296) @RGCHN

## 1.3.1

`2024-04-19`

- Fix: image template variables is images. [#282](https://github.com/galacean/effects-runtime/pull/282) @Sruimeng

## 1.3.0

`2024-04-16`

- Feat: Added gyroscope support for changing the rotation angle of elements. [#259](https://github.com/galacean/effects-runtime/pull/259) @RGCHN
- Feat: video template. [#224](https://github.com/galacean/effects-runtime/pull/224) @Sruimeng

## 1.2.6

`2024-04-12`

- Fix: Resolved an issue with layer size inheritance caused by the update order. [#256](https://github.com/galacean/effects-runtime/pull/256) @RGCHN

## 1.2.5

`2024-04-09`

- Fix: Fixed the issue where the message element did not trigger the end event when reused. [#247](https://github.com/galacean/effects-runtime/pull/247) @RGCHN

## 1.2.4

`2024-04-08`

- Fix: Fixed the issue of unisolated assetManager parameters.[#242](https://github.com/galacean/effects-runtime/pull/242) @RGCHN
- Fix: Fixed the file path issue with fonts and bins.
[#226](https://github.com/galacean/effects-runtime/pull/226) @RGCHN
- Fix: Fixed the error in pixel to world coordinate conversion. [#233](https://github.com/galacean/effects-runtime/pull/233) @RGCHN
- Fix: miniprogram canvas type. [#230](https://github.com/galacean/effects-runtime/pull/230) @Sruimeng

## 1.2.3

`2024-03-22`

- Fix: Compatibility with data template text modification method. [#214](https://github.com/galacean/effects-runtime/pull/214) @Sruimeng

## 1.2.2

`2024-03-15`

- Fix: Fixed the type inference issue in `loadScene`. [#206](https://github.com/galacean/effects-runtime/pull/206) @RGCHN
- Fix: Fixed the flickering issue when switching spine animations. [#200](https://github.com/galacean/effects-runtime/pull/200) @RGCHN
- Fix: Text line height bug with setFontSize. [#199](https://github.com/galacean/effects-runtime/pull/199) @Sruimeng
- Test: Fix memory cases. [#190](https://github.com/galacean/effects-runtime/pull/190) @liuxi150

## 1.2.1

`2024-03-01`

- Fix: Fixed the issue of incorrect Spine version information retrieval caused by `Arraybuffer`. [#179](https://github.com/galacean/effects-runtime/pull/179) @RGCHN
- Fix: Added type assertion for `isString` util function. [#171](https://github.com/galacean/effects-runtime/pull/171) @zheeeng
- Fix: Added error handling for functions in `loadScene`. [#164](https://github.com/galacean/effects-runtime/pull/164) @RGCHN
- Fix: Fixed the problem of `AssetManager` timers not being cancelled in a timely manner. [#159](https://github.com/galacean/effects-runtime/pull/159) @RGCHN

## 1.2.0

`2024-01-30`

- Feat: Import spine-core by npm package instead of copy code. [#59](https://github.com/galacean/effects-runtime/pull/59) @RGCHN
  - Feat: Added polyfill for TextDecoder. [#125](https://github.com/galacean/effects-runtime/pull/125) @RGCHN
  - Feat: Added error message for incompatible Spine versions. [#127](https://github.com/galacean/effects-runtime/pull/127) @RGCHN
  - Fix: Fixed frame comparison and version warning issues in Spine. [#154](https://github.com/galacean/effects-runtime/pull/154) @RGCHN
- Refactor: Changed handleEnd to onEnd and added comments. [#92](https://github.com/galacean/effects-runtime/pull/92) @RGCHN
- Refactor: Refactored logging function by implementing a separate function. [#150](https://github.com/galacean/effects-runtime/pull/150) @RGCHN
- Fix(build): Fixed the issue of spine-core not being compiled. [#128](https://github.com/galacean/effects-runtime/pull/128) @yiiqii
- Perf: remove polyfill, add compat lint rules. [#126](https://github.com/galacean/effects-runtime/pull/126) @yiiqii
  - chore: replace Object.values with Object.keys
  - chore: update specification for remove Object.entries as it is not supported on low-end devices
  - build: add eslint plugin compat for auto check browser compatibility

## 1.1.8

`2024-01-26`

- Fix: windows shader compile problem and update case test player version. [#141](https://github.com/galacean/effects-runtime/pull/141) @liuxi150
- Fix: Fixed memory leak in Spine elements during composition replay. [#116](https://github.com/galacean/effects-runtime/pull/116) @RGCHN
- Fix: Removed unnecessary WebGL version mismatch warning. [#115](https://github.com/galacean/effects-runtime/pull/115) @liuxi150
- Test: Fixed pre-composition order unit test. [#140](https://github.com/galacean/effects-runtime/pull/140) @RGCHN
- Style: Optimized error messages for image loading. [#143](https://github.com/galacean/effects-runtime/pull/143) @RGCHN

## 1.1.7

`2024-01-22`

- Fix: Fixed rendering order issue in pre-composition. [#132](https://github.com/galacean/effects-runtime/pull/132) @RGCHN

## 1.1.6

`2024-01-16`

- Fix: 3d resize problem. [#118](https://github.com/galacean/effects-runtime/pull/118) @liuxi150

## 1.1.5

`2024-01-12`

- Fix: Handling for editor errors. [#107](https://github.com/galacean/effects-runtime/pull/107) @RGCHN
- Perf: Optimize composition time forward logic. [#106](https://github.com/galacean/effects-runtime/pull/106) @RGCHN
- Fix: Particles couldn't be clicked during replay. [#105](https://github.com/galacean/effects-runtime/pull/105) @RGCHN
- Fix(demo): iOS postMessage targetOrigin is required. [#104](https://github.com/galacean/effects-runtime/pull/104) @yiiqii

## 1.1.4

`2024-01-05`

- Fix: Screen not cleared after composition destruction. [#91](https://github.com/galacean/effects-runtime/pull/91) @RGCHN
- Fix: Issue with data template not updating correctly during repeated loads. [#89](https://github.com/galacean/effects-runtime/pull/89) @RGCHN
- Fix: Batch problem with spine vertices exceeding the limit. [#86](https://github.com/galacean/effects-runtime/pull/86) @RGCHN
- Fix: Issue with particle and camera follow movement. [#85](https://github.com/galacean/effects-runtime/pull/85) @RGCHN
- Fix: Spine elements not disappearing as expected when configured as reusable. [#84](https://github.com/galacean/effects-runtime/pull/84) @RGCHN
- Fix: Rendering error caused by missing mesh in spine's first frame. [#82](https://github.com/galacean/effects-runtime/pull/82) @RGCHN
- Perf: Optimized logic for image updates during multiple loads. [#96](https://github.com/galacean/effects-runtime/pull/96) @RGCHN
- Chore: add Github issue template. [#87](https://github.com/galacean/effects-runtime/pull/87) @zheeeng

## 1.1.3

`2023-12-22`

- Fix: Fix the frame drop problem caused by ticker. [#65](https://github.com/galacean/effects-runtime/pull/65) @wumaolinmaoan
- Fix: Texture retrieval and action setting issue for Spine. [#63](https://github.com/galacean/effects-runtime/pull/63) @RGCHN
- Fix: Multi-layer mask penetration issue. [#60](https://github.com/galacean/effects-runtime/pull/60) @RGCHN
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

- Feat: Added support for direct parsing and playback of pre-compositions, and unified math library. [#3cd9c82](https://github.com/galacean/effects-runtime/commit/3cd9c8265013407f4aa9b52fe0c838e7ffecb66d)
- Fix: Solve pre composition problem in 3D plugin. [#27](https://github.com/galacean/effects-runtime/pull/27) @liuxi150
- Fix: Errors about visible and transform when setting. [#25](https://github.com/galacean/effects-runtime/pull/25) @RGCHN
- Fix: HitTest bug in pre-composition. [#9](https://github.com/galacean/effects-runtime/pull/9) @RGCHN
- Fix: Resolved dragging issue. [#8](https://github.com/galacean/effects-runtime/pull/8) @liuxi150
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
