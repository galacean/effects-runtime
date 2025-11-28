import type {
  Disposable, Engine, Framebuffer, Geometry, Material, RenderFrame, RenderPass,
  RenderPassClearAction, RendererComponent,
  ShaderLibrary, math,
} from '@galacean/effects-core';
import {
  GPUCapability,
  Renderer, TextureLoadAction, assertExist, glContext, logger, sortByOrder,
} from '@galacean/effects-core';
import type { GLEngine } from './gl-engine';
import type { GLFramebuffer } from './gl-framebuffer';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLTexture } from './gl-texture';
import { GLShaderLibrary } from './gl-shader-library';
import type { GLGeometry } from './gl-geometry';
import type { GLMaterial } from './gl-material';
import type { GLShaderVariant } from './gl-shader';
import type { GLRenderbuffer } from './gl-renderbuffer';
import { GLVertexArrayObject } from './gl-vertex-array-object';
import type { GLGPUBuffer } from './gl-gpu-buffer';

type Matrix4 = math.Matrix4;
type Vector4 = math.Vector4;
type Vector3 = math.Vector3;

let seed = 1;

export class GLRenderer extends Renderer implements Disposable {
  temporaryRTs: Record<string, Framebuffer> = {};
  readonly name: string;

  private sourceFbo: WebGLFramebuffer | null;
  private targetFbo: WebGLFramebuffer | null;
  private disposed = false;

  get gl () {
    return (this.engine as GLEngine).gl;
  }

  get height () {
    return this.gl?.drawingBufferHeight;
  }

  get width () {
    return this.gl?.drawingBufferWidth;
  }

  get canvas () {
    return this.gl.canvas;
  }

  get isDisposed () {
    return this.disposed;
  }

  get context () {
    return (this.engine as GLEngine).context;
  }

  constructor (engine: Engine) {
    super(engine);

    this.name = `GLRenderer#${seed++}`;

    const { gl } = this.context;

    assertExist(gl);
    this.renderingData = {
      // @ts-expect-error
      currentFrame: {},
    };
  }

  override renderRenderFrame (renderFrame: RenderFrame) {
    const frame = renderFrame;
    const passes = frame._renderPasses;

    if (this.isDisposed) {
      console.error('Renderer is destroyed, target: GLRenderer.');

      return;
    }

    frame.renderer.getShaderLibrary()?.compileAllShaders();
    frame.setup();

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
      this.renderRenderPass(pass);
    }

    for (const pass of passes) {
      pass.onCameraCleanup(this);
    }

    this.renderTargetPool.flush();
  }

  renderRenderPass (pass: RenderPass): void {
    this.renderingData.currentPass = pass;
    // 配置当前 renderer 的 RT
    pass.configure(this);
    // 执行当前 pass
    pass.execute(this);
  }

  override renderMeshes (meshes: RendererComponent[]) {
    for (const mesh of meshes) {
      mesh.render(this);
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

    const gl = (this.engine as GLEngine).gl;

    if (!gl) {
      console.warn('GLGPURenderer has not bound a gl object, unable to render geometry.');

      return;
    }

    const glGeometry = geometry as GLGeometry;
    const glMaterial = material as GLMaterial;
    const program = (glMaterial.shaderVariant as GLShaderVariant).program;

    if (!program) {
      return;
    }

    const vao = program.setupAttributes(glGeometry);
    const indicesBuffer = glGeometry.indicesBuffer;
    let offset = glGeometry.drawStart;
    let count = glGeometry.drawCount;
    const mode = glGeometry.mode;
    const subMeshes = glGeometry.subMeshes;

    if (subMeshes && subMeshes.length) {
      const subMesh = subMeshes[subMeshIndex];

      // FIXME: 临时处理3D线框状态下隐藏模型
      if (count < 0) {
        return;
      }
      offset = subMesh.offset;
      if (indicesBuffer) {
        count = subMesh.indexCount ?? 0;
      } else {
        count = subMesh.vertexCount;
      }
    }
    if (indicesBuffer) {
      gl.drawElements(mode, count, indicesBuffer.type, offset ?? 0);
    } else {
      gl.drawArrays(mode, offset, count);
    }
    vao?.unbind();
  }

  override setFramebuffer (framebuffer: Framebuffer | null) {
    if (this.currentFramebuffer === framebuffer) {
      return;
    }

    this.currentFramebuffer = framebuffer;

    if (framebuffer) {
      framebuffer.bind();
      this.setViewport(framebuffer.viewport[0], framebuffer.viewport[1], framebuffer.viewport[2], framebuffer.viewport[3]);
    } else {
      (this.engine as GLEngine).bindSystemFramebuffer();
      this.setViewport(0, 0, this.getWidth(), this.getHeight());
    }
  }

  override setViewport (x: number, y: number, width: number, height: number) {
    (this.engine as GLEngine).viewport(x, y, width, height);
  }

  override clear (action: RenderPassClearAction): void {
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
    if (this.disposed) {
      return;
    }
    this.deleteResource();
    this.renderTargetPool.dispose();
    this.disposed = true;
  }

  override lost (e: Event) {
    e.preventDefault();
    logger.error(`WebGL context lost, destroying glRenderer by default to prevent memory leaks. Event target: ${e.target}.`);
    this.deleteResource();
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
  }

  override resize (width: number, height: number): void {
    if (this.width !== width || this.height !== height) {
      const gl = this.gl;

      if (gl && gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
        gl.canvas.width = width;
        gl.canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }
  }

  private checkGlobalUniform (name: string) {
    const globalUniforms = this.renderingData.currentFrame.globalUniforms;

    if (!globalUniforms.uniforms.includes(name)) {
      globalUniforms.uniforms.push(name);
    }
  }

  copy2 (source: GLTexture, target: GLTexture) {
    const gl = this.gl as WebGL2RenderingContext;

    if (!gl) {
      return;
    }

    if (!this.sourceFbo) {
      this.sourceFbo = gl.createFramebuffer();
    }
    if (!this.targetFbo) {
      this.targetFbo = gl.createFramebuffer();
    }
    const engine = this.engine as GLEngine;

    engine.bindFramebuffer(gl.FRAMEBUFFER, this.sourceFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, source.textureBuffer, 0);
    engine.bindFramebuffer(gl.FRAMEBUFFER, this.targetFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.textureBuffer, 0);
    engine.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceFbo);
    engine.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.targetFbo);

    const filter = source.getWidth() === source.getHeight() && target.getWidth() == target.getHeight() ? gl.NEAREST : gl.LINEAR;

    gl.blitFramebuffer(0, 0, source.getWidth(), source.getHeight(), 0, 0, target.getWidth(), target.getHeight(), gl.COLOR_BUFFER_BIT, filter);
    engine.bindFramebuffer(gl.FRAMEBUFFER, null);
    engine.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    engine.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  createGLRenderbuffer (renderbuffer: GLRenderbuffer): WebGLRenderbuffer | null {
    const rb = this.gl.createRenderbuffer();

    return rb;
  }

  createGLFramebuffer (name?: string): WebGLFramebuffer | null {
    const fbo = this.gl.createFramebuffer();

    if (fbo) {
      assignInspectorName(fbo, name, name);
    } else {
      throw new Error(`Failed to create WebGL framebuffer. gl isContextLost=${this.gl.isContextLost()}`);
    }

    return fbo;
  }

  /**创建包裹VAO对象。 */
  createVAO (name?: string): GLVertexArrayObject | undefined {
    const ret = new GLVertexArrayObject(this.engine as GLEngine, name);

    return ret;
  }

  deleteGLTexture (texture: GLTexture) {
    if (texture.textureBuffer && !this.disposed) {
      this.gl.deleteTexture(texture.textureBuffer);
      texture.textureBuffer = null;
    }
  }

  deleteGPUBuffer (buffer: GLGPUBuffer | null) {
    if (buffer && !this.disposed) {
      this.gl.deleteBuffer(buffer.glBuffer);
      // @ts-expect-error
      delete buffer.glBuffer;
    }
  }

  deleteGLFramebuffer (framebuffer: GLFramebuffer) {
    if (framebuffer && !this.disposed) {
      this.gl.deleteFramebuffer(framebuffer.fbo as WebGLFramebuffer);
      delete framebuffer.fbo;
    }
  }

  deleteGLRenderbuffer (renderbuffer: GLRenderbuffer) {
    if (renderbuffer && !this.disposed) {
      this.gl.deleteRenderbuffer(renderbuffer.buffer);
      renderbuffer.buffer = null;
    }
  }

  private deleteResource () {
    const gl = this.gl;

    if (gl) {
      gl.deleteFramebuffer(this.sourceFbo);
      gl.deleteFramebuffer(this.targetFbo);
    }
  }
}
