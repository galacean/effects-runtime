# Galacean Effects THREE.JS Plugin

With this plugin, you can load and render Galacean Effects animations within the THREE.JS environment.

## Version Information

- Three.js ![](https://img.shields.io/badge/npm-0.149.0-green.svg?style=flat-square)

## Usage

### 1、THREE.JS Scene Initialization

o implement Galacean Effects in THREE.JS, you need to first create a THREE.JS scene:

``` ts
import * as THREE from 'three';

// Create a renderer
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  stencil: true,
  antialias: true,
  depth: true,
  premultipliedAlpha: true,
});
// Create a scene
const scene = new THREE.Scene();
const container = document.getElementById('J-container');
const { width, height } = container.getBoundingClientRect();
// Create a camera
const camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);

camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);
scene.add(camera);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

container.appendChild(renderer.domElement);
```

### 2、ThreeDisplayObject Instantiation and Resource Loading

``` ts
import { ThreeDisplayObject } from '@galacean/effects-threejs';

const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });
// Load Galacean Effects output
await displayObject.loadScene('./xxx.json');
// Add the rendering object to the THREE scene
scene.add(displayObject);
```

### 3、Perform THREE.JS Renderingts

``` ts
const { currentComposition } = displayObject;
let lastTime = performance.now();

function render () {
  // Check if the current composition has been destroyed
  if (!currentComposition.isDestroyed) {
    displayObject.update(performance.now() - lastTime);
  }

  lastTime = performance.now();
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

render();
```

## [API Documentation](https://galacean.antgroup.com/effects/#/api/modules_galacean_effects_threejs)
