import type {
  DataBuffer, DataBufferOptions, EngineOptions, IndicesArray, Nullable,
  RenderPassClearAction, ShaderLibrary, ShaderVariant, Texture, VertexBuffer, math,
} from '@galacean/effects-core';
import {
  Engine, GPUCapability, Renderer, TextureLoadAction, assertExist,
  glContext, isIOS, logger, toBufferView,
} from '@galacean/effects-core';
import { GLShaderLibrary } from './gl-shader-library';
import type { GLTexture } from './gl-texture';
import { GLContextManager } from './gl-context-manager';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLFramebuffer } from './gl-framebuffer';
import type { GLRenderbuffer } from './gl-renderbuffer';
import type { GLShaderVariant } from './gl-shader';
import { GLDataBuffer } from './gl-data-buffer';

type Color = math.Color;
type BufferData = number[] | ArrayBuffer | ArrayBufferView;
type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

const INSTANCE_DRAW_ERROR = 'Instanced drawing is not supported by the current graphics context.';

export class GLEngine extends Engine {
  textureUnitDict: Record<string, WebGLTexture | null>;
  shaderLibrary: GLShaderLibrary;
  gl: WebGL2RenderingContext;
  context: GLContextManager;

  private readonly maxTextureCount: number;
  private glCapabilityCache: Record<string, any>;
  private currentFramebuffer: Record<number, WebGLFramebuffer | null>;
  private currentTextureBinding: Record<number, Record<number, WebGLTexture | null>>;
  private currentRenderbuffer: Record<number, WebGLRenderbuffer | null>;
  private currentIndexBuffer: DataBuffer | null = null;
  private currentVertexArrayObject: WebGLVertexArrayObject | null = null;
  private vaoRecordInProgress = false;
  private activeTextureIndex: number;
  private pixelStorei: Record<string, GLenum>;

  constructor (canvas: HTMLCanvasElement, options?: EngineOptions) {
    super(canvas, options);
    options = {
      preserveDrawingBuffer: undefined,
      alpha: true,
      stencil: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: true,
      glType: 'webgl2',
      ...options,
    };

    this.context = new GLContextManager(canvas, options.glType, options);
    this.context.addLostHandler({
      lost: e => {
        // 仅恢复模式启用帧短路标志。
        if (!this.doNotHandleContextLost) {
          this.contextWasLost = true;
        }
        this.compositions.forEach(comp => comp.lost(e));
        logger.error(`WebGL context lost. Event target: ${e.target}.`);
        this.emit('contextlost', { engine: this, e });
      },
    });

    this.context.addRestoreHandler({
      restore: async () => {
        if (this.doNotHandleContextLost) {
          this.emit('contextrestored', this);

          return;
        }

        try {
          const gl = this.context.gl;

          if (!gl) {
            return;
          }
          // 1. 清空与旧上下文绑定的状态缓存。
          this.gl = gl;
          this.reset();
          // 2. 重新探测 GPU 能力并初始化上下文方法。
          this.initGLContext();
          // 3. 重建 shader（先于其它资源：纹理/几何上传可能依赖 shader）。
          await this.shaderLibrary.restore();
          // 4. 重建几何顶点缓冲
          this.geometries.forEach(geo => geo.restore());
          // 5. 从粒子系统保留的数据重建动态缓冲内容
          this.particleSystems.forEach(particleSystem => particleSystem.rebuild());
          // 6. 重建 renderbuffer
          this.renderbuffers.forEach(rb => (rb as GLRenderbuffer).restore());
          // 7. 重建纹理
          this.textures.forEach(tex => (tex as GLTexture).restore());
          // 8. 重建 framebuffer（最后：附件纹理已就绪，仅重挂 fbo）。
          this.framebuffers.forEach(fb => (fb as GLFramebuffer).restore());

          if (isIOS() && this.canvas) {
            this.canvas.style.display = 'none';
            window.setTimeout(() => {
              this.canvas.style.display = '';
            }, 0);
          }
        } catch (e) {
          this.renderErrors.add(e as Error);
        } finally {
          // 无论重建成功、部分失败还是 gl 不可用，都复位标志并通知宿主，避免 mainLoop 永久短路。
          this.contextWasLost = false;
          this.emit('contextrestored', this);
        }
      },
    });

    const gl = this.context.gl;

    assertExist(gl);
    this.gl = gl;
    this.reset();
    this.initGLContext();
    this.shaderLibrary = new GLShaderLibrary(this);
    this.renderer = new Renderer(this);
    this.maxTextureCount = this.gl.TEXTURE0 + this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1;

    // resize need gl renderer initialized
    this.resize();
  }

  protected initGLContext (): void {
    const gl = this.gl;

    this.gpuCapability = new GPUCapability(gl);
    if (this.gpuCapability.isWebGL2) {
      return;
    }

    const vertexArrayObjectExtension = gl.getExtension('OES_vertex_array_object');

    if (vertexArrayObjectExtension) {
      gl.createVertexArray = vertexArrayObjectExtension.createVertexArrayOES.bind(
        vertexArrayObjectExtension,
      );
      gl.bindVertexArray = vertexArrayObjectExtension.bindVertexArrayOES.bind(
        vertexArrayObjectExtension,
      );
      gl.deleteVertexArray = vertexArrayObjectExtension.deleteVertexArrayOES.bind(
        vertexArrayObjectExtension,
      );
    } else {
      gl.createVertexArray = (() => null) as unknown as WebGL2RenderingContext['createVertexArray'];
      gl.bindVertexArray = () => {};
      gl.deleteVertexArray = () => {};
    }

    const instanceExtension = gl.getExtension('ANGLE_instanced_arrays');

    if (instanceExtension) {
      gl.drawArraysInstanced = instanceExtension.drawArraysInstancedANGLE.bind(instanceExtension);
      gl.drawElementsInstanced = instanceExtension.drawElementsInstancedANGLE.bind(instanceExtension);
      gl.vertexAttribDivisor = instanceExtension.vertexAttribDivisorANGLE.bind(instanceExtension);
    } else {
      gl.drawArraysInstanced = () => {
        throw new Error(INSTANCE_DRAW_ERROR);
      };
      gl.drawElementsInstanced = () => {
        throw new Error(INSTANCE_DRAW_ERROR);
      };
      gl.vertexAttribDivisor = () => {
        throw new Error(INSTANCE_DRAW_ERROR);
      };
    }
  }

  override getWidth (): number {
    return this.gl.drawingBufferWidth;
  }

  override getHeight (): number {
    return this.gl.drawingBufferHeight;
  }

  override getShaderLibrary (): ShaderLibrary | null {
    return this.shaderLibrary;
  }

  override createVertexBuffer (
    data: BufferData | number,
    options: DataBufferOptions,
  ): GLDataBuffer {
    const resource = this.gl.createBuffer();

    if (!resource) {
      throw new Error(`Failed to create buffer. gl isContextLost=${this.gl.isContextLost()}`);
    }
    const buffer = new GLDataBuffer(resource);
    const view = typeof data === 'number' ? undefined : toBufferView(data);
    const byteLength = typeof data === 'number' ? data : view!.byteLength;

    assignInspectorName(resource, options.label);
    this.bindArrayBuffer(buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, Math.max(byteLength, 1), options.usage);
    if (view && byteLength > 0) {
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, view);
    }
    this.bindArrayBuffer(null);
    buffer.capacity = byteLength;
    buffer.references = 1;

    return buffer;
  }

  override createDynamicVertexBuffer (
    data: BufferData | number,
    options: DataBufferOptions,
  ): GLDataBuffer {
    return this.createVertexBuffer(data, options);
  }

  override createIndexBuffer (
    indices: IndicesArray,
    options: DataBufferOptions,
  ): GLDataBuffer {
    const data = this.normalizeIndexData(indices);
    const resource = this.gl.createBuffer();

    if (!resource) {
      throw new Error(`Failed to create buffer. gl isContextLost=${this.gl.isContextLost()}`);
    }
    const buffer = new GLDataBuffer(resource);

    assignInspectorName(resource, options.label);
    this.bindIndexBuffer(buffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, Math.max(data.byteLength, 1), options.usage);
    if (data.byteLength > 0) {
      this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, 0, data);
    }
    this.bindIndexBuffer(null);
    buffer.capacity = data.byteLength;
    buffer.references = 1;
    buffer.is32Bits = data instanceof Uint32Array;

    return buffer;
  }

  override updateDynamicVertexBuffer (
    vertexBuffer: DataBuffer,
    data: BufferData,
    byteOffset = 0,
    byteLength?: number,
  ): void {
    let view = toBufferView(data);

    if (byteLength !== undefined && byteLength < view.byteLength) {
      view = new Uint8Array(view.buffer, view.byteOffset, byteLength);
    }
    if (byteOffset < 0 || byteOffset + view.byteLength > vertexBuffer.capacity) {
      throw new RangeError('Buffer update is out of range.');
    }
    this.bindArrayBuffer(vertexBuffer);
    if (view.byteLength > 0) {
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, byteOffset, view);
    }
  }

  override updateDynamicIndexBuffer (
    indexBuffer: DataBuffer,
    indices: IndicesArray,
    byteOffset = 0,
  ): void {
    const data = indexBuffer.is32Bits
      ? indices instanceof Uint32Array ? indices : new Uint32Array(indices)
      : indices instanceof Uint16Array ? indices : new Uint16Array(indices);

    if (byteOffset < 0 || byteOffset + data.byteLength > indexBuffer.capacity) {
      throw new RangeError('Buffer update is out of range.');
    }
    this.bindIndexBuffer(indexBuffer);
    if (data.byteLength > 0) {
      this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, byteOffset, data);
    }
    this.bindIndexBuffer(null);
  }

  /** @hide */
  override releaseBuffer (buffer: DataBuffer): boolean {
    buffer.references--;
    if (buffer.references !== 0) {
      return false;
    }
    if (!this.disposed) {
      this.gl.deleteBuffer(buffer.underlyingResource as WebGLBuffer);
    }
    buffer.capacity = 0;

    return true;
  }

  /** @hide */
  releaseVertexArrayObject (vertexArrayObject: WebGLVertexArrayObject): void {
    this.gl.deleteVertexArray(vertexArrayObject);
  }

  /** @hide */
  recordVertexArrayObject (
    vertexBuffers: Record<string, VertexBuffer>,
    indexBuffer: DataBuffer | null,
    effect: ShaderVariant,
  ): WebGLVertexArrayObject | undefined {
    const vertexArrayObject = this.gl.createVertexArray() ?? undefined;

    if (!vertexArrayObject) {
      return undefined;
    }
    this.vaoRecordInProgress = true;
    this.bindVertexArrayObject(vertexArrayObject, null);
    this.bindVertexBuffersAttributes(vertexBuffers, effect);
    this.bindIndexBuffer(indexBuffer);
    this.vaoRecordInProgress = false;
    this.bindVertexArrayObject(null, null);

    return vertexArrayObject;
  }

  /** @hide */
  override bindBuffers (
    vertexBuffers: Record<string, VertexBuffer>,
    indexBuffer: DataBuffer | null,
    effect: ShaderVariant,
  ): void {
    this.bindVertexArrayObject(null, null);
    this.bindVertexBuffersAttributes(vertexBuffers, effect);
    this.bindIndexBuffer(indexBuffer);
  }

  private bindVertexBuffersAttributes (
    vertexBuffers: Record<string, VertexBuffer>,
    effect: ShaderVariant,
  ): void {
    const gl = this.gl;
    const program = (effect as GLShaderVariant).program;
    const attributes = program.getAttributesNames();

    for (let index = 0; index < attributes.length; index++) {
      const location = program.getAttributeLocation(index);

      if (location < 0) {
        continue;
      }
      const name = attributes[index];
      const attribute = vertexBuffers[name];

      if (!attribute) {
        continue;
      }
      const buffer = attribute.getBuffer();

      if (!buffer) {
        throw new Error(`Failed to find a buffer named '${attribute.getKind() || name}'. Please ensure the buffer is correctly initialized and bound.`);
      }
      this.bindArrayBuffer(buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(
        location,
        attribute.getSize(),
        attribute.type,
        attribute.normalized,
        attribute.byteStride,
        attribute.byteOffset,
      );
      if (attribute.getInstanceDivisor() > 0) {
        gl.vertexAttribDivisor(location, attribute.getInstanceDivisor());
      }
    }
  }

  bindArrayBuffer (buffer: DataBuffer | null): void {
    if (!this.vaoRecordInProgress) {
      this.unbindVertexArrayObject();
    }
    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      buffer?.underlyingResource as WebGLBuffer | undefined ?? null,
    );
  }

  protected bindIndexBuffer (buffer: DataBuffer | null): void {
    if (!this.vaoRecordInProgress) {
      this.unbindVertexArrayObject();
    }
    this.currentIndexBuffer = buffer;
    this.gl.bindBuffer(
      this.gl.ELEMENT_ARRAY_BUFFER,
      buffer?.underlyingResource as WebGLBuffer | undefined ?? null,
    );
  }

  private normalizeIndexData (indices: IndicesArray): Uint16Array | Uint32Array {
    if (indices instanceof Uint16Array) {
      return indices;
    }
    const supports32Bits = this.gpuCapability.isWebGL2
      || this.gpuCapability.detail.intIndexElementBuffer;

    if (supports32Bits) {
      if (indices instanceof Uint32Array) {
        return indices;
      }
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] >= 65535) {
          return new Uint32Array(indices);
        }
      }
    }

    return new Uint16Array(indices);
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

  /** @hide */
  bindVertexArrayObject (
    vertexArrayObject: WebGLVertexArrayObject | null,
    indexBuffer: DataBuffer | null,
  ): void {
    this.currentIndexBuffer = indexBuffer;
    if (this.currentVertexArrayObject === vertexArrayObject) {
      return;
    }
    this.currentVertexArrayObject = vertexArrayObject;
    this.gl.bindVertexArray(vertexArrayObject);
  }

  private unbindVertexArrayObject (): void {
    if (!this.currentVertexArrayObject) {
      return;
    }
    this.currentVertexArrayObject = null;
    this.currentIndexBuffer = null;
    this.gl.bindVertexArray(null);
  }

  deleteGLTexture (texture: GLTexture) {
    if (texture.textureBuffer && !this.disposed) {
      this.gl.deleteTexture(texture.textureBuffer);
      texture.textureBuffer = null;
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

  override drawElementsType (
    mode: number,
    indexOffset: number,
    indexCount: number,
    instanceCount?: number,
  ): void {
    if (instanceCount && !this.gpuCapability.detail.instanceDraw) {
      throw new Error(INSTANCE_DRAW_ERROR);
    }
    const indexType = this.currentIndexBuffer?.is32Bits
      ? this.gl.UNSIGNED_INT
      : this.gl.UNSIGNED_SHORT;

    if (instanceCount) {
      this.gl.drawElementsInstanced(mode, indexCount, indexType, indexOffset, instanceCount);
    } else {
      this.gl.drawElements(mode, indexCount, indexType, indexOffset);
    }
  }

  override drawArraysType (
    mode: number,
    vertexStart: number,
    vertexCount: number,
    instanceCount?: number,
  ): void {
    if (instanceCount && !this.gpuCapability.detail.instanceDraw) {
      throw new Error(INSTANCE_DRAW_ERROR);
    }
    if (instanceCount) {
      this.gl.drawArraysInstanced(mode, vertexStart, vertexCount, instanceCount);
    } else {
      this.gl.drawArrays(mode, vertexStart, vertexCount);
    }
  }

  override clear (action: RenderPassClearAction): void {
    let bit = 0;

    if (action.colorAction === TextureLoadAction.clear) {
      const clearColor = action.clearColor;

      if (clearColor) {
        this.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
      }
      this.colorMask(true, true, true, true);
      bit = glContext.COLOR_BUFFER_BIT;
    }
    if (action.stencilAction === TextureLoadAction.clear) {
      this.stencilMask(0xff);
      this.clearStencil(action.clearStencil || 0);
      bit = bit | glContext.STENCIL_BUFFER_BIT;
    }
    if (action.depthAction === TextureLoadAction.clear) {
      const depth = action.clearDepth as number;

      this.depthMask(true);
      this.clearDepth(Number.isFinite(depth) ? depth : 1);
      bit = bit | glContext.DEPTH_BUFFER_BIT;
    }
    if (bit) {
      this.gl.clear(bit);
    }
  }

  override dispose () {
    if (this.disposed) {
      return;
    }
    super.dispose();

    this.renderer.dispose();
    this.renderTargetPool.dispose();
    this.shaderLibrary?.dispose();
    this.context.dispose(this.ownsCanvas);
    this.reset();
  }

  reset () {
    this.glCapabilityCache = {};
    this.activeTextureIndex = glContext.TEXTURE0;
    this.textureUnitDict = {};
    this.currentFramebuffer = {};
    this.currentTextureBinding = {};
    this.pixelStorei = {};
    this.currentRenderbuffer = {};
    this.currentIndexBuffer = null;
    this.currentVertexArrayObject = null;
    this.vaoRecordInProgress = false;
  }

  override setSampleAlphaToCoverage (enable: boolean) {
    if (enable) {
      this.enable(glContext.SAMPLE_ALPHA_TO_COVERAGE);
    } else {
      this.disable(glContext.SAMPLE_ALPHA_TO_COVERAGE);
    }
  }

  override setBlending (enable: boolean) {
    if (enable) {
      this.enable(glContext.BLEND);
    } else {
      this.disable(glContext.BLEND);
    }
  }

  override setDepthTest (enable: boolean) {
    if (enable) {
      this.enable(glContext.DEPTH_TEST);
    } else {
      this.disable(glContext.DEPTH_TEST);
    }
  }

  override setStencilTest (enable: boolean) {
    if (enable) {
      this.enable(glContext.STENCIL_TEST);
    } else {
      this.disable(glContext.STENCIL_TEST);
    }
  }

  override setScissorTest (enable: boolean) {
    if (enable) {
      this.enable(glContext.SCISSOR_TEST);
    } else {
      this.disable(glContext.SCISSOR_TEST);
    }
  }

  override setScissor (x: number, y: number, width: number, height: number) {
    this.set4('scissor', x, y, width, height);
  }

  override setCulling (enable: boolean) {
    if (enable) {
      this.enable(glContext.CULL_FACE);
    } else {
      this.disable(glContext.CULL_FACE);
    }
  }

  override setPolygonOffsetFill (enable: boolean) {
    if (enable) {
      this.enable(glContext.POLYGON_OFFSET_FILL);
    } else {
      this.disable(glContext.POLYGON_OFFSET_FILL);
    }
  }

  /**
   * 对于该上下文开启某种特性
   * @param capability
   * example:
   * gl.enable(gl.DITHER);
   */
  enable (capability: GLenum) {
    const value = this.glCapabilityCache[capability];

    if (value !== true) {
      this.glCapabilityCache[capability] = true;
      this.gl.enable(capability);
    }
  }

  /**
   * 基于某种上下文关闭特性
   * @param capability
   * example:
   * gl.disable(gl.DITHER);
   */
  disable (capability: GLenum) {
    const value = this.glCapabilityCache[capability];

    if (value !== false) {
      this.glCapabilityCache[capability] = false;
      this.gl.disable(capability);
    }
  }

  /**
   * 绑定framebuffer webgl2新增: gl.DRAW_FRAMEBUFFER 和 gl.READ_FRAMEBUFFER
   * @param target
   * @param framebuffer
   * example:
   * const framebuffer = gl.createFramebuffer();
   * gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
   */
  bindFramebuffer (target: GLenum, framebuffer: WebGLFramebuffer | null) {
    if (this.currentFramebuffer[target] !== framebuffer) {
      this.currentFramebuffer[target] = framebuffer;
      this.gl.bindFramebuffer(target, framebuffer);
    }
  }

  bindRenderbuffer (target: GLenum, renderbuffer: WebGLRenderbuffer | null) {
    if (this.currentRenderbuffer[target] !== renderbuffer) {
      this.currentRenderbuffer[target] = renderbuffer;
      this.gl.bindRenderbuffer(target, renderbuffer);
    }
  }

  /**
   * 绑定系统 framebuffer
   */
  override bindSystemFramebuffer () {
    this.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * 将定义好的 WebGLProgram 对象添加到当前的渲染状态中。
   * @param program
   * example:
   * gl.useProgram(program);
   * gl.useProgram(null);
   */
  useProgram (program: WebGLProgram | null) {
    this.set1('useProgram', program);
  }

  /*** depth start ***/

  /**
   * 设置深度缓冲区的深度清除值
   * @param depth
   * example:
   * gl.clearDepth(0.5);
   */
  clearDepth (depth: GLclampf) {
    this.set1('clearDepth', depth);
  }

  /**
   * 指定将输入像素深度与当前深度缓冲区值进行比较的函数。
   * @param func
   * example:
   * gl.enable(gl.DEPTH_TEST);
   * gl.depthFunc(gl.NEVER);
   */
  override depthFunc (func: GLenum) {
    this.set1('depthFunc', func);
  }

  /**
   * 设置是否启用写入深度缓冲。
   * @param flag
   * example:
   * gl.depthMask(false);
   */
  override depthMask (flag: boolean) {
    this.set1('depthMask', flag);
  }

  override polygonOffset (factor: number, unit: number) {
    this.set2('polygonOffset', factor, unit);
  }

  /**
   * 将 z 值从规范化设备坐标映射到窗口坐标
   * @param zNear
   * @param zFar
   * example:
   * gl.depthRange(0.2, 0.6);
   */
  override depthRange (zNear: number, zFar: number) {
    this.set2('depthRange', zNear, zFar);
  }

  /*** depth end ***/

  /*** stencil start ***/

  /**
   * 模版测试设置函数和引用值。
   * @param func
   * @param ref
   * @param mask
   * example:
   * gl.enable(gl.STENCIL_TEST);
   * gl.stencilFunc(gl.LESS, 0, 0b1110011);
   */
  clearStencil (s: GLint) {
    this.set1('clearStencil', s);
  }

  /**
   * 控制启用和禁用模板平面中单个位的正面和背面写入
   * @param mask
   * example:
   * gl.stencilMask(0xff);
   */
  stencilMask (mask: number) {
    this.stencilMaskSeparate(this.gl.FRONT, mask);
    this.stencilMaskSeparate(this.gl.BACK, mask);
  }

  /**
   * 模版测试设置函数和引用值。
   * @param func
   * @param ref
   * @param mask
   * example:
   * gl.enable(gl.STENCIL_TEST);
   * gl.stencilFunc(gl.LESS, 0, 0b1110011);
   */
  stencilFunc (func: GLenum, ref: GLint, mask: GLuint) {
    this.stencilFuncSeparate(this.gl.FRONT, func, ref, mask);
    this.stencilFuncSeparate(this.gl.BACK, func, ref, mask);
  }

  /**
   * 单面模版测试
   * @param face
   * @param func
   * @param ref
   * @param mask
   * example:
   * gl.enable(gl.STENCIL_TEST);
   * gl.stencilFuncSeparate(gl.FRONT, gl.LESS, 0.2, 1110011);
   */
  override stencilFuncSeparate (face: GLenum, func: GLenum, ref: GLint, mask: GLuint) {
    this.set4('stencilFuncSeparate', face, func, ref, mask);
  }

  /**
   * 单面的mask写入
   * @param face
   * @param mask
   * example:
   * gl.stencilMaskSeparate(gl.FRONT, 110101);
   */
  override stencilMaskSeparate (face: GLenum, mask: GLuint) {
    this.set2('stencilMaskSeparate', face, mask);
  }

  /**
   * 设置正面和背面模板测试操作
   * @param fail
   * @param zfail
   * @param zpass
   * example:
   * gl.enable(gl.STENCIL_TEST);
   * gl.stencilOp(gl.INCR, gl.DECR, gl.INVERT);
   */
  stencilOp (fail: GLenum, zfail: GLenum, zpass: GLenum) {
    this.stencilOpSeparate(this.gl.FRONT, fail, zfail, zpass);
    this.stencilOpSeparate(this.gl.BACK, fail, zfail, zpass);
  }

  /**
   * 设置正面和/或背面模板测试操作
   * @param face
   * @param fail
   * @param zfail
   * @param zpass
   * example:
   * gl.enable(gl.STENCIL_TEST);
   * gl.stencilOpSeparate(gl.FRONT, gl.INCR, gl.DECR, gl.INVERT);
   */
  override stencilOpSeparate (face: GLenum, fail: GLenum, zfail: GLenum, zpass: GLenum) {
    this.set4('stencilOpSeparate', face, fail, zfail, zpass);
  }

  /*** stencil end ***/

  /*** face start ***/
  /**
   * 剔除方式
   * @param mode
   * example:
   * gl.enable(gl.CULL_FACE);
   * gl.cullFace(gl.FRONT_AND_BACK);
   */
  override cullFace (mode: GLenum) {
    this.set1('cullFace', mode);
  }

  /**
   * 设置卷绕方向
   * @param mode
   * example:
   * gl.frontFace(gl.CW);
   */
  override frontFace (mode: GLenum) {
    this.set1('frontFace', mode);
  }

  /*** face end ***/

  /*** color start ***/
  /**
   * 设置颜色写入
   * @param red
   * @param green
   * @param blue
   * @param alpha
   * example:
   * gl.colorMask(true, true, true, false);
   */
  clearColor (red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf) {
    this.set4('clearColor', red, green, blue, alpha);
  }

  /**
   * 设置颜色写入
   * @param red
   * @param green
   * @param blue
   * @param alpha
   * example:
   * gl.colorMask(true, true, true, false);
   */
  override colorMask (red: boolean, green: boolean, blue: boolean, alpha: boolean) {
    this.set4('colorMask', red, green, blue, alpha);
  }

  /**
   * 设置源和目标混合因子
   * @param red
   * @param green
   * @param blue
   * @param alpha
   * example:
   * gl.blendColor(0, 0.5, 1, 1);
   */
  override blendColor (red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf) {
    this.set4('blendColor', red, green, blue, alpha);
  }

  /**
   * 用于混合像素算法
   * @param sfactor
   * @param dfactor
   * example:
   * gl.enable(gl.BLEND);
   * gl.blendFunc(gl.SRC_COLOR, gl.DST_COLOR);
   */
  blendFunc (sfactor: GLenum, dfactor: GLenum) {
    this.blendFuncSeparate(sfactor, dfactor, sfactor, dfactor);
  }

  /**
   * 分别设置应用在 RGB 和 Alpha 上的 factor
   * @param srcRGB
   * @param dstRGB
   * @param srcAlpha
   * @param dstAlpha
   * example:
   * gl.enable(gl.BLEND);
   * gl.blendFuncSeparate(gl.SRC_COLOR, gl.DST_COLOR, gl.ONE, gl.ZERO);
   */
  override blendFuncSeparate (srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum) {
    this.set4('blendFuncSeparate', srcRGB, dstRGB, srcAlpha, dstAlpha);
  }

  /**
   * 设置混合模式
   * @param mode
   * example:
   * gl.blendEquation(gl.FUNC_ADD);
   * gl.blendEquation(gl.FUNC_SUBTRACT);
   * gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
   */
  blendEquation (mode: GLenum) {
    this.set1('blendEquation', mode);
  }

  /**
   * 可以分别对 RGB 和 Alpha 做不同的操作处理
   * @param modeRGB
   * @param modeAlpha
   * example:
   * gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_SUBTRACT);
   */
  override blendEquationSeparate (modeRGB: GLenum, modeAlpha: GLenum) {
    this.set2('blendEquationSeparate', modeRGB, modeAlpha);
  }

  /*** color end ***/

  /**
   * 图像预处理
   * @param pname
   * @param param
   * example:
   * var tex = gl.createTexture();
   * gl.bindTexture(gl.TEXTURE_2D, tex);
   * gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
   */
  setPixelStorei (pname: GLenum, param: GLenum) {
    const currentParam = this.pixelStorei[pname];

    if (currentParam !== param) {
      this.pixelStorei[pname] = param;
      this.gl.pixelStorei(pname, param);
    }
  }

  /**
   * 用来设置视口，即指定从标准设备到窗口坐标的x、y仿射变换。
   * @param x
   * @param y
   * @param width
   * @param height
   * example:
   * gl.viewport(0, 0, width, height);
   */
  override setViewport (x: number, y: number, width: number, height: number) {
    this.set4('viewport', x, y, width, height);
  }

  /**
   * 激活指定的纹理单元
   * @param texture
   * example:
   * gl.activeTexture(gl.TEXTURE1);
   */
  activeTexture (texture: GLenum) {
    texture = Math.min(texture, this.maxTextureCount);
    if (this.activeTextureIndex !== texture) {
      this.activeTextureIndex = texture;
      this.gl.activeTexture(texture);
    }
  }

  /**
   * 绑定WebGLTexture
   * @param target
   * @param texture
   * @param force
   * example:
   * const texture = gl.createTexture();
   * gl.bindTexture(gl.TEXTURE_2D, texture)
   */
  // TODO: texture.bind 替换时对于这段逻辑的处理
  bindTexture (target: GLenum, texture: WebGLTexture | null, force?: boolean) {
    const unit = this.activeTextureIndex;
    let targetBindings = this.currentTextureBinding[unit];

    if (!targetBindings) {
      targetBindings = this.currentTextureBinding[unit] = {};
    }

    if (targetBindings[target] !== texture || force) {
      this.gl.bindTexture(target, texture);
      targetBindings[target] = texture;
    }
    this.textureUnitDict[unit] = texture;
  }

  private set1 (name: string, param: any) {
    const value = this.glCapabilityCache[name];

    if (value !== param) {
      this.glCapabilityCache[name] = param;
      // @ts-expect-error save to assign
      this.gl[name](param);
    }
  }

  private set2 (name: string, param0: number, param1: number) {
    let value = this.glCapabilityCache[name];

    if (!value) {
      value = this.glCapabilityCache[name] = { x: NaN, y: NaN };
    }

    if (value.x !== param0 || value.y !== param1) {
      // @ts-expect-error save to assign
      this.gl[name](value.x = param0, value.y = param1);
    }
  }

  private set3 (name: string, param0: any, param1: any, param2: any) {
    let value = this.glCapabilityCache[name];

    if (!value) {
      value = this.glCapabilityCache[name] = { x: NaN, y: NaN, z: NaN };
    }

    if (value.x !== param0 || value.y !== param1 || value.z !== param2) {
      // @ts-expect-error safe to assign
      this.gl[name](value.x = param0, value.y = param1, value.z = param2);
    }
  }

  private set4 (name: string, param0: any, param1: any, param2: any, param3: any) {
    let value = this.glCapabilityCache[name];

    if (!value) {
      value = this.glCapabilityCache[name] = {
        x: NaN, y: NaN, z: NaN, w: NaN,
      };
    }

    if (value.x !== param0 || value.y !== param1 || value.z !== param2 || value.w !== param3) {
      // @ts-expect-error safe to assign
      this.gl[name](value.x = param0, value.y = param1, value.z = param2, value.w = param3);
    }
  }

  // TODO 命名
  get (name: string): any {
    return this.glCapabilityCache[name];
  }

  setFloat (uniform: Nullable<WebGLUniformLocation>, value: number) {
    if (!uniform) { return; }
    this.gl.uniform1f(uniform, value);
  }

  setInt (uniform: Nullable<WebGLUniformLocation>, value: number) {
    if (!uniform) { return; }
    this.gl.uniform1i(uniform, value);
  }

  setFloats (uniform: Nullable<WebGLUniformLocation>, value: number[]) {
    if (!uniform) { return; }
    this.gl.uniform1fv(uniform, value);
  }

  setVector2 (uniform: Nullable<WebGLUniformLocation>, value: Vector2) {
    this.setFloat2(uniform, value.x, value.y);
  }

  setVector3 (uniform: Nullable<WebGLUniformLocation>, value: Vector3) {
    this.setFloat3(uniform, value.x, value.y, value.z);
  }

  setVector4 (uniform: Nullable<WebGLUniformLocation>, value: Vector4) {
    this.setFloat4(uniform, value.x, value.y, value.z, value.w);
  }

  setColor (uniform: Nullable<WebGLUniformLocation>, value: Color) {
    this.setFloat4(uniform, value.r, value.g, value.b, value.a);
  }

  setQuaternion (uniform: Nullable<WebGLUniformLocation>, value: Quaternion) {
    this.setFloat4(uniform, value.x, value.y, value.z, value.w);
  }

  setVector4Array (uniform: Nullable<WebGLUniformLocation>, array: number[]) {
    if (!uniform || array.length % 4 !== 0) { return; }
    this.gl.uniform4fv(uniform, array);
  }

  setMatrix (uniform: Nullable<WebGLUniformLocation>, value: Matrix4) {
    if (!uniform) { return; }
    this.gl.uniformMatrix4fv(uniform, false, value.elements);
  }

  setMatrix3 (uniform: Nullable<WebGLUniformLocation>, value: Matrix3) {
    if (!uniform) { return; }
    this.gl.uniformMatrix3fv(uniform, false, value.elements);
  }

  setMatrixArray (uniform: Nullable<WebGLUniformLocation>, array: number[]) {
    if (!uniform || array.length % 16 !== 0) { return; }
    this.gl.uniformMatrix4fv(uniform, false, array);
  }

  setTexture (uniform: Nullable<WebGLUniformLocation>, channel: number, texture: Texture) {
    if (!uniform) { return; }
    // 必须走 this.activeTexture / this.bindTexture 包装，以保持 activeTextureIndex / currentTextureBinding 缓存一致。
    // 否则后续 engine.bindTexture(sameTex) 会因缓存判定相同而跳过实际绑定，导致 texImage2D 写到错误纹理
    const glTex = texture as GLTexture;

    this.activeTexture(this.gl.TEXTURE0 + channel);
    this.bindTexture(glTex.target, glTex.textureBuffer);
    this.gl.uniform1i(uniform, channel);
  }

  /**
   * 查询所有 uniform 的 location。
   * @param program - 查询的 shader program
   * @param uniformsNames - 查询的 uniform 名称列表
   * @returns
   */
  getUniforms (program: WebGLProgram, uniformsNames: string[]): Nullable<WebGLUniformLocation>[] {
    const results: Nullable<WebGLUniformLocation>[] = [];

    for (let index = 0; index < uniformsNames.length; index++) {
      results.push(this.gl.getUniformLocation(program, uniformsNames[index]));
    }

    return results;
  }

  private setFloat4 (uniform: Nullable<WebGLUniformLocation>, x: number, y: number, z: number, w: number) {
    if (!uniform) {
      return;
    }
    this.gl.uniform4f(uniform, x, y, z, w);
  }

  private setFloat3 (uniform: Nullable<WebGLUniformLocation>, x: number, y: number, z: number) {
    if (!uniform) {
      return;
    }
    this.gl.uniform3f(uniform, x, y, z);
  }

  private setFloat2 (uniform: Nullable<WebGLUniformLocation>, x: number, y: number) {
    if (!uniform) {
      return;
    }
    this.gl.uniform2f(uniform, x, y);
  }
}
