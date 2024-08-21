<div align="center"><a name="readme-top"></a>

<h1>Galacean Effects</h1>

It can load and render cool animation effects, The APIs provided by effects-core allow your engine to quickly access animation data such as layer and particle animation.

![GitHub release (with filter)](https://img.shields.io/github/v/release/galacean/effects-runtime)
![GitHub License](https://img.shields.io/github/license/galacean/effects-runtime)
![GitHub top language](https://img.shields.io/github/languages/top/galacean/effects-runtime)

[Native](https://github.com/galacean/effects-native) · [Changelog](./CHANGELOG.md) · [Report Bug][github-issues-url] · [Request Feature][github-issues-url] · English · [中文](./README-zh_CN.md)

![](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<h3>What you see is what you get</h3>
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

## Install

``` bash
npm install @galacean/effects
```

``` bash
pnpm add @galacean/effects
```

## Usage

``` html
<div id="J-Container"></div>
```

``` ts
import { Player } from '@galacean/effects';

// 1. Instantiate a player
const player = new Player({
  container: document.getElementById('J-Container'),
});

// 2. Load and play the animation resource
player.loadScene('./demo.json');
```

> Get the `demo.json` by using the [Galacean Effects](https://galacean.antgroup.com/effects/) editor.

## Documentation

- [Development Documentation](https://galacean.antgroup.com/effects/user/dgmswcgk63yfngku)
- [Integration Guide](https://galacean.antgroup.com/effects/user/ti4f2yx1rot4hs1n)
- [API Documentation](https://galacean.antgroup.com/effects/api)
- Useful Links:
  - [Developing](docs/developing.md)


