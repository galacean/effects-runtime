import type { Disposable, FrameBuffer, Geometry, LostHandler, Material, Mesh, RenderFrame, RenderPass, RenderPassClearAction, RenderPassStoreAction, RestoreHandler, ShaderLibrary, math } from '@galacean/effects-core';
import { assertExist, glContext, Renderer, RenderPassAttachmentStorageType, TextureLoadAction, TextureSourceType, FilterMode, RenderTextureFormat, sortByOrder } from '@galacean/effects-core';
import { ExtWrap } from './ext-wrap';
import { GLContextManager } from './gl-context-manager';
import { GLFrameBuffer } from './gl-frame-buffer';
import { GLPipelineContext } from './gl-pipeline-context';
import { GLRendererInternal } from './gl-renderer-internal';
import { GLTexture } from './gl-texture';
import { GLEngine } from './gl-engine';

type Matrix4 = math.Matrix4;

export class GLRenderer extends Renderer implements Disposable {
  glRenderer: GLRendererInternal;
  extension: ExtWrap;
  frameBuffer: FrameBuffer;
  temporaryRTs: Record<string, FrameBuffer> = {};
  pipelineContext: GLPipelineContext;

  readonly context: GLContextManager;

  constructor (
    public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    framework: 'webgl' | 'webgl2',
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
    this.pipelineContext = new GLPipelineContext(this.engine as GLEngine, gl);
    this.glRenderer = new GLRendererInternal(this.engine as GLEngine);
    this.extension = new ExtWrap(this);
    this.renderingData = {
      //@ts-expect-error
      currentFrame: {},
    };

    this.frameBuffer = new GLFrameBuffer({
      storeAction: {},
      viewport: [0, 0, this.width, this.height],
      attachments: [new GLTexture(this.engine, {
        sourceType: TextureSourceType.framebuffer,
        data: { width: this.width, height: this.height },
      })],
      depthStencilAttachment: { storageType: RenderPassAttachmentStorageType.none },
    }, this);
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

    // TODO 需要一个贴图统一初始化的管理类，避免在渲染逻辑代码中初始化。
    // 初始化renderframe的贴图资源
    // if (frame.cachedTextures) {
    //   for (const texture of frame.cachedTextures) {
    //     (texture as GLTexture).initialize(this.pipelineContext);
    //   }
    // }
    if (frame.resource) {
      frame.resource.color_b.initialize();
    }
    frame.emptyTexture.initialize();
    frame.transparentTexture.initialize();

    const passes = frame._renderPasses;

    if (this.isDestroyed) {
      return console.error('renderer is destroyed', this);
    }
    frame.renderer.getShaderLibrary()!.compileAllShaders();
    this.setFrameBuffer(null);
    this.clear(frame.clearAction);

    this.renderingData.currentFrame = frame;
    this.renderingData.currentCamera = frame.camera;

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

  override renderMeshes (meshes: Mesh[]) {
    const delegate = this.renderingData.currentPass.delegate;

    for (const mesh of meshes) {
      if (mesh.isDestroyed) {
        // console.error(`mesh ${mesh.name} destroyed`, mesh);
        continue;
      }
      if (!mesh.getVisible()) {
        continue;
      }
      if (!mesh.material) {
        console.warn('Mesh ' + mesh.name + ' 没有绑定材质。');

        continue;
      }
      mesh.material.initialize();
      mesh.geometry.initialize();
      delegate.willRenderMesh?.(mesh, this.renderingData);
      mesh.render(this);
      delegate.didRenderMesh?.(mesh, this.renderingData);
    }
  }

  override setGlobalFloat (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.floats[name] = value;
  }

  override setGlobalInt (name: string, value: number) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.ints[name] = value;
  }

  override setGlobalMatrix (name: string, value: Matrix4) {
    this.checkGlobalUniform(name);
    this.renderingData.currentFrame.globalUniforms.matrices[name] = value;
  }

  override drawGeometry (geometry: Geometry, material: Material): void {
    this.glRenderer.drawGeometry(geometry, material);
  }

  override setFrameBuffer (frameBuffer: FrameBuffer | null) {
    if (frameBuffer) {
      this.frameBuffer = frameBuffer;
      this.frameBuffer.bind();
      this.setViewport(frameBuffer.viewport[0], frameBuffer.viewport[1], frameBuffer.viewport[2], frameBuffer.viewport[3]);
    } else {
      //this.frameBuffer = null;
      this.pipelineContext.bindSystemFramebuffer();
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }
  }

  override getFrameBuffer (): FrameBuffer | null {
    return this.frameBuffer;
  }

  override getTemporaryRT (name: string, width: number, height: number, depthBuffer: number, filter: FilterMode, format: RenderTextureFormat): FrameBuffer | null {
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
    const newFrameBuffer = new GLFrameBuffer({
      name,
      storeAction: {},
      viewport: [0, 0, width, height],
      viewportScale: 1,
      isCustomViewport: true,
      attachments: [colorAttachment],
      depthStencilAttachment: { storageType: depthType },
    }, this);

    this.temporaryRTs[name] = newFrameBuffer;

    return newFrameBuffer;
  }

  override setViewport (x: number, y: number, width: number, height: number) {
    this.pipelineContext.viewport(x, y, width, height);
  }

  override clear (action: RenderPassStoreAction | RenderPassClearAction): void {
    const state = this.pipelineContext;
    let bit = 0;

    if (action.colorAction === TextureLoadAction.clear) {
      const clearColor = action.clearColor;

      if (clearColor) {
        state.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
      }
      state.colorMask(true, true, true, true);
      bit = glContext.COLOR_BUFFER_BIT;
    }
    if (action.stencilAction === TextureLoadAction.clear) {
      state.stencilMask(0xff);
      state.clearStencil(action.clearStencil || 0);
      bit = bit | glContext.STENCIL_BUFFER_BIT;
    }
    if (action.depthAction === TextureLoadAction.clear) {
      const depth = action.clearDepth as number;

      state.depthMask(true);
      state.clearDepth(Number.isFinite(depth) ? depth : 1);
      bit = bit | glContext.DEPTH_BUFFER_BIT;
    }
    if (bit) {
      state.clear(bit);
    }
  }

  override addLostHandler (lostHandler: LostHandler): void {
    this.context.addLostHandler(lostHandler);
  }

  override addRestoreHandler (restoreHandler: RestoreHandler) {
    this.context.addRestoreHandler(restoreHandler);
  }

  override getShaderLibrary (): ShaderLibrary | undefined {
    return this.pipelineContext.shaderLibrary;
  }

  override getWidth (): number {
    return this.width;
  }

  override getHeight (): number {
    return this.height;
  }

  override dispose (haltGL?: boolean): void {
    this.context.dispose();
    this.extension.dispose();
    this.pipelineContext.dispose();
    this.glRenderer?.dispose(haltGL);
    // @ts-expect-error
    this.canvas = null;
    this.engine.dispose();
  }

  override lost (e: Event) {
    e.preventDefault();
    this.pipelineContext.dispose();
    this.extension.dispose();
    this.glRenderer.lost(e);
  }

  override restore () {
    // FIXME: 需要测试下lost和restore流程
    const { gl } = this.context;

    if (!gl) {
      throw new Error('Can not restore automatically because losing gl context');
    }
    this.engine = new GLEngine(gl);
    this.engine.renderer = this;
    this.pipelineContext = new GLPipelineContext(this.engine as GLEngine, gl);
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
