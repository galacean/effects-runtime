`effects-runtime` follows [Semantic Versioning 2.0.0](http://semver.org/).

#### Release Schedule
- **Weekly release**: patch version at the end of every week for routine bugfix (anytime for urgent bugfix).
- **Monthly release**: minor version at the end of every month for new features.
- Major version release is not included in this schedule for breaking change and new features.

---

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

- Fix: Fixed the issue with Spine blend mode. [#1011](https://github.com/galacean/effects-runtime/pull/1011) @RGCHN
- Fix: old json texture mask migration. [#1012](https://github.com/galacean/effects-runtime/pull/1012) @wumaolinmaoan
  - Fix: alpha mask default value. [#1013](https://github.com/galacean/effects-runtime/pull/1013) @wumaolinmaoan

## 2.4.3

`2025-05-21`

- Fix: harmony device detection. [#1006](https://github.com/galacean/effects-runtime/pull/1006) @wumaolinmaoan

## 2.4.2

`2025-05-16`

- Fix: The video does not replay and flickers during loop playback. [#995](https://github.com/galacean/effects-runtime/pull/995) @yuufen
- Fix: rich text plugin name migration. [#999](https://github.com/galacean/effects-runtime/pull/999) @wumaolinmaoan

## 2.4.1

`2025-05-15`

- Fix: mask is still drawn when the component is not activated. [#993](https://github.com/galacean/effects-runtime/pull/993) @wumaolinmaoan
- Fix: recover when plugins not import will console the install tips. [#991](https://github.com/galacean/effects-runtime/pull/991) @yiiqii
- Fix: mask value distribution cache error. [#989](https://github.com/galacean/effects-runtime/pull/989) @wumaolinmaoan
- Fix: loaded composition array order is wrong. [#990](https://github.com/galacean/effects-runtime/pull/990) @wumaolinmaoan

## 2.4.0

`2025-05-14`

- Feat: Image masks and directional masks. [#901](https://github.com/galacean/effects-runtime/pull/901) @RGCHN
  - Feat: support mask render. [#982](https://github.com/galacean/effects-runtime/pull/982) @wumaolinmaoan
  - Fix: remove `setMaskMode` color mask parameter. [#984](https://github.com/galacean/effects-runtime/pull/984) @wumaolinmaoan
  - Fix: Added version conversion handling for masks. [#940](https://github.com/galacean/effects-runtime/pull/940) @RGCHN
  - Fix: Enhanced compatibility for mask data in rich text elements. [#952](https://github.com/galacean/effects-runtime/pull/952) @RGCHN
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
- Fix: Fixed the rendering issue with Spine blending modes. [#972](https://github.com/galacean/effects-runtime/pull/972) @RGCHN

## 2.3.4

`2025-05-09`

- Fix: The spine cannot loop the last action. [#965](https://github.com/galacean/effects-runtime/pull/965) @RGCHN
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

- Feat: Added logic for Android to default to using WebGL2. [#861](https://github.com/galacean/effects-runtime/pull/861) @RGCHN
- Feat: Extended the `setTexture` method to support direct input of resource URLs. [#862](https://github.com/galacean/effects-runtime/pull/862) @Sruimeng
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
- Feat: Added an `onError` parameter to the `Player` initialization options to capture all exceptions during `new Player` or `loadScene`. [#905](https://github.com/galacean/effects-runtime/pull/905) @yiiqii
- Feat: Support for dynamically modifying the maximum number of particles. [#913](https://github.com/galacean/effects-runtime/pull/913) @RGCHN
  - Feat: opt max particles properties name and note. [#918](https://github.com/galacean/effects-runtime/pull/918) @wumaolinmaoan
- Feat: Exposed video play and pause methods of the multimedia plugin and fixed video freeze logic. [#871](https://github.com/galacean/effects-runtime/pull/871) @Sruimeng
- Feat: enhance video component for transparent video support. [#888](https://github.com/galacean/effects-runtime/pull/888) @Sruimeng
  - Fix: improve alpha blending in transparent video shader. [#907](https://github.com/galacean/effects-runtime/pull/907) @Sruimeng
- Feat: Added implementation for unsupported methods in the rich text component. [#892](https://github.com/galacean/effects-runtime/pull/892) @Sruimeng
- Feat: Added support for text overflow modes and optimized text line count calculations. [#898](https://github.com/galacean/effects-runtime/pull/898) @Sruimeng
  - Fix: Fixed issues with text component line count calculation and font description logic. [#927](https://github.com/galacean/effects-runtime/pull/927) @Sruimeng
- Feat(rich-text): Added support for rich text size parameters and refactored text rendering logic. [#900](https://github.com/galacean/effects-runtime/pull/900) @Sruimeng
- Feat(rich-text): Supported letter spacing adjustments and optimized text rendering logic. [#906](https://github.com/galacean/effects-runtime/pull/906) @Sruimeng
- Fix: camera view matrix calculate. [#912](https://github.com/galacean/effects-runtime/pull/912) @wumaolinmaoan
- Fix: Improved the processing of colors and uniform variables in `ThreeMaterial`. [#917](https://github.com/galacean/effects-runtime/pull/917) @Sruimeng
- Fix: geometry bounding box. [#915](https://github.com/galacean/effects-runtime/pull/915) @wumaolinmaoan
- Fix: camera gesture rotation. [#926](https://github.com/galacean/effects-runtime/pull/926) @wumaolinmaoan
- Refactor: Refactored the `version31Migration` function and its calculation location. [#890](https://github.com/galacean/effects-runtime/pull/890) @Sruimeng
- Refactor: base render component set color use math.Color type. [#908](https://github.com/galacean/effects-runtime/pull/908) @wumaolinmaoan
  - Fix: sprite color unit test. [#910](https://github.com/galacean/effects-runtime/pull/910) @wumaolinmaoan
- Refactor: Scene load and pre composition instantiation logic. [#909](https://github.com/galacean/effects-runtime/pull/909) @wumaolinmaoan
  - Refactor: Refactored the THREE plugin to follow the Player's `loadScene` multi-composition changes. [#928](https://github.com/galacean/effects-runtime/pull/928) @yiiqii
    - test: Added frame comparison test cases.
    - fix: typo issue
  - Refactor: plugin system register and precompile logic. [#922](https://github.com/galacean/effects-runtime/pull/922) @wumaolinmaoan
    - fix 3d rendering error caused by precompile timing
  - Fix: composition index issue. [#921](https://github.com/galacean/effects-runtime/pull/921) @yiiqii
  - Fix: 3d unit test. [#923](https://github.com/galacean/effects-runtime/pull/923) @wumaolinmaoan
- Perf: Removed the `string-hash` dependency, unifying the use of internal methods. [#877](https://github.com/galacean/effects-runtime/pull/877) @yiiqii
- Build: Minified the output for mini-programs. [#911](https://github.com/galacean/effects-runtime/pull/911) @yiiqii
- Chore: Replaced the resources used in the Spine multi-composition demo. [#919](https://github.com/galacean/effects-runtime/pull/919) @RGCHN

## 2.2.7

`2025-02-28`

- Fix: The sampling of the curve's start and end points does not differentiate between types of keyframes. [#889](https://github.com/galacean/effects-runtime/pull/889) @RGCHN

## 2.2.6

`2025-02-21`

- Fix: Corrected the name of the rich text plugin. [#873](https://github.com/galacean/effects-runtime/pull/873) @Sruimeng
- Fix: Fixed the error at the end of the freeze frame keyframe. [#876](https://github.com/galacean/effects-runtime/pull/876) @RGCHN
- Fix: Resolved an error in the event system after the player is destroyed. [#872](https://github.com/galacean/effects-runtime/pull/872) @Sruimeng
- Chore(deps): bump @vvfx/resource-detection to 0.7.1. [#875](https://github.com/galacean/effects-runtime/pull/875) @yiiqii

## 2.2.5

`2025-02-14`

- Fix: Resolved the issue where rich text rendering resulted in a blank screen. [#857](https://github.com/galacean/effects-runtime/pull/857) @Sruimeng
- Fix: Eliminated the logic where an additional particle was removed upon clicking. [#863](https://github.com/galacean/effects-runtime/pull/863) @RGCHN
- Fix: Removed the logic where an HTTP request response code of 0 indicated success. [#860](https://github.com/galacean/effects-runtime/pull/860) @RGCHN
- Fix: 3d mesh max joint and camera rotation error. [#858](https://github.com/galacean/effects-runtime/pull/858) @wumaolinmaoan

## 2.2.4

`2025-02-07`

- Fix: update texture and material in TextComponentBase. [#855](https://github.com/galacean/effects-runtime/pull/855) @Sruimen

## 2.2.3

`2025-02-07`

- Fix: interact item drag invalid when delayed. [#849](https://github.com/galacean/effects-runtime/pull/849) @wumaolinmaoan
- Fix: Resolve the issue with text masking. [#848](https://github.com/galacean/effects-runtime/pull/848) @Sruimeng
- Fix: opt render level filter logic. [#844](https://github.com/galacean/effects-runtime/pull/844) @wumaolinmaoan
- Chore: add gl lost check when framebuffer failed. [#841](https://github.com/galacean/effects-runtime/pull/841) @wumaolinmaoan

## 2.2.2

`2025-01-13`

- Chore: add framebuffer creation failed error. [#836](https://github.com/galacean/effects-runtime/pull/836) @wumaolinmaoan

## 2.2.1

`2025-01-03`

- Fix: Resolved the issue of bold font in rich text on Android devices. [#824](https://github.com/galacean/effects-runtime/pull/824) @Sruimeng
- Fix: bounding box offset. [#822](https://github.com/galacean/effects-runtime/pull/822) @wumaolinmaoan

## 2.2.0

`2024-12-31`

- Feat: Enhanced rich text size handling, with support for vertical text alignment. [#789](https://github.com/galacean/effects-runtime/pull/789) @Sruimeng
- Feat: Added `overflow` interface for rich text. [#813](https://github.com/galacean/effects-runtime/pull/813) @Sruimeng
- Feat: Introduced parameters to disable `avif/webp` formats. [#805](https://github.com/galacean/effects-runtime/pull/805) @RGCHN
- Feat: Exported the rich-text-loader module. [#814](https://github.com/galacean/effects-runtime/pull/814) @yiiqii
- Refactor: Refactored the initialization parameters for the Stats plugin to support custom containers and visibility options. [#798](https://github.com/galacean/effects-runtime/pull/798) @yiiqii
- Refactor: timeline playables structure. [#788](https://github.com/galacean/effects-runtime/pull/788) @wumaolinmaoan
- Perf: opt timeline evaluate performance. [#809](https://github.com/galacean/effects-runtime/pull/809) @wumaolinmaoan
- Fix: item render order. [#816](https://github.com/galacean/effects-runtime/pull/816) @wumaolinmaoan
- Fix: Fixed an issue where WebGL creation failure caused errors during player destruction. [#817](https://github.com/galacean/effects-runtime/pull/817) @Sruimeng
- Fix: Resolved errors related to threejs rendering. [#818](https://github.com/galacean/effects-runtime/pull/818) @Sruimeng
- Chore: upgrade devDependencies. [#793](https://github.com/galacean/effects-runtime/pull/793) @yiiqii

## 2.1.5

`2024-12-27`

- Fix: Resolve the issue with message element triggering. [#801](https://github.com/galacean/effects-runtime/pull/801) @Sruimeng
  - Fix: message item triggering issue caused by time accuracy. [#804](https://github.com/galacean/effects-runtime/pull/804) @wumaolinmaoan
- Fix: player fps setting. [#802](https://github.com/galacean/effects-runtime/pull/802) @wumaolinmaoan

## 2.1.4

`2024-12-20`

- Perf: opt sprite shader alpha clip performance. [#794](https://github.com/galacean/effects-runtime/pull/794) @wumaolinmaoan
- Test: Enhance certain unit test types and optimize the messaging for frame comparison failures. [#792](https://github.com/galacean/effects-runtime/pull/792) @yiiqii

## 2.1.3

`2024-12-16`

- Perf: opt particle rotation calculate performance. [#787](https://github.com/galacean/effects-runtime/pull/787) @wumaolinmaoan
- Fix: Resolved the issue with custom fonts in rich text. [#784](https://github.com/galacean/effects-runtime/pull/784) @Sruimeng
- Fix: restore default font settings in richtext component rendering. [#781](https://github.com/galacean/effects-runtime/pull/781) @Sruimeng
- Fix: particle system rotation over lifetime always exist. [#779](https://github.com/galacean/effects-runtime/pull/779) @wumaolinmaoan
- Fix: Added a notification to install when using newly added plugins. [#778](https://github.com/galacean/effects-runtime/pull/778) @yiiqii
- Fix: support rich text type in player and enhance rich text component. [#777](https://github.com/galacean/effects-runtime/pull/777) @Sruimeng
- Fix: Implemented a check for the BOM object in SSR environments before usage. [#767](https://github.com/galacean/effects-runtime/pull/767) @RGCHN
  - Refactor: avoid BOM access when server-side rendering. [#782](https://github.com/galacean/effects-runtime/pull/782) @PeachScript
  - Fix: return can only be used within a function body. [#783](https://github.com/galacean/effects-runtime/pull/783) @yiiqii
- Fix: texture source from cache error. [#775](https://github.com/galacean/effects-runtime/pull/775) @wumaolinmaoan
- Fix: sprite billboard. [#774](https://github.com/galacean/effects-runtime/pull/774) @wumaolinmaoan
- Fix: track bindings are set incorrectly when there are reused precompositions. [#773](https://github.com/galacean/effects-runtime/pull/773) @wumaolinmaoan
- Test: Reorganized and refined the code for frame comparison tests. [#780](https://github.com/galacean/effects-runtime/pull/780) @yiiqii
- Chore: imgui add node graph. [#786](https://github.com/galacean/effects-runtime/pull/786) @wumaolinmaoan

## 2.1.2

`2024-11-29`

- Fix: Optimized the calculation logic for the player's dimensions to ensure accurate width and height retrieval across various environments. [#762](https://github.com/galacean/effects-runtime/pull/762) @Sruimeng
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
  - Feat: Added compilation time statistics. [#660](https://github.com/galacean/effects-runtime/pull/660) @yiiqii
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
- Feat: Added audio and video plugins. [#666](https://github.com/galacean/effects-runtime/pull/666) @Sruimeng
  - Feat(mutilmedia): Added logic to check autoplay permissions for audio and video loaders. [#680](https://github.com/galacean/effects-runtime/pull/680) @Sruimeng
  - Feat: add autoplay permission check in audio and video loaders. [#713](https://github.com/galacean/effects-runtime/pull/713) @Sruimeng
  - Refactor: Optimized the invocation logic of plugin assets. [#682](https://github.com/galacean/effects-runtime/pull/682) @yiiqii
  - Fix(video): Fixed the issue where video rendering did not align with element end behavior. [#690](https://github.com/galacean/effects-runtime/pull/690) @Sruimeng
  - Fix: Fixed support for masks in the video component. [#731](https://github.com/galacean/effects-runtime/pull/731) @Sruimeng
  - Fix: Fixed audio and video loading plugins, simplified precompilation logic, and enhanced video playback control. [#736](https://github.com/galacean/effects-runtime/pull/736) @Sruimeng
- Feat: add material track. [#683](https://github.com/galacean/effects-runtime/pull/683) @wumaolinmaoan
- Feat: improve the track binding update. [#688](https://github.com/galacean/effects-runtime/pull/688) @wumaolinmaoan
- Feat: add color and vector4 track. [#691](https://github.com/galacean/effects-runtime/pull/691) @wumaolinmaoan
- Feat: Added an interface to modify the drag range of interactive elements. [#689](https://github.com/galacean/effects-runtime/pull/689) @RGCHN
- Feat: add vector4 property mixer. [#692](https://github.com/galacean/effects-runtime/pull/692) @wumaolinmaoan
- Feat: editor mode support external skybox. [#697](https://github.com/galacean/effects-runtime/pull/697) @liuxi150
- Feat: fake 3d component. [#701](https://github.com/galacean/effects-runtime/pull/701) @wumaolinmaoan
- Feat: property clip use normalized time. [#714](https://github.com/galacean/effects-runtime/pull/714) @wumaolinmaoan
- Feat: item active setting. [#716](https://github.com/galacean/effects-runtime/pull/716) @wumaolinmaoan
  - fix: ref compostion `setVisible()` invalid
- Feat: material add color and mainTexture interface. [#722](https://github.com/galacean/effects-runtime/pull/722) @wumaolinmaoan
- Feat: Added rich text plugin. [#704](https://github.com/galacean/effects-runtime/pull/704) @Sruimeng
  - Fix: update default text value and adjust scaling in rich text component. [#739](https://github.com/galacean/effects-runtime/pull/739) @Sruimeng
  - Fix: the reporting words for unexpected parse result. [#745](https://github.com/galacean/effects-runtime/pull/745) @zheeeng
  - Fix: Added a space when rich text contains only newline characters and optimized dirty flag handling with no content. [#749](https://github.com/galacean/effects-runtime/pull/749) @Sruimeng
- Feat: add goto event for composition and improve texture cleanup on destroy. [#743](https://github.com/galacean/effects-runtime/pull/743) @Sruimeng
- Feat: timeline asset add flattened tracks property. [#748](https://github.com/galacean/effects-runtime/pull/748) @wumaolinmaoan
- Refactor: remove processTextures dependency on engine. [#662](https://github.com/galacean/effects-runtime/pull/662) @wumaolinmaoan
- Refactor: vfx item find use BFS. [#667](https://github.com/galacean/effects-runtime/pull/667) @wumaolinmaoan
- Refactor: Removed redundant `imgUsage` and `usedImages` logic. [#672](https://github.com/galacean/effects-runtime/pull/672) @yiiqii
  - fix(demo): Unified local demo resources under the public directory.
  - style(type): Standardized the shape type.
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
- Fix: Supplemented the adaptation of `TextDecoder`. [#642](https://github.com/galacean/effects-runtime/pull/642) @yiiqii
- Fix: `onStart` is called twice. [#645](https://github.com/galacean/effects-runtime/pull/645) @wumaolinmaoan
- Fix: composition reverse delay. [#648](https://github.com/galacean/effects-runtime/pull/648) @wumaolinmaoan
- Fix: remove unnecessary alpha multiplication in color grading. [#653](https://github.com/galacean/effects-runtime/pull/653) @wumaolinmaoan
- Fix: image asset load error. [#663](https://github.com/galacean/effects-runtime/pull/663) @wumaolinmaoan
- Fix: Fixed the issue with `AssetManager` loading JSON objects. [#668](https://github.com/galacean/effects-runtime/pull/668) @yiiqii
  - style(type): Standardized `Image` and `Assets` data types and improved related `AssetManager` types.
  - test: Added unit tests for `AssetManager` and `loadScene`.
  - style: Unified the use of built-in objects as defined in the spec.
- Fix: Fixed particle rendering issues with threejs & video replay issues. [#684](https://github.com/galacean/effects-runtime/pull/684) @Sruimeng
- Fix: interact item click invalid when composition restart. [#693](https://github.com/galacean/effects-runtime/pull/693) @wumaolinmaoan
- Fix: Added player `pause` event. [#700](https://github.com/galacean/effects-runtime/pull/700) @yiiqii
  - docs: Added related tsdoc.
- Fix: Fixed Spine element masking issues. [#706](https://github.com/galacean/effects-runtime/pull/706) @RGCHN
- Fix: on end called too early. [#711](https://github.com/galacean/effects-runtime/pull/711) @wumaolinmaoan
- Fix: message interact item. [#721](https://github.com/galacean/effects-runtime/pull/721) @wumaolinmaoan
- Fix: Added a check before using the downgrade plugin `window`. [#728](https://github.com/galacean/effects-runtime/pull/728) @RGCHN
- Fix: playable asset export. [#737](https://github.com/galacean/effects-runtime/pull/737) @wumaolinmaoan
- Fix: color property track create wrong mixer. [#738](https://github.com/galacean/effects-runtime/pull/738) @wumaolinmaoan
- Chore: imgui add show canvas menu button. [#652](https://github.com/galacean/effects-runtime/pull/652) @wumaolinmaoan
- Chore: Removed the dynamic data logic when `loadScene` is a scene object. [#678](https://github.com/galacean/effects-runtime/pull/678) @yiiqii
- Chore: update specification. [#694](https://github.com/galacean/effects-runtime/pull/694) @wumaolinmaoan
- Chore: unit test add canvas display. [#724](https://github.com/galacean/effects-runtime/pull/724) @wumaolinmaoan
- Chore: add half float texture support check. [#725](https://github.com/galacean/effects-runtime/pull/725) @wumaolinmaoan
- Chore: remove item duration zero error check. [#732](https://github.com/galacean/effects-runtime/pull/732) @wumaolinmaoan
- Chore: opt composition start logic. [#742](https://github.com/galacean/effects-runtime/pull/742) @wumaolinmaoan
- Chore: remove test shape interface. [#744](https://github.com/galacean/effects-runtime/pull/744) @wumaolinmaoan
- Chore: update resource-detection and fix type issue. [#752](https://github.com/galacean/effects-runtime/pull/752) @yiiqii
- Test: Enhanced dynamic video unit tests for `AssetManager`. [#661](https://github.com/galacean/effects-runtime/pull/661) @yiiqii
- Style: Unified the enumeration input types for `effectsClass`. [#677](https://github.com/galacean/effects-runtime/pull/677) @yiiqii

## 2.0.7

`2024-10-30`

- Fix: Resolve the Spine element masking issue. [#706](https://github.com/galacean/effects-runtime/pull/706) @RGCHN
- Fix: Remove unused code related to the render error queue in the Player class. [#664](https://github.com/galacean/effects-runtime/pull/664) @Sruimeng

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
