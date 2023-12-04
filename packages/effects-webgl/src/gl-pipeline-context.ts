import type { Disposable, Texture, math } from '@galacean/effects-core';
import { glContext } from '@galacean/effects-core';
import { GLShaderLibrary } from './gl-shader-library';
import type { GLTexture } from './gl-texture';
import type { GLEngine } from './gl-engine';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;
type Vector4 = math.Vector4;
type Matrix3 = math.Matrix3;
type Matrix4 = math.Matrix4;
type Quaternion = math.Quaternion;

export type Nullable<T> = T | null;

export class GLPipelineContext implements Disposable {
  textureUnitDict: Record<string, WebGLTexture | null>;

  public shaderLibrary: GLShaderLibrary;
  private readonly maxTextureCount: number;
  private glCapabilityCache: Record<string, any>;
  private currentFramebuffer: Record<number, WebGLFramebuffer | null>;
  private currentTextureBinding: WebGLTexture | null;
  private currentRenderBuffer: Record<number, WebGLRenderbuffer | null>;
  private activeTextureIndex: number;
  private pixelStorei: Record<string, GLenum>;

  constructor (
    public engine: GLEngine,
    public gl: WebGLRenderingContext | WebGL2RenderingContext
  ) {
    this.gl = gl;
    this.shaderLibrary = new GLShaderLibrary(engine, this);
    this.maxTextureCount = this.gl.TEXTURE0 + this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1;
    this.reset();
  }

  dispose () {
    this.shaderLibrary.dispose();
    this.reset();
  }

  private reset () {
    this.glCapabilityCache = {};
    this.activeTextureIndex = glContext.TEXTURE0;
    this.textureUnitDict = {};
    this.currentFramebuffer = {};
    this.pixelStorei = {};
    this.currentRenderBuffer = {};
  }

  toggle (capability: GLenum, enable?: boolean) {
    if (enable) {
      this.enable(capability);
    } else {
      this.disable(capability);
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

  bindRenderBuffer (target: GLenum, renderBuffer: WebGLRenderbuffer | null) {
    if (this.currentRenderBuffer[target] !== renderBuffer) {
      this.currentRenderBuffer[target] = renderBuffer;
      this.gl.bindRenderbuffer(target, renderBuffer);
    }
  }

  /**
   * 绑定系统 framebuffer
   */
  bindSystemFramebuffer () {
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

  /**
   * 使用预设值来清空缓冲
   * @param mask
   * example:
   * gl.clear(gl.DEPTH_BUFFER_BIT);
   * gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
   */
  clear (mask: number) {
    this.gl.clear(mask);
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
  public depthFunc (func: GLenum) {
    this.set1('depthFunc', func);
  }

  /**
   * 设置是否启用写入深度缓冲。
   * @param flag
   * example:
   * gl.depthMask(false);
   */
  depthMask (flag: boolean) {
    this.set1('depthMask', flag);
  }

  polygonOffset (factor: number, unit: number) {
    this.set2('polygonOffset', factor, unit);
  }

  /**
   * 将 z 值从规范化设备坐标映射到窗口坐标
   * @param zNear
   * @param zFar
   * example:
   * gl.depthRange(0.2, 0.6);
   */
  depthRange (zNear: number, zFar: number) {
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
  stencilFuncSeparate (face: GLenum, func: GLenum, ref: GLint, mask: GLuint) {
    this.set4('stencilFuncSeparate', face, func, ref, mask);
  }

  /**
   * 单面的mask写入
   * @param face
   * @param mask
   * example:
   * gl.stencilMaskSeparate(gl.FRONT, 110101);
   */
  stencilMaskSeparate (face: GLenum, mask: GLuint) {
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
  stencilOpSeparate (face: GLenum, fail: GLenum, zfail: GLenum, zpass: GLenum) {
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
  cullFace (mode: GLenum) {
    this.set1('cullFace', mode);
  }

  /**
   * 设置卷绕方向
   * @param mode
   * example:
   * gl.frontFace(gl.CW);
   */
  frontFace (mode: GLenum) {
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
  colorMask (red: boolean, green: boolean, blue: boolean, alpha: boolean) {
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
  blendColor (red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf) {
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
  blendFuncSeparate (srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum) {
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
  public blendEquation (mode: GLenum) {
    this.set1('blendEquation', mode);
  }

  /**
   * 可以分别对 RGB 和 Alpha 做不同的操作处理
   * @param modeRGB
   * @param modeAlpha
   * example:
   * gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_SUBTRACT);
   */
  blendEquationSeparate (modeRGB: GLenum, modeAlpha: GLenum) {
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
  viewport (x: number, y: number, width: number, height: number) {
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
    if (this.currentTextureBinding !== texture || force) {
      this.gl.bindTexture(target, texture);
      this.currentTextureBinding = texture;
    }
    this.textureUnitDict[this.activeTextureIndex] = texture;
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

  public setFloat (uniform: Nullable<WebGLUniformLocation>, value: number) {
    if (!uniform) { return; }
    this.gl.uniform1f(uniform, value);
  }

  public setInt (uniform: Nullable<WebGLUniformLocation>, value: number) {
    if (!uniform) { return; }
    this.gl.uniform1i(uniform, value);
  }

  public setFloats (uniform: Nullable<WebGLUniformLocation>, value: number[]) {
    if (!uniform) { return; }
    this.gl.uniform1fv(uniform, value);
  }

  public setVector2 (uniform: Nullable<WebGLUniformLocation>, value: Vector2) {
    this.setFloat2(uniform, value.x, value.y);
  }

  public setVector3 (uniform: Nullable<WebGLUniformLocation>, value: Vector3) {
    this.setFloat3(uniform, value.x, value.y, value.z);
  }

  public setVector4 (uniform: Nullable<WebGLUniformLocation>, value: Vector4) {
    this.setFloat4(uniform, value.x, value.y, value.z, value.w);
  }

  public setQuaternion (uniform: Nullable<WebGLUniformLocation>, value: Quaternion) {
    this.setFloat4(uniform, value.x, value.y, value.z, value.w);
  }

  public setVector4Array (uniform: Nullable<WebGLUniformLocation>, array: number[]) {
    if (!uniform || array.length % 4 !== 0) { return; }
    this.gl.uniform4fv(uniform, array);
  }

  public setMatrix (uniform: Nullable<WebGLUniformLocation>, value: Matrix4) {
    if (!uniform) { return; }
    this.gl.uniformMatrix4fv(uniform, false, value.elements);
  }

  public setMatrix3 (uniform: Nullable<WebGLUniformLocation>, value: Matrix3) {
    if (!uniform) { return; }
    this.gl.uniformMatrix3fv(uniform, false, value.elements);
  }

  public setMatrixArray (uniform: Nullable<WebGLUniformLocation>, array: number[]) {
    if (!uniform || array.length % 16 !== 0) { return; }
    this.gl.uniformMatrix4fv(uniform, false, array);
  }

  public setTexture (uniform: Nullable<WebGLUniformLocation>, channel: number, texture: Texture) {
    if (!uniform) { return; }
    this.gl.activeTexture(this.gl.TEXTURE0 + channel);
    const target = (texture as GLTexture).target;

    this.gl.bindTexture(target, (texture as GLTexture).textureBuffer);
    this.gl.uniform1i(uniform, channel);
  }

  /**
   * 查询所有uniform的location。
   * @param program 查询的shader program
   * @param uniformsNames 查询的uniform名称列表
   * @returns
   */
  public getUniforms (program: WebGLProgram, uniformsNames: string[]): Nullable<WebGLUniformLocation>[] {
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
