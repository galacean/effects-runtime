`effects-runtime` follows [Semantic Versioning 2.0.0](http://semver.org/).

#### Release Schedule
- **Weekly release**: patch version at the end of every week for routine bugfix (anytime for urgent bugfix).
- **Monthly release**: minor version at the end of every month for new features.
- Major version release is not included in this schedule for breaking change and new features.

---

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
- Feat: video template。[#224](https://github.com/galacean/effects-runtime/pull/224) @Sruimeng

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
