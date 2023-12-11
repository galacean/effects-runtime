import type { Matrix3, Matrix4, Quaternion, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core/index';
import type { GlobalUniforms, Renderer, ShaderWithSource } from '../render';
import type { Texture } from '../texture';
import type { DestroyOptions, Disposable } from '../utils';
import type { UniformSemantic, UniformValue } from './types';
import type { Engine } from '../engine';

/**
 * 材质销毁设置
 */
export interface MaterialDestroyOptions {
  /**
   * 纹理的销毁设置
   */
  textures?: DestroyOptions,
}

/**
 * 材质渲染类型
 */
export enum MaterialRenderType {
  normal = 0,
  transformFeedback = 1
}

export type UndefinedAble<U> = U | undefined;

/**
 * 材质属性
 */
export interface MaterialProps {
  /**
   * shader 文本和属性
   */
  shader: ShaderWithSource,
  /**
   * 材质的名称，未传入会自动设置为 `Material[seed]`
   */
  name?: string,
  /**
   * 传递的变换矩阵
   */
  uniformSemantics?: Record<string, UniformSemantic>,
  /**
   * 渲染类型
   */
  renderType?: MaterialRenderType,
  /**
   * uniform 数据
   */
  uniformValues?: Record<string, UniformValue>,
  // FIXME 没有用
  transformFeedbackOutput?: {
    mode: WebGL2RenderingContext['INTERLEAVED_ATTRIBS'] | WebGL2RenderingContext['SEPARATE_ATTRIBS'],
    varyings: string[],
  },
}

/**
 * 用于设置材质默认名称的自增序号
 * @internal
 */
let seed = 1;

/**
 * Material 抽象类
 */
export abstract class Material implements Disposable {
  shaderSource: ShaderWithSource;
  readonly uniformSemantics: Record<string, UniformSemantic>;
  readonly renderType: MaterialRenderType;
  readonly name: string;
  protected destroyed = false;
  protected initialized = false;

  /**
   *
   * @param props - 材质属性
   */
  constructor (
    public readonly props: MaterialProps,
  ) {
    const {
      name = 'Material' + seed++,
      renderType = MaterialRenderType.normal,
      shader,
      uniformSemantics,
    } = props;

    this.name = name;
    this.renderType = renderType;
    this.shaderSource = shader;
    this.uniformSemantics = { ...uniformSemantics };
  }

  /******** effects-core 中会调用 引擎必须实现 ***********************/
  /**
   * 设置 Material 的颜色融合开关
   * @param blending - 是否开启混合效果
   */
  set blending (blending: UndefinedAble<boolean>) { }

  /**
   * 分别指定 Material 的颜色混合函数乘数
   * @param func - 混合函数参数
   */
  set blendFunction (func: UndefinedAble<[blendSrc: number, blendDst: number, blendSrcAlpha: number, blendDstAlpha: number]>) { }

  /**
   * 分别指定 Material 的颜色混合方式
   * @param equation - 混合方程参数
   */
  set blendEquation (equation: UndefinedAble<[rgb: number, alpha: number]>) { }

  /**
   * 设置 Material 的深度测试开关
   * @param value - 是否开启深度测试
   */
  set depthTest (value: UndefinedAble<boolean>) { }

  /**
   * 设置 Material 的写入深度缓冲开关
   * @param value - 是否开启深度写入
   */
  set depthMask (value: UndefinedAble<boolean>) { }

  /**
   * 设置 Material 的模板测试开关
   * @param value - 是否开启模板测试
   */
  set stencilTest (value: UndefinedAble<boolean>) { }

  /**
   * 分别指定 Material 的模板测试参考值
   * @param value  - 模板测试参考值参数
   */
  set stencilRef (value: UndefinedAble<[front: number, back: number]>) { }

  /**
   * 分别指定 Material 的模板测试函数
   * @param value - 模板测试函数参数
   */
  set stencilFunc (value: UndefinedAble<[front: number, back: number]>) { }

  /**
   * 分别指定 Material 的模板测试和深度测试都通过时使用的函数
   * @param value - 模板测试深度测试通过时的操作参数
   */
  set stencilOpZPass (value: UndefinedAble<[front: number, back: number]>) { }

  /**
   * 设置 Material 的正反面剔除开关
   * @param value - 是否开启剔除
   */
  set culling (value: UndefinedAble<boolean>) { }

  /**
   * 设置 Material 的正反面计算方向
   * @param value
   */
  set frontFace (value: UndefinedAble<number>) { }

  /**
   * 设置 Material 要剔除的面
   * @param value - 剔除面参数
   */
  set cullFace (value: UndefinedAble<number>) { }
  /***************************************************/

  /******** effects-core 中暂无调用 引擎可以先不实现 ***********************/
  /**
   * 设置 Material 的源和目标混合因子
   * @param color
   */
  set blendColor (color: UndefinedAble<[r: number, g: number, b: number, a: number]>) { }

  /**
   * 设置 Material 的深度映射范围
   * @param value
   */
  set depthRange (value: UndefinedAble<[zNear: number, zFar: number]>) { }

  /**
   * 设置 Material 的深度比较函数
   * @param value - 深度测试函数参数
   */
  set depthFunc (value: UndefinedAble<number>) { }

  /**
   * 设置 Material 的多边形偏移（实现类似深度偏移的效果）
   * @param value - 多边形偏移参数
   */
  set polygonOffsetFill (value: UndefinedAble<boolean>) { }

  /**
   * 指定 Material 计算深度值的比例因子 factor 和单位 units
   * @param value
   */
  set polygonOffset (value: UndefinedAble<[factor: number, units: number]>) { }

  /**
   * 设置 Material 的通过 alpha 值决定临时覆盖值计算的开关
   * @param value - 是否开启 alpha 抖动
   */
  set sampleAlphaToCoverage (value: UndefinedAble<boolean>) { }

  /**
   * 设置 Material 颜色缓冲区的写入开关
   * @param value
   */
  set colorMask (value: UndefinedAble<[r: boolean, g: boolean, b: boolean, a: boolean]>) { }

  /**
   * 分别指定 Material 的模板测试掩码
   * @param value - 模板测试写入掩码参数
   */
  set stencilMask (value: UndefinedAble<[front: number, back: number]>) { }

  /**
   * 分别指定 Material 模板测试失败时要使用的函数
   * @param value - 模板测试失败时的操作参数
   */
  set stencilOpFail (value: UndefinedAble<[front: number, back: number]>) { }

  /**
   * 分别指定 Material 模板测试通过但深度测试失败时要使用的函数
   * @param value - 模板测试深度测试失败时的操作参数
   */
  set stencilOpZFail (value: UndefinedAble<[front: number, back: number]>) { }
  /***************************************************/

  /**
   * 获取 Material 的 float 类型的 uniform 数据
   * @param name
   */
  abstract getFloat (name: string): number | null;
  /**
   * 设置 float 类型的 uniform 数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setFloat (name: string, value: number): void;

  /**
   * 获取 Material 的 float 类型的 uniform 数据
   * @param name
   */
  abstract getInt (name: string): number | null;
  /**
   * 设置 int 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setInt (name: string, value: number): void;

  /**
   * 获取 Material 的 float 数组类型的 uniform 数据
   * @param name
   */
  abstract getFloats (name: string): number[] | null;
  /**
   * 设置 float 数组类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setFloats (name: string, value: number[]): void;

  /**
   * 获取 Material 的 vec2 类型的 uniform 数据
   * @param name
   */
  abstract getVector2 (name: string): Vector2 | null;
  /**
   * 设置 vec2 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setVector2 (name: string, value: Vector2): void;

  /**
   * 获取 Material 的 vec3 类型的 uniform 数据
   * @param name
   */
  abstract getVector3 (name: string): Vector3 | null;
  /**
   * 设置 vec3 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setVector3 (name: string, value: Vector3): void;

  /**
   * 获取 Material 的 vec4 类型的 uniform 数据
   * @param name
   */
  abstract getVector4 (name: string): Vector4 | null;
  /**
   * 设置 vec4 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setVector4 (name: string, value: Vector4): void;

  /**
   * 获取 Material 的 Quaternion 类型的 uniform 数据
   * @param name
   */
  abstract getQuaternion (name: string): Quaternion | null;
  /**
   * 设置 Quaternion 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setQuaternion (name: string, value: Quaternion): void;

  /**
   * 获取 Material 的 vec4 数组类型的 uniform 数据
   * @param name
   */
  abstract getVector4Array (name: string): number[];
  /**
   * 设置 vec4 数组类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setVector4Array (name: string, value: Vector4[]): void;

  /**
   * 获取 Material 的 mat4 类型的 uniform 数据
   * @param name
   */
  abstract getMatrix (name: string): Matrix4 | null;
  /**
   * 设置 mat4 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setMatrix (name: string, value: Matrix4): void;
  /**
   * 设置 mat3 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param value - 要设置的 uniform 数据
   */
  abstract setMatrix3 (name: string, value: Matrix3): void;

  /**
   * 获取 Material 的 mat4 数组类型的 uniform 数据
   * @param name
   */
  abstract getMatrixArray (name: string): number[] | null;
  /**
   * 设置 mat 数组类型的 uniform 的数据
   * @param name - uniform 名称
   * @param array - 要设置的 uniform 数据
   */
  abstract setMatrixArray (name: string, array: Matrix4[]): void;
  /**
   * 设置 mat 数组类型的 uniform 的数据，传入 number 数组
   * @param name - uniform 名称
   * @param array - 要设置的 uniform 数据，number 类型数组
   */
  abstract setMatrixNumberArray (name: string, array: number[]): void;

  /**
   * 获取 Material 的 sampler2D 类型的 uniform 数据
   * @param name
   */
  abstract getTexture (name: string): Texture | null;
  /**
   * 设置 sampler2D 类型的 uniform 的数据
   * @param name - uniform 名称
   * @param texture - 要设置的 uniform 数据
   */
  abstract setTexture (name: string, texture: Texture): void;

  /**
   * 获取 Material 的 float 类型的 uniform 数据
   * @param name
   */
  abstract hasUniform (name: string): boolean;

  /******** 预留接口，暂时不用实现 ***********************/
  abstract enableKeyword (keyword: string): void;
  abstract disableKeyword (keyword: string): void;
  abstract isKeywordEnabled (keyword: string): boolean;
  /***************************************************/

  /**
   * Material 的克隆方法（不接入滤镜，本方法可以不做实现）
   * @param props 新的材质属性
   */
  abstract clone (props?: MaterialProps): Material;

  abstract cloneUniforms (sourceMaterial: Material): void;

  // TODO 待废弃 无需实现 等model/spine插件的material状态设置改造后即移除
  // abstract createMaterialStates (states: MaterialStates): Immutable<MaterialStates> | void;

  /**
   * 销毁当前 Material
   * @param destroy - 包含纹理的销毁选项
   */
  abstract dispose (destroy?: MaterialDestroyOptions): void;

  /**
   * 创建 Material
   */
  static create: (engine: Engine, props: MaterialProps) => Material;

  /**
   * 初始化 GPU 资源
   * @override
   */
  initialize (): void {
    // OVERRIDE
  }

  use (render: Renderer, globalUniforms: GlobalUniforms) {
    // OVERRIDE
  }
}
