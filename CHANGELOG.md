`effects-runtime` follows [Semantic Versioning 2.0.0](http://semver.org/).

#### Release Schedule
- **Weekly release**: patch version at the end of every week for routine bugfix (anytime for urgent bugfix).
- **Monthly release**: minor version at the end of every month for new features.
- Major version release is not included in this schedule for breaking change and new features.

---
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
