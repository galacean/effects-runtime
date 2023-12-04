import type * as spec from '@galacean/effects-specification';
import { Vector3, Matrix4, Quaternion, Euler } from '@galacean/effects-math/es/core/index';
import type { Disposable } from './utils';
import { addItem, removeItem } from './utils';

export interface TransformProps {
  position?: spec.vec3 | Vector3,
  rotation?: spec.vec3 | Euler,
  quat?: spec.vec4 | Quaternion,
  scale?: spec.vec3 | Vector3,
  name?: string,
  anchor?: spec.vec2 | spec.vec3 | Vector3,
  valid?: boolean,
}

const tempQuat = new Quaternion();
let seed = 1;

export class Transform implements Disposable {
  /**
   * 转换右手坐标系左手螺旋对应的四元数到对应的旋转角
   * @param quat - 四元数
   * @param out - 欧拉角
   * @returns
   */
  static getRotation (quat: Quaternion, out: Euler): Euler {
    const newQuat = tempQuat.copyFrom(quat);

    newQuat.conjugate();

    return out.setFromQuaternion(newQuat);
  }

  public name: string;
  /**
   * 自身位移
   */
  public readonly position = new Vector3(0, 0, 0);
  /**
   * 自身旋转对应的四元数，右手坐标系，旋转正方向左手螺旋（轴向的顺时针），旋转欧拉角的顺序为 ZYX
   */
  public readonly quat = new Quaternion(0, 0, 0, 1);
  /**
   * 自身旋转角度
   */
  public readonly rotation = new Euler(0, 0, 0);
  /**
   * 自身缩放
   */
  public readonly scale = new Vector3(1, 1, 1);
  /**
   * 自身锚点
   */
  public readonly anchor = new Vector3(0, 0, 0);
  /**
   * 子变换，可以有多个
   */
  private children: Transform[] = [];
  /**
   * 父变换，只能有一个
   */
  private parent: Transform | null;
  /**
   * 所有父变换对应的联合矩阵
   */
  private parentMatrix: Matrix4;
  /**
   * 包含父变换的最终模型矩阵
   */
  private worldMatrix = Matrix4.fromIdentity();
  /**
   * 仅包含自身变换的模型矩阵
   */
  private localMatrix = Matrix4.fromIdentity();
  /**
   * 变换是否需要生效，不生效返回的模型矩阵为单位矩阵，需要随元素生命周期改变
   */
  private valid = false;
  /**
   * 数据变化标志位
   */
  private dirtyFlags = {
    /* 自身变换是否有修改，若修改，localMatrix 需要更新 */
    localData: false,
    /* localMatrix 是否有修改，若修改，WorldMatrix 需要更新 */
    localMatrix: false,
    /* worldMatrix 是否有修改，若修改，worldTRS 需要更新 */
    worldMatrix: false,
    /* parentMatrix 是否有修改，若修改，WorldMatrix需要更新 */
    parentMatrix: false,
  };
  /**
   * 最终模型矩阵对应变换的缓存，当自身矩阵或父矩阵有修改时需要更新
   */
  private readonly worldTRSCache = { position: new Vector3(0, 0, 0), quat: new Quaternion(0, 0, 0, 1), scale: new Vector3(1, 1, 1) };

  constructor (props: TransformProps = {}, parent?: Transform) {
    this.name = `transform_${seed++}`;
    if (props) {
      this.setTransform(props);
    }
    if (parent) {
      this.parentTransform = parent;
    }
    if (props.valid !== undefined) {
      this.setValid(props.valid);
    }
  }

  set parentTransform (transform: Transform | null) {
    if (!transform || this.parent === transform || this === transform) {
      return;
    }
    if (this.parent) {
      this.parent.removeChild(this);
    }
    transform.addChild(this);
    this.parent = transform;
    this.parentMatrixDirty = true;
  }

  get parentTransform () {
    return this.parent;
  }

  set parentMatrixDirty (val: boolean) {
    if (this.dirtyFlags.parentMatrix !== val) {
      this.dirtyFlags.parentMatrix = val;
      this.dispatchValueChange();
    }
  }

  get parentMatrixDirty () {
    return this.dirtyFlags.parentMatrix;
  }

  // /**
  //  * 自身数据修改 /  父变换修改 / 父变换的数据修改
  //  * @returns
  //  */
  // get traceDirty (): boolean {
  //   if (this.dirty || this.parentDirty) {
  //     return true;
  //   }
  //
  //   return !!(this.parent && this.parent.traceDirty);
  // }

  /**
   * 设置位置
   * @param x
   * @param y
   * @param z
   */
  setPosition (x: number, y: number, z: number) {
    if (this.position.x !== x || this.position.y !== y || this.position.z !== z) {
      this.position.x = x;
      this.position.y = y;
      this.position.z = z;
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }

  /**
   * 在当前位置的基础上添加位置偏移
   * @param x
   * @param y
   * @param z
   */
  translate (x: number, y: number, z: number) {
    if (x !== 0 || y !== 0 || z !== 0) {
      this.position.x += x;
      this.position.y += y;
      this.position.z += z;
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }
  /**
   * 设置旋转
   * @param x
   * @param y
   * @param z
   */
  setRotation (x: number, y: number, z: number) {
    if (this.rotation.x !== x || this.rotation.y !== y || this.rotation.z !== z) {
      this.rotation.x = x;
      this.rotation.y = y;
      this.rotation.z = z;
      this.quat.setFromEuler(this.rotation);
      this.quat.conjugate();
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }

  /**
   * 设置四元数
   * @param x
   * @param y
   * @param z
   * @param w
   * @private
   */
  setQuaternion (x: number, y: number, z: number, w: number) {
    if (this.quat.x !== x || this.quat.y !== y || this.quat.z !== z || this.quat.w !== w) {
      this.quat.x = x;
      this.quat.y = y;
      this.quat.z = z;
      this.quat.w = w;
      this.rotation.setFromQuaternion(this.quat);
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }

  /**
   * 设置缩放
   * @param x
   * @param y
   * @param z
   */
  setScale (x: number, y: number, z: number) {
    if (this.scale.x !== x || this.scale.y !== y || this.scale.z !== z) {
      this.scale.x = x;
      this.scale.y = y;
      this.scale.z = z;
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }

  /**
   * 在当前旋转的基础上使用四元素添加旋转
   * @param quat
   */
  rotateByQuat (quat: Quaternion) {
    this.quat.multiply(quat);
    this.rotation.setFromQuaternion(this.quat);
    this.dirtyFlags.localData = true;
    this.dispatchValueChange();
  }

  /**
   * 在当前缩放基础上设置缩放系数
   * @param x
   * @param y
   * @param z
   */
  scaleBy (x: number, y: number, z: number) {
    this.scale.x *= x;
    this.scale.y *= y;
    this.scale.z *= z;
    this.dirtyFlags.localData = true;
    this.dispatchValueChange();
  }

  /**
   * 设置锚点
   * @param x
   * @param y
   * @param z
   */
  setAnchor (x: number, y: number, z: number) {
    if (this.anchor.x !== x || this.anchor.y !== y || this.anchor.z !== z) {
      this.anchor.x = x;
      this.anchor.y = y;
      this.anchor.z = z;
      this.dirtyFlags.localData = true;
      this.dispatchValueChange();
    }
  }

  /**
   * 批量设置 transform 属性
   * @param props - 要设置的属性
   * @param reverseEuler - 设置 rotation时，欧拉角是否需要取负值
   */
  setTransform (props: TransformProps, reverseEuler?: boolean) {
    const { position, rotation, scale, quat, name, anchor } = props;

    if (name) {
      this.name = name;
    }
    if (position) {
      if (position instanceof Vector3) {
        this.setPosition(position.x, position.y, position.z);
      } else {
        this.setPosition(position[0], position[1], position[2]);
      }
    }
    if (quat) {
      if (quat instanceof Quaternion) {
        this.setQuaternion(quat.x, quat.y, quat.z, quat.w);
      } else {
        this.setQuaternion(quat[0], quat[1], quat[2], quat[3]);
      }
    } else if (rotation) {
      const mul = reverseEuler ? -1 : 1;

      if (rotation instanceof Euler) {
        this.setRotation(rotation.x * mul, rotation.y * mul, rotation.z * mul);
      } else {
        this.setRotation(rotation[0] * mul, rotation[1] * mul, rotation[2] * mul);
      }
    }
    if (scale) {
      if (scale instanceof Vector3) {
        this.setScale(scale.x, scale.y, scale.z);
      } else {
        this.setScale(scale[0], scale[1], scale[2]);
      }
    }
    if (anchor) {
      if (anchor instanceof Vector3) {
        this.setAnchor(anchor.x, anchor.y, anchor.z);
      } else {
        this.setAnchor(anchor[0], anchor[1], anchor[2] ?? 0);
      }
    }

  }

  /**
   * 添加子变换
   * @param child - 要添加的子变换
   */
  addChild (child: Transform) {
    addItem(this.children, child);
  }

  /**
   * 移除子变换
   */
  removeChild (child: Transform) {
    removeItem(this.children, child);
  }

  /**
   * 获取当前的旋转量
   * @returns
   */
  getRotation (): Euler {
    return Transform.getRotation(this.quat, new Euler());
  }

  /**
   * 获取当前的四元数
   * @returns
   */
  getQuaternion (): Quaternion {
    return this.quat;
  }

  /**
   * 更新元素自身变换矩阵
   */
  updateLocalMatrix () {
    if (this.valid) {
      if (this.dirtyFlags.localData) {
        this.localMatrix.compose(this.position, this.quat, this.scale, this.anchor);
        this.dirtyFlags.localMatrix = true;
      }
      this.dirtyFlags.localData = false;
    } else {
      if (!this.localMatrix.isIdentity()) {
        this.localMatrix.identity();
        this.dirtyFlags.localMatrix = true;
      }
    }
  }

  /**
   * 获取自身变换对应的模型矩阵
   * 数据修改且需要生效时更新自身矩阵
   * 当变换不需要生效时返回单位矩阵
   * @returns
   */
  getMatrix (): Matrix4 {
    this.updateLocalMatrix();

    return this.localMatrix;
  }
  /**
   * 获取父矩阵，如果有多级父节点，返回整体变换
   * @returns
   */
  getParentMatrix (): Matrix4 | undefined {
    if (this.parent) {
      this.parentMatrix = this.parent.getWorldMatrix();
      this.dirtyFlags.parentMatrix = this.dirtyFlags.parentMatrix || this.parent.dirtyFlags.localMatrix || this.parent.dirtyFlags.worldMatrix;
    }

    return this.parentMatrix;
  }

  /**
   * 获取包含自身变换和父变换的模型变换矩阵
   * @returns
   */
  getWorldMatrix (): Matrix4 {
    const localMatrix = this.getMatrix();
    const parentMatrix = this.getParentMatrix();

    if (this.dirtyFlags.localMatrix || this.dirtyFlags.parentMatrix) {
      if (parentMatrix) {
        this.worldMatrix.multiplyMatrices(parentMatrix, localMatrix);
      } else {
        this.worldMatrix.copyFrom(localMatrix);
      }
      this.dirtyFlags.worldMatrix = true;
      this.dirtyFlags.localMatrix = false;
      this.dirtyFlags.parentMatrix = false;
    }

    return this.worldMatrix;
  }

  /**
   * 获取联合变换后的最终缩放因子
   * @returns
   */
  getWorldScale (): Vector3 {
    const cache = this.worldTRSCache;

    if (this.dirtyFlags.worldMatrix) {
      const mat = this.getWorldMatrix();

      mat.decompose(cache.position, cache.quat, cache.scale);
      this.dirtyFlags.worldMatrix = false;
    }

    return this.worldTRSCache.scale.clone();
  }

  /**
   * 获取联合变换后的最终位置
   * @returns
   */
  getWorldPosition (): Vector3 {
    this.updateTRSCache();

    return this.worldTRSCache.position.clone();
  }

  /**
   * 获取联合变换后的最终旋转量
   * @returns
   */
  getWorldRotation (): Euler {
    this.updateTRSCache();

    return Transform.getRotation(this.worldTRSCache.quat, new Euler());
  }

  /**
   * 根据世界变换矩阵计算位移、旋转、缩放向量
   * @param  position
   * @param  quat
   * @param  scale
   */
  assignWorldTRS (position?: Vector3, quat?: Quaternion, scale?: Vector3) {
    this.updateTRSCache();
    if (position) {
      position.copyFrom(this.worldTRSCache.position);
    }
    if (quat) {
      quat.copyFrom(this.worldTRSCache.quat);
    }
    if (scale) {
      scale.copyFrom(this.worldTRSCache.scale);
    }
  }

  /**
   * 拆解并复制指定矩阵到自身变换
   * @param m4
   * @param scale
   * @returns
   */
  cloneFromMatrix (m4: Matrix4, scale?: Vector3) {
    m4.decompose(this.position, this.quat, this.scale);
    if (scale) {
      scale.copyFrom(this.scale);
    }
    this.dirtyFlags.localData = true;
    this.dispatchValueChange();
  }

  /**
   * 设置 Transform 生效 / 失效， 默认元素生命周期开始后生效，结束后失效
   */
  setValid (val: boolean) {
    if (this.valid !== val) {
      this.valid = val;
      if (!val) {
        this.localMatrix.identity();
        this.dirtyFlags.localMatrix = true;
      } else {
        this.dirtyFlags.localData = true;
      }
      this.dispatchValueChange();
    }
  }

  /**
   * 获取 Transform 是否生效
   */
  getValid (): boolean {
    return this.valid;
  }

  dispose (): void { }

  private updateTRSCache () {
    const worldMatrix = this.getWorldMatrix();

    if (this.dirtyFlags.worldMatrix) {
      const cache = this.worldTRSCache;

      worldMatrix.decompose(cache.position, cache.quat, cache.scale);
      this.dirtyFlags.worldMatrix = false;
    }
  }

  private dispatchValueChange () {
    this.children.forEach(c => {
      c.parentMatrixDirty = true;
    });
  }
}
