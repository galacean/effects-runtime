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

## Parameter Description

```ts
/**
 * Scene loading parameters
 */
export interface SceneLoadOptions {
  /**
   * Parameters for dynamic data
   * key is the field name configured in JSON
   * value is the value to be used, images use URL links
   * Image links can be passed as an array, if the first one fails to load, the second address will be tried
   *
   * @example
   * ```ts
   * {
   *   variables: {
   *     bg: ['url','fallback_url'], // If both images fail, a load failure will be triggered
   *     fg: 'url' // If the image fails to load, a load failure will be triggered,
   *     amount: 88.8,
   *     name: 'abc'
   *   }
   * }
   * ```
   */
  variables?: Record<string, number | string | string[]>;
  /**
   * Whether to use compressed textures
   */
  useCompressedTexture?: boolean;
  /**
   * Render level.
   * After grading, only resources of the current render level will be loaded.
   * When the render level is set to B, the player's fps will drop to 30 frames
   * @default 'S'
   */
  renderLevel?: SceneRenderLevel;
  /**
   * Resource load timeout, in seconds
   * @default 10s
   */
  timeout?: number;
  /***
   * Data for plugin loading
   * key/value content is implemented by the plugin itself
   */
  pluginData?: Record<string, any>;
  /**
   * Environment when loading the scene (write the env result into the scene after loading)
   * @default '' - 'editor' in the editor
   */
  env?: string;
  /**
   * Whether to autoplay after loading
   * @default true
   */
  autoplay?: boolean;
  /**
   * Whether to reuse after the composition playback is complete, if so, it will not `dispose` after the lifecycle ends
   * @default false
   */
  reusable?: boolean;
  /**
   * Playback speed, when the speed is negative, the composition plays in reverse
   */
  speed?: number;
}
```

## Event System

The event system of ThreeDisplayObject is inherited from THREE.js, and the event is triggered in the form of `dispatch`. Refer to the code below:

```ts
import { ThreeDisplayObject } from '@galacean/effects-threejs';

const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });
// Load Galacean Effects product
const composition = await displayObject.loadScene('./xxx.json');
// Add the drawing object to the THREE scene
scene.add(displayObject);

## [API Documentation](https://galacean.antgroup.com/effects/#/api/modules_galacean_effects_threejs)
