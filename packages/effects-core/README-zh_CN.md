# Galacean Effects Core

## 基本概念
合成（composition）是 Galacean Effects 中动画播放的单位，抽象类 `Composition` 管理着一段动画从数据解析（JSON -> VFXItem
/ Texture -> mesh）到渲染帧（`renderFrame`）和渲染通道 (renderPass) 的创建、更新与销毁。

每个合成用到的动画数据来自不同类型的元素（`VFXItem`），包括相机属性、若干图层、粒子和交互元素；
合成创建时，会完成元素 `VFXItem` 的创建、动画纹理贴图（`Texture`）的加载和创建, `renderFrame` 和 `renderPass` 的初始化；
元素在生命周期开始时，对应的 mesh 会被合成添加到默认的 `renderPass` 中；
生命周期进行时，mesh 中包含的
`Geometry` 和 `Material` 等数据会被更新；
当需要进行后处理时，mesh 会被拆解到合适的 `renderPass` 中；
生命周期结束后，对应的
mesh 会从 `renderFrame` 中移除。

要完成动画的播放，引擎需要通过 `renderFrame` 获取 mesh 并添加到场景上，在渲染循环中不断调用 `Composition` 的 `update` 函数完成数据的刷新。

## 流程
### 1、资源加载和创建
- 资源下载 [AssetManager](./src/asset-manager.ts)：
动画播放前需要对 JSON 和其中的二进制（`processBins`）、图像（`processImages`）等资源进行下载，图像下载后会返回用于创建 texture 的参数。除了基本的资源下载外，还支持以下功能：
  1. 根据渲染分级选择性下载资源；
  2. 加载图像后根据配置进行图像/文字的替换，在 Canvas 上绘制后保存成 `imageData` 对象；
  3. 启用 gl 扩展 `KHR_parallel_shader_compile`，在资源加载完成后对 shader 进行编译；
- 纹理创建 [Texture](./src/texture/texture.ts)：`Texture` 抽象类中的 `create` 和 `createWithData` 静态方法用于根据上面返回的参数创建真正的 texture 纹理对象，目前的纹理对象可能基于的创建类型在 `TextureSourceType` 中枚举。

### 2、动画播放
- [Composition](./src/composition.ts)：合成管理着动画播放的数据处理与渲染设置。首先需要执行 `initialize` 函数，通过 `VFXItemManager` 完成 JSON -> VFXItem 的处理。此外，引擎需要在合适通过 `composition.renderFrame` 获取 mesh ，并把获取到的 mesh 添加场景中。
  1. 静态 `initialize` 方法：
     - 引擎需要实现 `VFXItemManager` 的创建、`Composition` 实例的创建、纹理参数转化成引擎可用的 `Texture`
  2. 构造函数中需要调用以下函数：
      - 插件系统 `pluginSystem.initializeComposition()`
      - `composition.resetRenderFrame()`：`renderFrame` 的创建和初始化
      - `composition.reset()`：动画数据解析、Mesh 等渲染实例的状态初始化
      - `composition.play()`：合成播放
  3. `update` 方法：用于调用 `renderFrame` 的方法增加/修改/删除 mesh，驱动 `VFXItem` 更新并刷新顶点数据、uniform 变量值等，以下函数会被调用，需要实现：
     - `updateVideo`：更新视频帧，用于视频播放使用
     - `getRendererOptions`：返回使用数据创建的空白 `Texture`
     - `reloadTexture/offloadTexture`：纹理的 `reload` 和 `offload`
  4. 添加到场景中的 mesh 或渲染对象通过 `renderFrame` 获取，在 `Composition` 根据引擎需要自由设计接口即可。
  5. `dispose` 方法：在合成生命周期结束时，会根据结束行为调用该函数，执行 `VFXItem` 的合成销毁回调，同时会把 mesh、texture 等对象一并销毁。
- [RenderFrame](./src/render/render-frame.ts)：`RenderFrame` 可以理解为合成每帧对应的渲染数据对象，除了管理 `renderPass`，也保存了合成对应的相机属性、公共 uniform 变量表
（semantics）等数据；各类型元素对应的 mesh 会通过 `renderFrame` 的 `addMeshToDefaultRenderPass` 和 `removeMeshFromDefaultRenderPass` 来添加和移除。
mesh 会根据 `priority` 属性被添加到 `renderPass` 合适位置上。
  1. `addMeshToDefaultRenderPass/removeMeshFromDefaultRenderPass`：
     - 对于不含滤镜元素的合成，引擎可以通过 `defRenderPass` 管理全部 mesh，也可以直接把传递进来的 mesh 放置到引擎自己的场景，也可以在此完成引擎需要的 mesh 组织管理；
     - 对于包含滤镜元素的合成，涉及到后处理，effects-core 会调用 `splitDefaultRenderPassByMesh` 函数利用切分参数把对 `renderPass` 进行切分。此时引擎就需要遍历 `renderFrame._renderPasses` 来获取 mesh 并添加到场景；
     - 添加 mesh 时 material 用到的公共 uniform 需要通过 `mesh.material.uniformSemantics` 获取，包括 MVP 变换涉及的矩阵、使用的 attachment 等；
  2. `setEditorTransformUniform`：用于设置元素在模型变换后的位移/缩放变换，引擎可以不理解这个概念，把值设置到 `semantics[EDITOR_TRANSFORM]` 上即可。
- [RenderPass](./src/render/render-pass.ts)：添加到场景中的 mesh 可以通过 `renderPass.meshes` 获取，渲染通道 `renderPass` 包含当前通道的 mesh、渲染前后清除缓冲区的操作类型和附件，用到颜色、深度和模板附件。`delegate` 属性用于指定 `renderPass` 在渲染前后的回调，在 [filters](./src/filters) 中定义，引擎需要在真正渲染 mesh 前执行这些回调确保滤镜的正确运行。
- [Mesh](./src/render/mesh.ts)：
每个 `VFXItem` 在初始化时会调用 `Mesh.create()` 函数, 传入 geometry、material 等参数，并通过 `priority` 设置/获取当前 mesh 对应的渲染顺序。
  1. 静态 `create` 方法 用于创建一个新的引擎能够渲染的 `Mesh` 对象。引擎需要在这里把 geometry、material 等对象添加到 mesh 上。
     - 要渲染的图元类型可以通过传入的 `geometry.mode` 获取
  2. `priority` 的 `setter` 和 `getter` 函数用于设置当前 mesh 的渲染顺序，`priority` 值小的 mesh 应该比值大的先绘制。
  3. `setVisible/getVisible` 设置 mesh 的可见性

> Tips
>
> - 图层元素并非一个 `spriteVFXItem` 对应一个 mesh, 图层元素在每帧更新时会通过 diff 算法比较相邻 mesh 是否具有相同的材质属性从而对 mesh 进行拆解或者合并。
> - 若要获取当前 `VFXItem` 对应的 mesh，可以调用 `VFXItem.content.mesh` 进行获取。

### 3、[Geometry](./src/render/geometry.ts)
每个 `VFXItem` 在初始化时会调用 `Geometry.create()` 函数, 传入绘制类型、元素的顶点和索引数据，并在每帧更新时传入新的顶点数据传入的 attribute 数据中。
1. 静态 `create` 方法：处理传入的 attribute 数据，若包含 dataSource 属性，则表示该 attribute 与 dataSource 共用buffer
   - `size`、`offset`、`stride` 会一并传入，data 的长度为0，引擎如不允许动态修改长 GPU 缓存长度，需要使用 `maxVertex` 参数创建初始化数组。
2. `setAttributeData/getAttributeData`：设置/获取指定名字的 attribute 数据
3. `setAttributeSubData`：设置 attribute 部分更新
4. `getIndexData/setIndexData`：设置/获取索引数据
5. `setDrawCount/getDrawCount`：设置/获取 drawCount

涉及的 attribute：
#### 图层 sprite
```
1. aPoint 顶点数据，Float32Array
2. aIndex Float32Array, 与aPoint共用buffer
3. 索引数据： Uint16Array
```

#### 粒子 particle
```
1. aPos Float32Array
2. aVel Float32Array 与aPos共用buffer
3. aDirX Float32Array 与aPos共用buffer
4. aDirY Float32Array 与aPos共用buffer
5. aRot Float32Array 与aPos共用buffer
6. aSeed Float32Array 与aRot共用buffer
7. aColor Float32Array 与aRot共用buffer
8. aOffset Float32Array
9. aSprite Float32Array
10. 索引数据：Uint16Array
```

#### 拖尾 particle-trail
```
1. aColor Float32Array
2. aSeed  Float32Array  与aColor共用buffer
3. aInfo  Float32Array  与aColor共用buffer
4. aPos   Float32Array  与aColor共用buffer
5. aTime  Float32Array
6. aDir   Float32Array
7. aTrailStart Float32Array
8. aTrailStartIndex Float32Array
```

### 4、[Material](./src/material/material.ts)
每个 `VFXItem` 在初始化时会调用 `Material.create()` 函数, 传入 shader、uniformSemantics，material 的 states 和uniform 数据不会在构造参数中传入，会在 material 创建后通过函数设置。
1. 静态 `create` 方法：需要处理传入的 shader 文本和设置 `uniformSemantics`
2. states 的 `setter/getter` 方法实现：传入的常量类型为 `glContext`, 引擎可能需要转换成引擎自己定义的常量；
3. uniform 的 `set[dataType]/get[dataType]` 方法，effects-core 会根据 uniform 的类型调用对应的方法设置数据

> ⚠️注意:
> **目前 ubo 的相关调用已废弃，`material-data-block` 不需要实现**

涉及的 uniform 及其类型：
#### 图层 sprite
```
1. uMainData mat4
2. uTexParams vec4
3. uTexOffset vec4
4. uSampler\[i] sampler2D
5. uSamplerPre sampler2D
6. uFeatherSampler sampler2D
```

#### 粒子 particle
```
1. uSprite vec4
2. uParams vec4
3. uAcceleration vec4
4. uGravityModifierValue vec4
5. uOpacityOverLifetimeValue vec4
6. uRXByLifeTimeValue vec4
7. uRYByLifeTimeValue vec4
8. uRZByLifeTimeValue vec4
9. uLinearXByLifetimeValue vec4
10. uLinearYByLifetimeValue vec4
11. uLinearZByLifetimeValue vec4
12. uSpeedLifetimeValue vec4
13. uOrbXByLifetimeValue vec4
14. uOrbYByLifetimeValue vec4
15. uOrbZByLifetimeValue vec4
16. uSizeByLifetimeValue vec4
17. uSizeYByLifetimeValue vec4
18. uColorParams vec4
19. uFSprite vec4
20. uPreviewColor vec4
21. uVCurveValues vec4Array
22. uFCurveValues vec4
23. uFinalTarget vec3
24. uForceCurve vec4
25. uOrbCenter vec3
26. uTexOffset vec2
27. uPeriodValue vec4
28. uMovementValue vec4
29. uStrengthValue vec4
30. uWaveParams vec4
```

## API 文档

[Galacean Effects Core API 文档](https://galacean.antgroup.com/effects/#/api/modules_galacean_effects_core)
