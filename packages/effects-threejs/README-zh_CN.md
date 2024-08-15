# Galacean Effects 的 THREE.JS 插件

使用此插件，可以在 THREE.JS 环境下加载并渲染 Galacean Effects 动效。

## 版本说明

- Three.js ![](https://img.shields.io/badge/npm-0.149.0-green.svg?style=flat-square)

## 使用步骤

### 1、THREE.JS 场景初始化

在 THREE.JS 中实现 Galacean Effects 首先要创建一个 THREE.JS 场景：

``` ts
import * as THREE from 'three';

// 创建一个 renderer
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  stencil: true,
  antialias: true,
  depth: true,
  premultipliedAlpha: true,
});
// 创建一个场景
const scene = new THREE.Scene();
const container = document.getElementById('J-container');
const { width, height } = container.getBoundingClientRect();
// 创建一个相机
const camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);

camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);
scene.add(camera);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

container.appendChild(renderer.domElement);
```

### 2、ThreeDisplayObject 实例化和资源加载

``` ts
import { ThreeDisplayObject } from '@galacean/effects-threejs';

const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });
// 加载 Galacean Effects 产物
await displayObject.loadScene('./xxx.json');
// 将绘制对象添加到 THREE 的 scene 中
scene.add(displayObject);
```

### 3、执行 THREE.JS 渲染

``` ts
const { currentComposition } = displayObject;
let lastTime = performance.now();

function render () {
  // 判断当前合成是否被销毁
  if (!currentComposition.isDestroyed) {
    displayObject.update(performance.now() - lastTime);
  }

  lastTime = performance.now();
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

render();
```

## 参数说明

``` ts
/**
 * 场景加载参数
 */
export interface SceneLoadOptions {
  /**
   * 动态数据的参数
   * key 是 JSON 中配置的字段名
   * value 是要使用的值，图片使用 url 链接
   * 图片链接可以使用数组传递，如果第一个加载失败，将尝试使用第二个地址
   *
   * @example
   * ``` ts
   * {
   *   variables: {
   *     bg: ['url','fallback_url'], // 如果两个图片都失败，将会触发加载失败
   *     fg: 'url' // 如果图片加载失败，将会触发加载失败,
   *     amount: 88.8,
   *     name: 'abc'
   *   }
   * }
   * ```
   */
  variables?: Record<string, number | string | string[]>;
  /**
   * 是否使用压缩纹理
   */
  useCompressedTexture?: boolean;
  /**
   * 渲染分级。
   * 分级之后，只会加载当前渲染等级的资源。
   * 当渲染等级被设置为 B 后，player 的 fps 会降到 30 帧
   * @default 'S'
   */
  renderLevel?: SceneRenderLevel;
  /**
   * 资源加载超时，时间单位秒
   * @default 10s
   */
  timeout?: number;
  /***
   * 用于给 plugin 的加载数据
   * key/value 的内容由 plugin 自己实现
   */
  pluginData?: Record<string, any>;
  /**
   * 场景加载时的环境（加载后把 env 结果写入 scene）
   * @default '' - 编辑器中为 'editor'
   */
  env?: string;
  /**
   * 加载后是否自动播放
   * @default true
   */
  autoplay?: boolean;
  /**
   * 合成播放完成后是否需要再使用，是的话生命周期结束后不会 `dispose`
   * @default false
   */
  reusable?: boolean;
  /**
   * 播放速度，当速度为负数时，合成倒播
   */
  speed?: number;
}
```

## 事件系统

ThreeDisplayObject 的事件系统沿用自 THREE.js，事件触发形式为 `dispatch` 参考代码如下

``` ts
import { ThreeDisplayObject } from '@galacean/effects-threejs';

const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });
// 加载 Galacean Effects 产物
const composition = await displayObject.loadScene('./xxx.json');
// 将绘制对象添加到 THREE 的 scene 中
scene.add(displayObject);

displayObject.addEventListener('end', ()=>{
  // 示例代码
  console.info('composition is end')
});
```

## API 文档

[Galacean Effects THREE.JS API 文档](https://galacean.antgroup.com/effects/#/api/modules_galacean_effects_threejs)
