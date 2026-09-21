import { ResourceData } from './resource-data';
import type { Matrix4, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { RendererComponent } from '../components';
import type { Engine } from '../engine';
import type { Composition } from '../composition';
import { Material } from '../material';
import { addItem, removeItem } from '../utils';
import { FilterMode, RenderTextureFormat } from './framebuffer';
import type { Framebuffer } from './framebuffer';
import { Geometry } from './geometry';
import { VertexBuffer } from './vertex-buffer';
import { RenderingData } from './rendering-data';
import type { RenderOptions } from './rendering-data';
import { DrawObjectPass } from './draw-object-pass';
import { BloomPass, ToneMappingPass } from './post-process-pass';
import type { SceneRendering } from './scene-rendering';
import type { RendererFeature } from './renderer-feature';
import type { RenderPass, RenderPassClearAction } from './render-pass';
import type { ShaderLibrary } from './shader';
import type { Texture } from '../texture';
import { math } from '..';
import { glContext } from '../gl';

// Blit shader 定义
const BLIT_VERTEX_SHADER = `
precision highp float;
attribute vec2 aPos;
varying vec2 vTex;
void main(){
    gl_Position = vec4(aPos, 0.0, 1.0);
    vTex = (aPos + vec2(1.0)) / 2.0;
}`;

const BLIT_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vTex;
uniform sampler2D _MainTex;
void main(){
    gl_FragColor = texture2D(_MainTex, vTex);
}`;

/**
 * Draws screen-space content after all compositions. Ownership remains with the caller.
 * @hide
 */
export interface OverlayRenderer {
  render (): void,
}

export class Renderer {
  static create (engine: Engine): Renderer {
    return new Renderer(engine);
  }

  /** Data for the current render invocation. */
  renderingData = new RenderingData();

  protected currentFramebuffer: Framebuffer | null = null;
  protected disposed = false;
  private readonly drawObjectPass: DrawObjectPass;
  private readonly bloomPass: BloomPass;
  private readonly toneMappingPass: ToneMappingPass;
  private readonly features: RendererFeature[] = [];
  private readonly activeRenderPassQueue: RenderPass[] = [];

  private readonly overlayRenderers: OverlayRenderer[] = [];

  private blitGeometry: Geometry | null = null;
  private blitMaterial: Material | null = null;

  constructor (public engine: Engine) {
    this.drawObjectPass = new DrawObjectPass(this);
    this.bloomPass = new BloomPass(this, 7);
    this.toneMappingPass = new ToneMappingPass(this);
  }

  /**
   * Prepare and draw the current scene state without advancing scene time.
   * @internal
   */
  renderCompositions (compositions: readonly Composition[], clearAction: RenderPassClearAction): void {
    for (const composition of compositions) {
      composition.camera.updateMatrix();
      composition.sceneTicking.preRender.tick(0);
    }

    this.setFramebuffer(null);
    this.clear(clearAction);

    for (const composition of compositions) {
      this.renderComposition(composition);
    }
  }

  /** Submits one scene without advancing its lifecycle or drawing screen-space UI. */
  renderComposition (composition: Composition): void {
    this.renderScene(composition.sceneRendering, {
      camera: composition.camera,
      target: null,
      globalVolume: composition.globalVolume,
      postProcessingEnabled: composition.postProcessingEnabled,
    });
  }

  /**
   * Register in drawing order. Repeated registration of the same object is ignored.
   * @hide
   */
  addOverlayRenderer (renderer: OverlayRenderer): void {
    if (this.disposed) {
      return;
    }
    addItem(this.overlayRenderers, renderer);
  }

  /**
   * Remove a registered overlay without disposing it.
   * @hide
   */
  removeOverlayRenderer (renderer: OverlayRenderer): void {
    removeItem(this.overlayRenderers, renderer);
  }

  /** @internal */
  renderOverlays (): void {
    for (const renderer of this.overlayRenderers) {
      renderer.render();
    }
  }

  setGlobalFloat (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.globalUniforms.floats[name] = value;
  }

  setGlobalVector4 (name: string, value: Vector4) {
    this.checkGlobalUniform(name);
    this.renderingData.globalUniforms.vector4s[name] = value;
  }

  setGlobalInt (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.globalUniforms.ints[name] = value;
  }

  setGlobalMatrix (name: string, value: Matrix4) {
    this.checkGlobalUniform(name);
    this.renderingData.globalUniforms.matrices[name] = value;
  }

  setGlobalVector3 (name: string, value: Vector3) {
    this.checkGlobalUniform(name);
    this.renderingData.globalUniforms.vector3s[name] = value;
  }

  setGlobalTexture (name: string, texture: Texture) {
    const globalUniforms = this.renderingData.globalUniforms;

    if (!globalUniforms.samplers.includes(name)) {
      globalUniforms.samplers.push(name);
    }
    globalUniforms.textures[name] = texture;
  }

  getFramebuffer (): Framebuffer {
    return this.currentFramebuffer as Framebuffer;
  }

  setFramebuffer (framebuffer: Framebuffer | null) {
    if (framebuffer) {
      this.currentFramebuffer = framebuffer;
      this.currentFramebuffer.bind();
      this.setViewport(framebuffer.viewport[0], framebuffer.viewport[1], framebuffer.viewport[2], framebuffer.viewport[3]);
    } else {
      this.currentFramebuffer = null;
      this.engine.displayServer.renderingDevice.bindSystemFramebuffer();
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }
  }

  setViewport (x: number, y: number, width: number, height: number) {
    this.engine.displayServer.renderingDevice.setViewport(x, y, width, height);
  }

  getViewport (): [number, number, number, number] {
    return this.engine.displayServer.renderingDevice.getViewport();
  }

  clear (action: RenderPassClearAction) {
    this.engine.displayServer.renderingDevice.clear(action);
  }

  getWidth (): number {
    return this.engine.displayServer.renderingDevice.getWidth();
  }

  getHeight (): number {
    return this.engine.displayServer.renderingDevice.getHeight();
  }

  /**
   *
   * @override
   * @returns
   */
  getShaderLibrary (): ShaderLibrary | null {
    return this.engine.displayServer.renderingDevice.getShaderLibrary();
  }

  get rendererFeatures (): readonly RendererFeature[] {
    return this.features;
  }

  /** Attach a feature for the lifetime of this renderer. */
  addRendererFeature (feature: RendererFeature): void {
    if (this.disposed) {
      throw new Error('Renderer is disposed.');
    }
    if (!this.features.includes(feature)) {
      feature.create(this);
      this.features.push(feature);
    }
  }

  /** Add a pass to the current render queue. */
  enqueuePass (pass: RenderPass): void {
    this.activeRenderPassQueue.push(pass);
  }

  renderScene (scene: SceneRendering, options: RenderOptions): void {
    if (this.disposed) {
      return;
    }
    if (options.postProcessingEnabled) {
      const { halfFloatTexture, halfFloatColorAttachment, halfFloatLinear } = this.engine.displayServer.renderingDevice.gpuCapability.detail;

      if (!halfFloatTexture || !halfFloatColorAttachment || !halfFloatLinear) {
        throw new Error('Post processing requires half float textures with color attachment and linear filtering support.');
      }
    }

    const previousTarget = this.getFramebuffer();
    const previousViewport = this.getViewport();

    const previousData = this.renderingData;
    const data = new RenderingData(options);
    const resourceData = data.frameData.get(ResourceData);

    this.activeRenderPassQueue.length = 0;
    this.renderingData = data;
    this.prepareRenderingData(scene, data);
    this.enqueuePass(this.drawObjectPass);

    if (options.postProcessingEnabled) {
      this.enqueuePass(this.bloomPass);
      this.enqueuePass(this.toneMappingPass);
    }
    for (const feature of this.features) {
      if (feature.active) {
        feature.addRenderPasses(this, data);
      }
    }
    this.activeRenderPassQueue.sort((a, b) => a.renderPassEvent - b.renderPassEvent);
    this.getShaderLibrary()?.compileAllShaders();
    let sceneTarget: Framebuffer | undefined;

    if (options.postProcessingEnabled) {
      const width = options.target?.viewport[2] ?? this.getWidth();
      const height = options.target?.viewport[3] ?? this.getHeight();

      sceneTarget = this.getTemporaryRT('DrawObjectPass', width, height, 16, FilterMode.Linear, RenderTextureFormat.RGBAHalf);
      resourceData.cameraColor = sceneTarget.getColorTextures()[0];
    }
    this.setFramebuffer(sceneTarget ?? options.target ?? null);

    for (const pass of this.activeRenderPassQueue) {
      this.renderRenderPass(pass);
    }
    for (const pass of this.activeRenderPassQueue) {
      pass.onCameraCleanup(this, data);
    }
    this.activeRenderPassQueue.length = 0;
    if (sceneTarget) {
      this.releaseTemporaryRT(sceneTarget);
    }
    data.frameData.dispose();
    this.renderingData = previousData;
    this.setFramebuffer(previousTarget);
    this.setViewport(...previousViewport);
  }

  /** Collects scene inputs and initializes uniforms for the current render. */
  prepareRenderingData (scene: SceneRendering, data: RenderingData): void {
    scene.collect(data);
    const camera = data.options!.camera;

    this.setGlobalMatrix('effects_MatrixInvV', camera.getInverseViewMatrix());
    this.setGlobalMatrix('effects_MatrixV', camera.getViewMatrix());
    this.setGlobalMatrix('effects_MatrixVP', camera.getViewProjectionMatrix());
    this.setGlobalMatrix('_MatrixP', camera.getProjectionMatrix());
    this.setGlobalVector3('effects_WorldSpaceCameraPos', camera.position);
  }

  renderRenderPass (pass: RenderPass): void {
    pass.execute(this, this.renderingData);
  }

  renderMeshes (meshes: RendererComponent[]) {
    for (const mesh of meshes) {
      mesh.render(this);
    }
  }

  drawGeometry (geometry: Geometry, matrix: Matrix4, material: Material, subMeshIndex = 0) {
    if (!geometry || !material) {
      return;
    }

    material.initialize();
    geometry.initialize();
    geometry.flush();
    material.setMatrix('effects_ObjectToWorld', matrix);

    try {
      material.use(this, this.renderingData.globalUniforms);
    } catch (e) {
      console.error(e);
      this.engine.renderErrors.add(e as Error);

      return;
    }

    const indexBuffer = geometry.getIndexBuffer();
    let offset = geometry.getDrawStart();
    let count = geometry.getDrawCount();
    const subMeshes = geometry.subMeshes;

    if (subMeshes.length > 0) {
      const subMesh = subMeshes[subMeshIndex];

      offset = subMesh.offset;
      count = indexBuffer ? subMesh.indexCount ?? 0 : subMesh.vertexCount;
    }
    if (count <= 0) {
      return;
    }

    geometry.bind(material.shaderVariant);
    const instanceCount = geometry.instanceCount || undefined;

    if (indexBuffer) {
      this.engine.displayServer.renderingDevice.drawElementsType(geometry.mode, offset, count, instanceCount);
    } else {
      this.engine.displayServer.renderingDevice.drawArraysType(geometry.mode, offset, count, instanceCount);
    }
  }

  getTemporaryRT (
    name: string,
    width: number,
    height: number,
    depthBuffer: number,
    filter: FilterMode,
    format: RenderTextureFormat,
  ): Framebuffer {
    return this.engine.renderingServer.renderTargetPool.get(name, width, height, depthBuffer, filter, format);
  }

  releaseTemporaryRT (rt: Framebuffer): void {
    this.engine.renderingServer.renderTargetPool.release(rt);
  }

  /**
   * 将源纹理复制到目标 Framebuffer，可使用自定义材质进行处理
   * @param source - 源纹理
   * @param destination - 目标 Framebuffer，如果为 null 则渲染到屏幕
   * @param material - 可选的自定义材质，不传则使用默认复制材质
   */
  blit (source: Texture, destination: Framebuffer | null, material?: Material): void {
    // 懒加载创建 blit geometry
    if (!this.blitGeometry) {
      this.blitGeometry = Geometry.create(this.engine, {
        mode: glContext.TRIANGLE_STRIP,
        attributes: {
          [VertexBuffer.PositionKind]: {
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]),
          },
        },
        drawCount: 4,
      });
    }

    // 懒加载创建默认 blit material
    if (!this.blitMaterial) {
      this.blitMaterial = Material.create(this.engine, {
        shader: {
          vertex: BLIT_VERTEX_SHADER,
          fragment: BLIT_FRAGMENT_SHADER,
        },
      });
      this.blitMaterial.blending = false;
      this.blitMaterial.depthTest = false;
      this.blitMaterial.culling = false;
    }

    const blitMat = material || this.blitMaterial;

    // 设置源纹理
    blitMat.setTexture('_MainTex', source);

    // 保存当前 framebuffer
    const prevFramebuffer = this.currentFramebuffer;

    // 设置目标
    if (destination) {
      const [x, y, width, height] = destination.viewport;

      this.setFramebuffer(destination);
      this.setViewport(x, y, width, height);
    } else {
      // 渲染到屏幕
      this.setFramebuffer(null);
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }

    this.drawGeometry(this.blitGeometry, math.Matrix4.IDENTITY, blitMat);

    // 恢复之前的 framebuffer
    this.setFramebuffer(prevFramebuffer);
  }

  dispose (): void {
    if (this.disposed) {
      return;
    }

    this.drawObjectPass.dispose();
    this.bloomPass.dispose();
    this.toneMappingPass.dispose();
    for (const feature of this.features) {
      feature.dispose();
    }
    this.features.length = 0;
    this.activeRenderPassQueue.length = 0;
    this.overlayRenderers.length = 0;
    this.blitGeometry?.dispose();
    this.blitGeometry = null;
    this.blitMaterial?.dispose();
    this.blitMaterial = null;

    this.disposed = true;
  }

  private checkGlobalUniform (name: string) {
    const globalUniforms = this.renderingData.globalUniforms;

    if (!globalUniforms.uniforms.includes(name)) {
      globalUniforms.uniforms.push(name);
    }
  }
}
