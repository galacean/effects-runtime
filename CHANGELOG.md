`effects-runtime` 遵循 [Semantic Versioning 2.0.0](http://semver.org/lang/zh-CN/) 语义化版本规范。

#### 发布周期

- 修订版本号：每周末会进行日常 bugfix 更新（如果有紧急的 bugfix，则任何时候都可发布）。
- 次版本号：每月发布一个带有新特性的向下兼容的版本。
- 主版本号：含有破坏性更新和新特性，不在发布周期内。

---
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
