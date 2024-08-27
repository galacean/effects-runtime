# Galacean Effects Core

## Basic Concepts
The **Composition** in Galacean Effects is the unit of animation playback. The abstract class `Composition` manages the process from data parsing (JSON -> VFXItem -> mesh) to the creation, updating, and destruction of rendered frames (`renderFrame`) and render passes (`renderPass`).

Each composition utilizes animation data from various types of elements (`VFXItem`) and their corresponding components (`Component`), including camera properties, multiple layers, particles, and interactive elements.

When a composition is created, it loads various data assets, creates elements (`VFXItem`) along with their corresponding components (`Component`), and initializes animation texture maps (`Texture`), `renderFrame`, and `renderPass`.

At the beginning of the lifecycle, the corresponding mesh will be added to the default `renderPass` by the composition. During the course of the lifecycle, the data within the mesh, such as `Geometry` and `Material`, will be updated.

When post-processing is needed, the mesh will be broken down into the appropriate `renderPass`. After the lifecycle ends, the corresponding mesh will be removed from the `renderFrame`.

To play the animation, the engine retrieves the mesh from the `renderFrame` and adds it to the scene, continuously calls the update function of the `Composition` during the rendering loop to `update` the data.

## Process
### 1. Resource Loading and Creation
- Asset Download [AssetManager](./src/asset-manager.ts): Before playing the animation, JSON data along with binary resources (`processBins`) and image resources (`processImages`) are downloaded. Upon completion of image downloads, parameters for creating textures (`Texture`) are returned. In addition to basic resource downloading functionality, the following features are supported:
  1. Selective downloading of resources based on rendering levels.
  2. After loading the image, image/text replacement is performed according to the configuration, and the modified image is saved as an `imageData` object by drawing on a Canvas.
  3. Enable the gl extension `KHR_parallel_shader_compile` to compile shaders after resource loading is completed.
- Asset Creation [engine](./src/engine.ts)
The scene data loaded from the network needs to be mounted onto the `engine` object (`addPackageDatas`) to create instances through the `engine` object.
  1. Texture Creation [Texture](./src/texture/texture.ts): The static methods `create` and `createWithData` in the `Texture` abstract class are used to create real texture objects based on the parameters returned above. The current texture objects may be based on the creation types enumerated in `TextureSourceType`.
  2. Element Creation [VFXItem](./src/vfx-item.ts): Call `engine.createVFXItems()` to create VFXItem instances.

### 2. Animation Playback
- [Composition](./src/composition.ts): The Composition manages the data processing and rendering settings for animation playback. The engine needs to obtain the mesh through `composition.renderFrame` and add the retrieved meshes to the scene.
  1. The constructor will invoke the following functions, which do not need to be called manually when integrating:
     - Plugin system `pluginSystem.initializeComposition()`
     - `composition.createRenderFrame()`: Creation and initialization of `renderFrame`
     - `composition.reset()`: Animation data parsing and initialization of the rendering instance state such as Mesh
     - `composition.play()`: Start playback of the composition
  2. `update` method: This method is used to call `renderFrame` to add/modify/delete meshes, driving the update of `VFXItem` and refreshing vertex data, uniform variable values, etc. The following functions will be called and need to be implemented:
     - `updateVideo`: Update video frames for video playback
     - `getRendererOptions`: Return an empty `Texture` created with the data
     - `reloadTexture/offloadTexture`: Handle the `reload` and `offload` of textures
  3. The meshes or rendering objects added to the scene are obtained through `renderFrame`. The interface can be freely designed in `Composition` according to the needs of the engine.
  4. `dispose` method: At the end of the composition lifecycle, this method will be called based on the termination behavior, executing the composition destruction callback of `VFXItem`, and will also destroy objects such as meshes and textures.

- [RenderFrame](./src/render/render-frame.ts): The `RenderFrame` can be understood as the rendering data object corresponding to each frame of the composition. In addition to managing the `renderPass`, it also stores the camera properties and common uniform variable table (semantics) associated with the composition. The meshes corresponding to different types of elements are added and removed using `addMeshToDefaultRenderPass` and `removeMeshFromDefaultRenderPass` methods of `renderFrame`. The mesh is added to the appropriate position in the `renderPass` based on its `priority` property.
  1. `addMeshToDefaultRenderPass/removeMeshFromDefaultRenderPass`:
     - For compositions without filter elements, the engine can manage all meshes through the `defRenderPass`, or it can directly place the passed-in mesh into its own scene. The engine can also organize and manage the meshes as required.
     - For compositions with filter elements involving post-processing, the effects-core will call the `splitDefaultRenderPassByMesh` function to split the `renderPass` using the splitting parameters. In this case, the engine needs to iterate over `renderFrame._renderPasses` to retrieve meshes and add them to the scene.
     - When adding a mesh, the common uniforms used by the material can be obtained through `mesh.material.uniformSemantics`, including matrices related to MVP transformations and the attachments used.
  2. `setEditorTransformUniform`: This method is used to set the translation/scaling transformation of an element after model transformation. The engine may not necessarily understand this concept but can set the value to `semantics[EDITOR_TRANSFORM]`.
- [RenderPass](./src/render/render-pass.ts): The meshes added to the scene can be obtained through `renderPass.meshes`. The render pass `renderPass` contains the meshes for the current pass, the operations for clearing the buffer before and after rendering, and attachments related to color, depth, and stencil. The `delegate` property is used to specify the callbacks before and after rendering for the `renderPass`, as defined in [filters](./src/filters). The engine needs to execute these callbacks before actually rendering the meshes to ensure the correct operation of the filters.
- [Mesh](./src/render/mesh.ts): Each `VFXItem` calls the `Mesh.create()` function during initialization, passing in parameters such as geometry and material, and sets/retrieves the rendering order for the current mesh using `priority`.
  1. The static `create` method is used to create a new `Mesh` object that the engine can render. The engine needs to add geometry, material, and other objects to the mesh here.
     - The primitive type to be rendered can be obtained from `geometry.mode`.
  2. The `setter` and `getter` functions for `priority` are used to set the rendering order of the current mesh. Meshes with lower `priority` values should be drawn before those with higher values.
  3. `setVisible/getVisible` sets the visibility of the mesh.

> Tips
>
> - To access methods on the element component, you can use `VFXItem.getComponent(XXXComponent)`.
> - To obtain the mesh corresponding to the current `VFXItem`, you can use `VFXItem.content.mesh` to retrieve it.

### 3. [Geometry](./src/render/geometry.ts)
Each `VFXItem` calls the `Geometry.create()` function during initialization, passing in the drawing type, vertex data, and index data of the element. During each frame update, new vertex data is passed to the attribute data.
1. The static create method: It processes the passed attribute data. If the data contains the dataSource property, it indicates that the attribute shares a buffer with the data source.
    - `size`, `offset`, and `stride` are also passed in. If the data length is 0 and the engine does not allow dynamic modification of the GPU cache length, an initialization array should be created using the `maxVertex` parameter.
2. `setAttributeData/getAttributeData`: Sets/retrieves attribute data for the specified attribute name.
3. `setAttributeSubData`: Sets partial attribute updates.
4. `getIndexData/setIndexData`: Sets/retrieves index data.
5. `setDrawCount/getDrawCount`: Sets/retrieves the draw count.

Attributes involved:
#### Sprite
```
1. aPoint: Float32Array - Vertex data
2. aIndex: Float32Array - Shared buffer with aPoint
3. Index data: Uint16Array
```

#### Particle
```
1. aPos: Float32Array
2. aVel: Float32Array - Shared buffer with aPos
3. aDirX: Float32Array - Shared buffer with aPos
4. aDirY: Float32Array - Shared buffer with aPos
5. aRot: Float32Array - Shared buffer with aPos
6. aSeed: Float32Array - Shared buffer with aRot
7. aColor: Float32Array - Shared buffer with aRot
8. aOffset: Float32Array
9. aSprite: Float32Array
10. Index data: Uint16Array
```

#### Particle-trail
```
1. aColor: Float32Array
2. aSeed: Float32Array - Shared buffer with aColor
3. aInfo: Float32Array - Shared buffer with aColor
4. aPos: Float32Array - Shared buffer with aColor
5. aTime: Float32Array
6. aDir: Float32Array
7. aTrailStart: Float32Array
8. aTrailStartIndex: Float32Array
```

### 4. [Material](./src/material/material.ts)
Each `VFXItem` calls the `Material.create()` function during initialization, passing the shader and uniform semantics. The states and uniform data of the material are not passed in the constructor parameters but are set through functions after material creation.
1. Static `create` method: It needs to handle the provided shader text and set the `uniformSemantics`.
2. Implementation of `setter/getter` methods for states: The constant type passed is `glContext`, which may need to be converted to constants defined by the engine.
3. `set[dataType]/get[dataType]` methods for uniforms: effects-core will invoke the corresponding methods based on the type of the uniform to set data.

> ⚠️ Note:
> **The related UBO calls are deprecated, and `material-data-block` does not need to be implemented.**

Uniforms involved and their types:
#### Sprite
```
1. uMainData: mat4
2. uTexParams: vec4
3. uTexOffset: vec4
4. uSampler\[i]: sampler2D
5. uSamplerPre: sampler2D
6. uFeatherSampler: sampler2D
```

#### Particle
```
1. uSprite: vec4
2. uParams: vec4
3. uAcceleration: vec4
4. uGravityModifierValue: vec4
5. uOpacityOverLifetimeValue: vec4
6. uRXByLifeTimeValue: vec4
7. uRYByLifeTimeValue: vec4
8. uRZByLifeTimeValue: vec4
9. uLinearXByLifetimeValue: vec4
10. uLinearYByLifetimeValue: vec4
11. uLinearZByLifetimeValue: vec4
12. uSpeedLifetimeValue: vec4
13. uOrbXByLifetimeValue: vec4
14. uOrbYByLifetimeValue: vec4
15. uOrbZByLifetimeValue: vec4
16. uSizeByLifetimeValue: vec4
17. uSizeYByLifetimeValue:vec4
18. uColorParams: vec4
19. uFSprite: vec4
20. uPreviewColor: vec4
21. uVCurveValues: vec4Array
22. uFCurveValues: vec4
23. uFinalTarget: vec3
24. uForceCurve: vec4
25. uOrbCenter: vec3
26. uTexOffset: vec2
27. uPeriodValue: vec4
28. uMovementValue: vec4
29. uStrengthValue: vec4
30. uWaveParams: vec4
```

## [API Documentation](https://galacean.antgroup.com/effects/api/effects-core)
