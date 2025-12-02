# Galacean Effects Core

Galacean Effects 的核心运行时库，负责动效的资源加载、场景管理和渲染。

## 基本概念

合成（Composition）是 Galacean Effects 中动画播放的基本单位。`Composition` 类管理动画从数据解析（JSON -> VFXItem -> RendererComponent）到渲染帧（`RenderFrame`）和渲染通道（`RenderPass`）的完整生命周期。

### 核心架构

```
Engine
  ├── Composition（合成）
  │     ├── VFXItem（元素）
  │     │     ├── Component（组件）
  │     │     │     └── RendererComponent（渲染组件）
  │     │     └── Transform（变换）
  │     ├── RenderFrame（渲染帧）
  │     │     └── RenderPass（渲染通道）
  │     └── Camera（相机）
  └── 资源管理
        ├── Texture（纹理）
        ├── Material（材质）
        └── Geometry（几何体）
```

每个合成包含不同类型的元素（`VFXItem`）及其组件（`Component`），包括：
- 相机组件
- 图层（Sprite）组件
- 粒子（Particle）系统
- 文本组件
- 交互组件

合成创建时会完成：
1. 数据资产的加载
2. 元素（`VFXItem`）及其组件的创建
3. 纹理（`Texture`）的加载和创建
4. `RenderFrame` 和 `RenderPass` 的初始化

## 核心模块

### 1. 引擎 [Engine](./src/engine.ts)

`Engine` 是核心入口，负责管理所有 GPU 资源和合成的生命周期。

```typescript
import { Engine } from '@galacean/effects-core';

// 创建引擎
const engine = Engine.create(canvas, {
  fps: 60,
  pixelRatio: window.devicePixelRatio,
});
```

主要功能：
- 管理渲染器（`Renderer`）
- 管理 GPU 资源（纹理、材质、几何体）
- 管理合成的创建和销毁
- 提供计时器（`Ticker`）驱动渲染循环
- 处理交互事件

### 2. 资源管理 [AssetManager](./src/asset-manager.ts)

负责加载动效所需的所有资源：

```typescript
import { AssetManager } from '@galacean/effects-core';

const assetManager = new AssetManager(options);
```

支持的功能：
1. JSON 和二进制资源的加载
2. 图像和视频资源的加载
3. 根据渲染等级选择性下载资源
4. 图像/文字模板替换
5. 字体加载（通过 `AssetManager.loadFontFamily`）

### 3. 合成 [Composition](./src/composition.ts)

管理动画播放的数据处理与渲染：

```typescript
const composition = new Composition(props, scene);

// 播放控制
composition.play();
composition.pause();
composition.resume();

// 更新
composition.update(deltaTime);

// 销毁
composition.dispose();
```

主要属性：
- `renderFrame`：当前帧的渲染数据对象
- `rootItem`：合成根元素
- `camera`：合成相机
- `speed`：播放速度

### 4. VFX 元素 [VFXItem](./src/vfx-item.ts)

所有动效元素的基类，支持组件化架构：

```typescript
// 获取组件
const component = item.getComponent(SpriteComponent);

// 遍历子元素
item.children.forEach(child => {
  // ...
});

// 变换操作
item.transform.setPosition(x, y, z);
```

主要属性：
- `transform`：位置、旋转、缩放变换
- `components`：组件列表
- `children`：子元素列表

### 5. 组件系统 [Component](./src/components/component.ts)

组件是附加到 VFXItem 上的功能单元：

```typescript
abstract class Component extends EffectsObject {
  item: VFXItem;           // 所属元素
  enabled: boolean;        // 是否启用
  
  onAwake() {}             // 初始化
  onEnable() {}            // 启用时
  onDisable() {}           // 禁用时
  onStart() {}             // 首次更新前
  onUpdate(dt: number) {}  // 每帧更新
  onLateUpdate(dt: number) {} // 延迟更新
  onDestroy() {}           // 销毁时
}
```

### 6. 渲染组件 [RendererComponent](./src/components/renderer-component.ts)

所有渲染组件的基类，负责将可渲染对象添加到渲染通道：

```typescript
class RendererComponent extends Component {
  material: Material;      // 材质
  materials: Material[];   // 材质列表
  priority: number;        // 渲染优先级
  
  render(renderer: Renderer): void {}  // 渲染方法
}
```

当组件启用时，会自动添加到 `RenderFrame` 的默认渲染通道中。

### 7. 渲染帧 [RenderFrame](./src/render/render-frame.ts)

每帧对应的渲染数据对象，管理渲染通道和全局 uniform：

```typescript
interface RenderFrameOptions {
  camera: Camera,
  renderer: Renderer,
  globalVolume?: PostProcessVolume,
  postProcessingEnabled?: boolean,
}
```

主要功能：
- 管理 `RenderPass` 列表
- 存储相机属性
- 管理全局 uniform 变量（`GlobalUniforms`）
- 支持后处理（Bloom、ToneMapping）

主要方法：
- `addMeshToDefaultRenderPass(mesh: RendererComponent)`：添加渲染组件到默认渲染通道
- `removeMeshFromDefaultRenderPass(mesh: RendererComponent)`：从默认渲染通道移除渲染组件

### 8. 渲染通道 [RenderPass](./src/render/render-pass.ts)

管理一组需要渲染的对象：

```typescript
interface RenderPassClearAction {
  clearColor?: vec4,
  colorAction?: TextureLoadAction,
  clearDepth?: number,
  depthAction?: TextureLoadAction,
}
```

功能：
- 管理渲染对象列表
- 配置颜色、深度、模板附件
- 设置清除行为

### 9. 几何体 [Geometry](./src/render/geometry.ts)

管理顶点和索引数据的抽象类：

```typescript
const geometry = Geometry.create(engine, {
  attributes: {
    aPosition: { size: 3, data: positions },
    aTexCoord: { size: 2, data: texCoords },
  },
  indices: { data: indices },
  mode: WebGLRenderingContext.TRIANGLES,
});

// 更新数据
geometry.setAttributeData('aPosition', newPositions);
geometry.setAttributeSubData('aPosition', offset, partialData);
geometry.setIndexData(newIndices);
geometry.setDrawCount(count);
```

### 10. 材质 [Material](./src/material/material.ts)

管理着色器和渲染状态的抽象类：

```typescript
const material = Material.create(engine, {
  shader: shaderSource,
  uniformValues: {
    uColor: [1, 0, 0, 1],
  },
});

// 设置渲染状态
material.blending = true;
material.depthTest = true;
material.depthMask = true;
```

渲染状态属性：
- `blending`：颜色混合开关
- `blendFunction`：混合函数
- `depthTest`：深度测试开关
- `depthMask`：深度写入开关
- `stencilTest`：模板测试开关
- `culling`：背面剔除开关

### 11. 纹理 [Texture](./src/texture/texture.ts)

管理 GPU 纹理资源的抽象类：

```typescript
// 从图片创建
const texture = await Texture.fromImage(url, engine);

// 从视频创建
const texture = await Texture.fromVideo(url, engine);

// 从数据创建
const texture = Texture.create(engine, {
  sourceType: TextureSourceType.data,
  data: {
    width: 256,
    height: 256,
    data: pixelData,
  },
});
```

## 插件系统

支持通过插件扩展功能：

```typescript
import { registerPlugin } from '@galacean/effects-core';

registerPlugin('custom', CustomLoader);
```

内置插件：
- `sprite`：图层渲染
- `particle`：粒子系统
- `text`：文本渲染
- `interact`：交互处理
- `camera`：相机控制

## 安装

```bash
npm install @galacean/effects-core
```

## 依赖

- `@galacean/effects-specification`：数据规范定义
- `@galacean/effects-math`：数学库

## API 文档

详细 API 文档请访问：[Galacean Effects API 文档](https://galacean.antgroup.com/effects/#/api)
