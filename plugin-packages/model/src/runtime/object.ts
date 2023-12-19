import type { spec, Renderer } from '@galacean/effects';
import type { BaseTransform } from '../index';
import type { Quaternion, Euler, Vector3, Matrix4 } from './math';
import { PObjectType, PTransform, PCoordinate } from './common';
import type { PSceneManager } from './scene';

let objectIndex = 1;

export abstract class PObject {
  name = 'Unnamed Object';
  type: PObjectType = PObjectType.none;

  // create () {
  //   // create everything in this object
  // }

  dispose () {
    // delete everything in this object
  }

  isNone () {
    return this.type === PObjectType.none;
  }

  isValid (): boolean {
    return this.type !== PObjectType.none;
  }

  protected genName (name: string): string {
    return `${name}_@${objectIndex++}`;
  }
}

export abstract class PEntity extends PObject {
  private _visible = false;
  private _transform = new PTransform();
  //
  deleted = false;

  update () {

  }

  render (scene: PSceneManager, renderer: Renderer) {
    // OVERRIDE
  }

  onVisibleChanged (visible: boolean) {
    this.visible = visible;
  }

  /**
   * 仅标记不可见和删除状态，但不进行 WebGL 相关资源的释放
   * 最终释放 WebGL 相关资源是在 plugin destroy 的时候
   */
  override dispose () {
    super.dispose();
    this.visible = false;
    this.deleted = true;
  }

  get visible (): boolean {
    return this._visible && this.isValid();
  }

  set visible (val: boolean) {
    this._visible = val;
  }

  get transform (): PTransform {
    return this._transform;
  }

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

  get translation (): Vector3 {
    return this._transform.getTranslation();
  }

  set translation (val: Vector3 | spec.vec3) {
    this._transform.setTranslation(val);
  }

  get position (): Vector3 {
    return this._transform.getTranslation();
  }

  set position (val: Vector3 | spec.vec3) {
    this._transform.setTranslation(val);
  }

  get rotation (): Quaternion {
    return this._transform.getRotation();
  }

  set rotation (val: Quaternion | Euler | Vector3 | spec.vec4 | spec.vec3) {
    this._transform.setRotation(val);
  }

  get scale (): Vector3 {
    return this._transform.getScale();
  }

  set scale (val: Vector3 | spec.vec3) {
    this._transform.setScale(val);
  }

  get matrix (): Matrix4 {
    return this._transform.getMatrix();
  }

  set matrix (val: Matrix4) {
    this._transform.setMatrix(val);
  }

  get coordinate () {
    const coord = new PCoordinate();

    coord.fromPTransform(this._transform);

    return coord;
  }

}

