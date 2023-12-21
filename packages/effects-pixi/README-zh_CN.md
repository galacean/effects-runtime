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

## API 文档

[Galacean Effects THREE.JS API 文档](https://galacean.antgroup.com/effects/#/api/modules_galacean_effects_threejs)
