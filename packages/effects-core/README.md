# Galacean Effects Core

The core runtime library for Galacean Effects, responsible for asset loading, scene management, and rendering.

## Basic Concepts

The **Composition** is the fundamental unit of animation playback in Galacean Effects. The `Composition` class manages the entire lifecycle from data parsing (JSON -> VFXItem -> RendererComponent) to the creation, updating, and destruction of render frames (`RenderFrame`) and render passes (`RenderPass`).

### Core Architecture

```
Engine
  ├── Composition
  │     ├── VFXItem (Element)
  │     │     ├── Component
  │     │     │     └── RendererComponent
  │     │     └── Transform
  │     ├── RenderFrame
  │     │     └── RenderPass
  │     └── Camera
  └── Resource Management
        ├── Texture
        ├── Material
        └── Geometry
```

Each composition contains different types of elements (`VFXItem`) and their components (`Component`), including:
- Camera component
- Sprite (layer) component
- Particle system
- Text component
- Interactive component

When a composition is created, it completes:
1. Loading of data assets
2. Creation of elements (`VFXItem`) and their components
3. Loading and creation of textures (`Texture`)
4. Initialization of `RenderFrame` and `RenderPass`

## Core Modules

### 1. Engine [Engine](./src/engine.ts)

`Engine` is the core entry point, responsible for managing all GPU resources and the lifecycle of compositions.

```typescript
import { Engine } from '@galacean/effects-core';

// Create engine
const engine = Engine.create(canvas, {
  fps: 60,
  pixelRatio: window.devicePixelRatio,
});
```

Main features:
- Manages the renderer (`Renderer`)
- Manages GPU resources (textures, materials, geometries)
- Manages creation and destruction of compositions
- Provides a ticker (`Ticker`) to drive the render loop
- Handles interactive events

### 2. Asset Management [AssetManager](./src/asset-manager.ts)

Responsible for loading all resources needed for effects:

```typescript
import { AssetManager } from '@galacean/effects-core';

const assetManager = new AssetManager(options);
```

Supported features:
1. Loading JSON and binary resources
2. Loading image and video resources
3. Selective resource downloading based on render level
4. Image/text template replacement
5. Font loading (via `AssetManager.loadFontFamily`)

### 3. Composition [Composition](./src/composition.ts)

Manages data processing and rendering for animation playback:

```typescript
const composition = new Composition(props, scene);

// Playback control
composition.play();
composition.pause();
composition.resume();

// Update
composition.update(deltaTime);

// Dispose
composition.dispose();
```

Main properties:
- `renderFrame`: The rendering data object for the current frame
- `rootItem`: The root element of the composition
- `camera`: The composition camera
- `speed`: Playback speed

### 4. VFX Element [VFXItem](./src/vfx-item.ts)

The base class for all effect elements, supporting component-based architecture:

```typescript
// Get component
const component = item.getComponent(SpriteComponent);

// Iterate children
item.children.forEach(child => {
  // ...
});

// Transform operations
item.transform.setPosition(x, y, z);
```

Main properties:
- `transform`: Position, rotation, scale transforms
- `components`: Component list
- `children`: Child element list

### 5. Component System [Component](./src/components/component.ts)

Components are functional units attached to VFXItem:

```typescript
abstract class Component extends EffectsObject {
  item: VFXItem;           // Owner element
  enabled: boolean;        // Whether enabled
  
  onAwake() {}             // Initialization
  onEnable() {}            // On enable
  onDisable() {}           // On disable
  onStart() {}             // Before first update
  onUpdate(dt: number) {}  // Per-frame update
  onLateUpdate(dt: number) {} // Late update
  onDestroy() {}           // On destroy
}
```

### 6. Renderer Component [RendererComponent](./src/components/renderer-component.ts)

The base class for all rendering components, responsible for adding renderable objects to render passes:

```typescript
class RendererComponent extends Component {
  material: Material;      // Material
  materials: Material[];   // Material list
  priority: number;        // Render priority
  
  render(renderer: Renderer): void {}  // Render method
}
```

When a component is enabled, it is automatically added to the default render pass of `RenderFrame`.

### 7. Render Frame [RenderFrame](./src/render/render-frame.ts)

The rendering data object for each frame, managing render passes and global uniforms:

```typescript
interface RenderFrameOptions {
  camera: Camera,
  renderer: Renderer,
  globalVolume?: PostProcessVolume,
  postProcessingEnabled?: boolean,
}
```

Main features:
- Manages `RenderPass` list
- Stores camera properties
- Manages global uniform variables (`GlobalUniforms`)
- Supports post-processing (Bloom, ToneMapping)

Main methods:
- `addMeshToDefaultRenderPass(mesh: RendererComponent)`: Add renderer component to default render pass
- `removeMeshFromDefaultRenderPass(mesh: RendererComponent)`: Remove renderer component from default render pass

### 8. Render Pass [RenderPass](./src/render/render-pass.ts)

Manages a group of objects to be rendered:

```typescript
interface RenderPassClearAction {
  clearColor?: vec4,
  colorAction?: TextureLoadAction,
  clearDepth?: number,
  depthAction?: TextureLoadAction,
}
```

Features:
- Manages render object list
- Configures color, depth, stencil attachments
- Sets clear behavior

### 9. Geometry [Geometry](./src/render/geometry.ts)

Abstract class for managing vertex and index data:

```typescript
const geometry = Geometry.create(engine, {
  attributes: {
    aPosition: { size: 3, data: positions },
    aTexCoord: { size: 2, data: texCoords },
  },
  indices: { data: indices },
  mode: WebGLRenderingContext.TRIANGLES,
});

// Update data
geometry.setAttributeData('aPosition', newPositions);
geometry.setAttributeSubData('aPosition', offset, partialData);
geometry.setIndexData(newIndices);
geometry.setDrawCount(count);
```

### 10. Material [Material](./src/material/material.ts)

Abstract class for managing shaders and render states:

```typescript
const material = Material.create(engine, {
  shader: shaderSource,
  uniformValues: {
    uColor: [1, 0, 0, 1],
  },
});

// Set render states
material.blending = true;
material.depthTest = true;
material.depthMask = true;
```

Render state properties:
- `blending`: Color blending switch
- `blendFunction`: Blend function
- `depthTest`: Depth test switch
- `depthMask`: Depth write switch
- `stencilTest`: Stencil test switch
- `culling`: Back-face culling switch

### 11. Texture [Texture](./src/texture/texture.ts)

Abstract class for managing GPU texture resources:

```typescript
// From image
const texture = await Texture.fromImage(url, engine);

// From video
const texture = await Texture.fromVideo(url, engine);

// From data
const texture = Texture.create(engine, {
  sourceType: TextureSourceType.data,
  data: {
    width: 256,
    height: 256,
    data: pixelData,
  },
});
```

## Plugin System

Supports extending functionality through plugins:

```typescript
import { registerPlugin } from '@galacean/effects-core';

registerPlugin('custom', CustomLoader);
```

Built-in plugins:
- `sprite`: Layer rendering
- `particle`: Particle system
- `text`: Text rendering
- `interact`: Interaction handling
- `camera`: Camera control

## Installation

```bash
npm install @galacean/effects-core
```

## Dependencies

- `@galacean/effects-specification`: Data specification definitions
- `@galacean/effects-math`: Math library

## [API Documentation](https://www.galacean.com/effects/api/effects-core)
