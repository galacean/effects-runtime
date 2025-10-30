import type {
  Disposable, Framebuffer, GLType, Geometry, LostHandler, Material, RenderFrame, RenderPass,
  RenderPassClearAction, RenderPassStoreAction, RendererComponent, RestoreHandler,
  ShaderLibrary, math,
} from '@galacean/effects-core';
import {
  FilterMode, GPUCapability, RenderPassAttachmentStorageType, RenderTextureFormat,
  Renderer, TextureLoadAction, TextureSourceType, assertExist, glContext, sortByOrder,
} from '@galacean/effects-core';
import { ExtWrap } from './ext-wrap';
import { GLContextManager } from './gl-context-manager';
import { GLEngine } from './gl-engine';
import { GLFramebuffer } from './gl-framebuffer';
import { GLRendererInternal } from './gl-renderer-internal';
import { GLTexture } from './gl-texture';
import { GLShaderLibrary } from './gl-shader-library';

type Matrix4 = math.Matrix4;
type Vector4 = math.Vector4;
type Vector3 = math.Vector3;

export class GLRenderer extends Renderer implements Disposable {
  glRenderer: GLRendererInternal;
  extension: ExtWrap;
  framebuffer: Framebuffer;
  temporaryRTs: Record<string, Framebuffer> = {};

  readonly context: GLContextManager;

  constructor (
    public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    framework: GLType,
    renderOptions?: WebGLContextAttributes,
  ) {
    super();
    const options = {
      preserveDrawingBuffer: undefined,
      alpha: true,
      stencil: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: true,
      ...renderOptions,
    };

    this.context = new GLContextManager(canvas, framework, options);
    const { gl } = this.context;

    assertExist(gl);
    // engine 先创建
    this.engine = new GLEngine(gl);
    this.engine.renderer = this;
    this.glRenderer = new GLRendererInternal(this.engine as GLEngine);
    this.extension = new ExtWrap(this);
    this.renderingData = {
      // @ts-expect-error
      currentFrame: {},
    };

    // this.framebuffer = new GLFramebuffer({
    //   storeAction: {},
    //   viewport: [0, 0, this.width, this.height],
    //   attachments: [new GLTexture(this.engine, {
    //     sourceType: TextureSourceType.framebuffer,
    //     data: { width: this.width, height: this.height },
    //   })],
    //   depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.none },
    // }, this);
  }

  get isDestroyed () {
    const internal = this.glRenderer;

    return internal ? internal.isDestroyed : true;
  }

  get height () {
    return this.glRenderer?.height ?? 0;
  }

  get width () {
    return this.glRenderer?.width ?? 0;
  }

  override renderRenderFrame (renderFrame: RenderFrame) {
    const frame = renderFrame;

    if (frame.resource) {
      frame.resource.color_b.initialize();
    }

    const passes = frame._renderPasses;

    if (this.isDestroyed) {
      console.error('Renderer is destroyed, target: GLRenderer.');

      return;
    }
    frame.renderer.getShaderLibrary()?.compileAllShaders();
    this.setFramebuffer(null);
    this.clear(frame.clearAction);

    const currentCamera = frame.camera;

    this.renderingData.currentFrame = frame;
    this.renderingData.currentCamera = currentCamera;

    this.setGlobalMatrix('effects_MatrixInvV', currentCamera.getInverseViewMatrix());
    this.setGlobalMatrix('effects_MatrixV', currentCamera.getViewMatrix());
    this.setGlobalMatrix('effects_MatrixVP', currentCamera.getViewProjectionMatrix());
    this.setGlobalMatrix('_MatrixP', currentCamera.getProjectionMatrix());
    this.setGlobalVector3('effects_WorldSpaceCameraPos', currentCamera.position);

    // 根据 priority 排序 pass
    sortByOrder(passes);
    for (const pass of passes) {
      const delegate = pass.delegate;

      delegate.willBeginRenderPass?.(pass, this.renderingData);
      this.renderRenderPass(pass);
      delegate.didEndRenderPass?.(pass, this.renderingData);
    }

    for (const pass of passes) {
      pass.frameCleanup(this);
    }
  }

  renderRenderPass (pass: RenderPass): void {
    this.renderingData.currentPass = pass;
    // 初始化 pass attachment GPU资源
    pass.initialize(this);
    // 配置当前 renderer 的 RT
    pass.configure(this);
    // 执行当前 pass
    pass.execute(this);
  }

  override renderMeshes (meshes: RendererComponent[]) {
    const delegate = this.renderingData.currentPass.delegate;

    for (const mesh of meshes) {
      delegate.willRenderMesh?.(mesh, this.renderingData);
      mesh.render(this);
      delegate.didRenderMesh?.(mesh, this.renderingData);
    }
  }

  override setGlobalFloat (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.floats[name] = value;
  }

  override setGlobalVector4 (name: string, value: Vector4) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.vector4s[name] = value;
  }

  getGlobalVector4 (name: string): Vector4 {
    return this.renderingData.currentFrame.globalUniforms.vector4s[name];
  }

  override setGlobalInt (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.ints[name] = value;
  }

  override setGlobalMatrix (name: string, value: Matrix4) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.matrices[name] = value;
  }

  override setGlobalVector3 (name: string, value: Vector3) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.vector3s[name] = value;
  }

  override drawGeometry (geometry: Geometry, matrix: Matrix4, material: Material, subMeshIndex = 0): void {
    if (!geometry || !material) {
      return;
    }
    material.initialize();
    geometry.initialize();
    geometry.flush();
    const renderingData = this.renderingData;

    material.setMatrix('effects_ObjectToWorld', matrix);

    try {
      material.use(this, renderingData.currentFrame.globalUniforms);
    } catch (e) {
      console.error(e);

      return;
    }

    this.glRenderer.drawGeometry(geometry, material, subMeshIndex);
  }

  override setFramebuffer (framebuffer: Framebuffer | null) {
    if (framebuffer) {
      this.framebuffer = framebuffer;
      this.framebuffer.bind();
      this.setViewport(framebuffer.viewport[0], framebuffer.viewport[1], framebuffer.viewport[2], framebuffer.viewport[3]);
    } else {
      //@ts-expect-error
      this.framebuffer = null;
      (this.engine as GLEngine).bindSystemFramebuffer();
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }
  }

  override getFramebuffer (): Framebuffer {
    return this.framebuffer;
  }

  override getTemporaryRT (name: string, width: number, height: number, depthBuffer: number, filter: FilterMode, format: RenderTextureFormat): Framebuffer {
    if (this.temporaryRTs[name]) {
      return this.temporaryRTs[name];
    }

    let textureFilter;
    let textureType;
    let depthType = RenderPassAttachmentStorageType.none;

    // TODO 建立Map映射
    if (filter === FilterMode.Linear) {
      textureFilter = glContext.LINEAR;
    } else if (filter === FilterMode.Nearest) {
      textureFilter = glContext.NEAREST;
    }
    if (format === RenderTextureFormat.RGBA32) {
      textureType = glContext.UNSIGNED_BYTE;
    } else if (format === RenderTextureFormat.RGBAHalf) {
      textureType = glContext.HALF_FLOAT;
    }
    if (depthBuffer === 0) {
      depthType = RenderPassAttachmentStorageType.none;
    } else if (depthBuffer === 16) {
      depthType = RenderPassAttachmentStorageType.depth_16_opaque;
    } else if (depthBuffer === 24) {
      depthType = RenderPassAttachmentStorageType.depth_24_stencil_8_texture;
    }

    const colorAttachment = new GLTexture(this.engine, {
      sourceType: TextureSourceType.framebuffer,
      minFilter: textureFilter,
      magFilter: textureFilter,
      internalFormat: glContext.RGBA,
      format: glContext.RGBA,
      type: textureType,
    });
    const newFramebuffer = new GLFramebuffer({
      name,
      storeAction: {},
      viewport: [0, 0, width, height],
      viewportScale: 1,
      isCustomViewport: true,
      attachments: [colorAttachment],
      depthStencilAttachment: { storageType: depthType },
    }, this);

    this.temporaryRTs[name] = newFramebuffer;

    return newFramebuffer;
  }

  override setViewport (x: number, y: number, width: number, height: number) {
    (this.engine as GLEngine).viewport(x, y, width, height);
  }

  override clear (action: RenderPassStoreAction | RenderPassClearAction): void {
    const engine = this.engine as GLEngine;
    let bit = 0;

    if (action.colorAction === TextureLoadAction.clear) {
      const clearColor = action.clearColor;

      if (clearColor) {
        engine.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
      }
      engine.colorMask(true, true, true, true);
      bit = glContext.COLOR_BUFFER_BIT;
    }
    if (action.stencilAction === TextureLoadAction.clear) {
      engine.stencilMask(0xff);
      engine.clearStencil(action.clearStencil || 0);
      bit = bit | glContext.STENCIL_BUFFER_BIT;
    }
    if (action.depthAction === TextureLoadAction.clear) {
      const depth = action.clearDepth as number;

      engine.depthMask(true);
      engine.clearDepth(Number.isFinite(depth) ? depth : 1);
      bit = bit | glContext.DEPTH_BUFFER_BIT;
    }
    if (bit) {
      engine.clear(bit);
    }
  }

  override addLostHandler (lostHandler: LostHandler): void {
    this.context.addLostHandler(lostHandler);
  }

  override addRestoreHandler (restoreHandler: RestoreHandler) {
    this.context.addRestoreHandler(restoreHandler);
  }

  override getShaderLibrary (): ShaderLibrary | undefined {
    return (this.engine as GLEngine).shaderLibrary;
  }

  override getWidth (): number {
    return this.width;
  }

  override getHeight (): number {
    return this.height;
  }

  override dispose (): void {
    this.context.dispose();
    this.extension.dispose();
    this.glRenderer?.dispose();
    // @ts-expect-error
    this.canvas = null;
    this.engine.dispose();
  }

  override lost (e: Event) {
    e.preventDefault();
    this.extension.dispose();
    this.glRenderer.lost(e);
  }

  override restore () {
    // FIXME: 需要测试下lost和restore流程
    const { gl } = this.context;

    if (!gl) {
      throw new Error('Can not restore automatically because losing gl context.');
    }
    const engine = this.engine as GLEngine;

    engine.reset();
    engine.shaderLibrary = new GLShaderLibrary(engine);
    engine.gpuCapability = new GPUCapability(gl);
    this.glRenderer = new GLRendererInternal(this.engine as GLEngine);
    this.extension = new ExtWrap(this);
  }

  override resize (width: number, height: number): void {
    const internal = this.glRenderer;

    if (internal) {
      if (this.width !== width || this.height !== height) {
        internal.resize(width, height);
      }
    }
  }

  private checkGlobalUniform (name: string) {
    const globalUniforms = this.renderingData.currentFrame.globalUniforms;

    if (!globalUniforms.uniforms.includes(name)) {
      globalUniforms.uniforms.push(name);
    }
  }
}
