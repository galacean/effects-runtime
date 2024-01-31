<div align="center"><a name="readme-top"></a>

<h1>Galacean Effects</h1>

加载并渲染酷炫的动效，通过 effects-core 提供的 APIs 也可以让你的引擎使用动效产物，快速的接入图层、粒子等动画效果。

![GitHub release (with filter)](https://img.shields.io/github/v/release/galacean/effects-runtime)
![GitHub License](https://img.shields.io/github/license/galacean/effects-runtime)
![GitHub top language](https://img.shields.io/github/languages/top/galacean/effects-runtime)

[更新日志](./CHANGELOG.md) · [报告问题][github-issues-url] · [特性需求][github-issues-url] · [English](./README.md) · 中文

![](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<h3>所见 · 即所得</h3>
<img height="320" src="https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*BrMIQqkmbKEAAAAAAAAAAAAADvV6AQ/original">
<img height="320" src="https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*VHMAR6Vq_8wAAAAAAAAAAAAADvV6AQ/original">
<img height="320" src="https://mdn.alipayobjects.com/huamei_klifp9/afts/img/A*UwMWT4uY6jsAAAAAAAAAAAAADvV6AQ/original">

<!-- Copy-paste in your Readme.md file -->

<a href="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats?repo_id=715920076" target="_blank" style="display: block" align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=715920076&image_size=auto&color_scheme=dark" width="655" height="auto">
    <img alt="Performance Stats of galacean/effects-runtime - Last 28 days" src="https://next.ossinsight.io/widgets/official/compose-last-28-days-stats/thumbnail.png?repo_id=715920076&image_size=auto&color_scheme=light" width="655" height="auto">
  </picture>
</a>

<!-- Made with [OSS Insight](https://ossinsight.io/) -->

[github-issues-url]: https://github.com/galacean/effects-runtime/issues
</div>

## 安装

``` bash
npm install @galacean/effects --save
```

``` bash
pnpm add @galacean/effects
```

## 示例

``` html
<div id="J-Container"></div>
```

``` ts
import { Player } from '@galacean/effects';

// 1. 实例化一个播放器
const player = new Player({
  container: document.getElementById('J-Container'),
});

// 2. 加载并播放动效资源
player.loadScene('./demo.json');
```

> 通过 [Galacean Effects](https://galacean.antgroup.com/effects/) 编辑器获取 `demo.json` 产物

## 相关文档

- [开发文档](https://galacean.antgroup.com/effects/#/user/dgmswcgk63yfngku)
- [接入指南](https://galacean.antgroup.com/effects/#/user/ti4f2yx1rot4hs1n)
- [API 文档](https://galacean.antgroup.com/effects/#/api)
- 其他链接:
  - [本地开发](docs/developing.md)


