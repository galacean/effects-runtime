import type { spec, Mesh, math } from '@galacean/effects';
import type { ModelVFXItem } from '../plugin/model-vfx-item';
import type { BaseTransform } from '../index';
import type { Quaternion, Euler, Vector3, Matrix4 } from './math';
import { PObjectType, PTransform, PCoordinate } from './common';
import type { PSceneStates } from './scene';

type Euler = math.Euler;

let objectIndex = 1;

/**
 * 抽象对象类，提供公共的成员变量和成员函数
 */
export abstract class PObject {
  /**
   * 名称
   */
  name = 'Unnamed Object';
  /**
   * 类型
   */
  type: PObjectType = PObjectType.none;

  // create () {
  //   // create everything in this object
  // }

  /**
   * 销毁
   */
  dispose () {
    // delete everything in this object
  }

  /**
   * 是否空对象
   * @returns
   */
  isNone () {
    return this.type === PObjectType.none;
  }

  /**
   * 是否有效，也就是类型不是 PObjectType.none
   * @returns
   */
  isValid (): boolean {
    return this.type !== PObjectType.none;
  }

  protected genName (name: string): string {
    return `${name}_@${objectIndex++}`;
  }
}

/**
 * 抽象实体类，支持可见性、变换和所属 VFX 元素
 */
export abstract class PEntity extends PObject {
  private _visible = false;
  private _transform = new PTransform();
  /**
   * 是否删除
   */
  deleted = false;
  /**
   * 所属 VFX 元素
   */
  ownerItem?: ModelVFXItem;

  /**
   * 逻辑更新
   * @param deltaSeconds - 更新间隔
   */
  tick (deltaSeconds: number) {
    // OVERRIDE
  }

  /**
   * 外部改变可见性时的回调
   * @param visible - 可见性
   */
  onVisibleChanged (visible: boolean) {
    this.visible = visible;
  }

  /**
   * 将内部需要渲染的对象，添加的到渲染对象集合中
   * @param renderObjectSet - 渲染对象集合
   */
  addToRenderObjectSet (renderObjectSet: Set<Mesh>) {
    // OVERRIDE
  }

  /**
   * 更新着色器 Uniform 数据，根据当前场景状态
   * @param sceneStates - 当前场景状态
   */
  updateUniformsForScene (sceneStates: PSceneStates) {
    // OVERRIDE
  }

  /**
   * 仅标记不可见和删除状态，但不进行 WebGL 相关资源的释放
   * 最终释放 WebGL 相关资源是在 plugin destroy 的时候
   */
  onEntityRemoved () {
    this.visible = false;
    this.deleted = true;
  }

  /**
   * 获取可见性，如果实体非法也是不可见
   */
  get visible (): boolean {
    return this._visible && this.isValid();
  }

  /**
   * 设置可见性
   */
  set visible (val: boolean) {
    this._visible = val;
  }

  /**
   * 获取变换
   */
  get transform (): PTransform {
    return this._transform;
  }

  /**
   * 设置变换，可以传入插件变换对象或变换参数
   */
  set transform (val: PTransform | BaseTransform) {
    if (val instanceof PTransform) {
      this._transform = val;
    } else {
      if (val.position !== undefined) {
        this._transform.setTranslation(val.position);
      }
      if (val.rotation !== undefined) {
        this._transform.setRotation(val.rotation);
      }
      if (val.scale !== undefined) {
        this._transform.setScale(val.scale);
      }
    }
  }

  /**
   * 获取位移
   */
  get translation (): Vector3 {
    return this._transform.getTranslation();
  }

  /**
   * 设置位移
   */
  set translation (val: Vector3 | spec.vec3) {
    this._transform.setTranslation(val);
  }

  /**
   * 获取位置
   */
  get position (): Vector3 {
    return this._transform.getTranslation();
  }

  /**
   * 设置位置
   */
  set position (val: Vector3 | spec.vec3) {
    this._transform.setTranslation(val);
  }

  /**
   * 获取旋转
   */
  get rotation (): Quaternion {
    return this._transform.getRotation();
  }

  /**
   * 设置旋转
   */
  set rotation (val: Quaternion | Euler | Vector3 | spec.vec4 | spec.vec3) {
    this._transform.setRotation(val);
  }

  /**
   * 获取缩放
   */
  get scale (): Vector3 {
    return this._transform.getScale();
  }

  /**
   * 设置缩放
   */
  set scale (val: Vector3 | spec.vec3) {
    this._transform.setScale(val);
  }

  /**
   * 获取矩阵
   */
  get matrix (): Matrix4 {
    return this._transform.getMatrix();
  }

  /**
   * 设置矩阵
   */
  set matrix (val: Matrix4) {
    this._transform.setMatrix(val);
  }

  /**
   * 获取坐标系
   */
  get coordinate () {
    const coord = new PCoordinate();

    coord.fromPTransform(this._transform);

    return coord;
  }

}

