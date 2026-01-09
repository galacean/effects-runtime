import { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

/**
 * 包围盒类，用于存储和操作物体的边界信息
 */
export class BoundingBox {
  /**
   * 临时向量，用于避免频繁创建对象
   */
  private static tempVector0 = new Vector3();
  private static tempVector1 = new Vector3();
  private static tempVector2 = new Vector3();

  /**
   * 局部空间的 8 个顶点
   */
  readonly vectors: Vector3[] = [];

  /**
   * 世界空间的 8 个顶点
   */
  readonly vectorsWorld: Vector3[] = [];

  /**
   * 局部空间的最小点
   */
  readonly minimum: Vector3;

  /**
   * 局部空间的最大点
   */
  readonly maximum: Vector3;

  /**
   * 世界空间的最小点
   */
  readonly minimumWorld: Vector3;

  /**
   * 世界空间的最大点
   */
  readonly maximumWorld: Vector3;

  /**
   * 局部空间的中心点
   */
  readonly center: Vector3;

  /**
   * 世界空间的中心点
   */
  readonly centerWorld: Vector3;

  /**
   * 局部空间的半尺寸（从中心到边界）
   */
  readonly extendSize: Vector3;

  /**
   * 世界空间的半尺寸
   */
  readonly extendSizeWorld: Vector3;

  /**
   * OBB 的方向向量
   */
  readonly directions: Vector3[] = [];

  private worldMatrix: Matrix4;

  /**
   * 创建包围盒
   * @param minimum - 局部空间最小点
   * @param maximum - 局部空间最大点
   * @param worldMatrix - 世界变换矩阵
   */
  constructor (minimum: Vector3, maximum: Vector3, worldMatrix?: Matrix4) {
    // 初始化向量数组
    for (let i = 0; i < 8; i++) {
      this.vectors.push(new Vector3());
      this.vectorsWorld.push(new Vector3());
    }

    for (let i = 0; i < 3; i++) {
      this.directions.push(new Vector3());
    }

    this.minimum = new Vector3();
    this.maximum = new Vector3();
    this.minimumWorld = new Vector3();
    this.maximumWorld = new Vector3();
    this.center = new Vector3();
    this.centerWorld = new Vector3();
    this.extendSize = new Vector3();
    this.extendSizeWorld = new Vector3();
    this.worldMatrix = worldMatrix || Matrix4.fromIdentity();

    this.reConstruct(minimum, maximum, worldMatrix);
  }

  /**
   * 重新构建包围盒
   * @param min - 新的最小点（局部空间）
   * @param max - 新的最大点（局部空间）
   * @param worldMatrix - 新的世界矩阵
   */
  reConstruct (min: Vector3, max: Vector3, worldMatrix?: Matrix4): void {
    const minX = min.x, minY = min.y, minZ = min.z;
    const maxX = max.x, maxY = max.y, maxZ = max.z;

    // 更新最小最大点
    this.minimum.set(minX, minY, minZ);
    this.maximum.set(maxX, maxY, maxZ);

    // 构建 8 个顶点（局部空间）
    this.vectors[0].set(minX, minY, minZ);
    this.vectors[1].set(maxX, maxY, maxZ);
    this.vectors[2].set(maxX, minY, minZ);
    this.vectors[3].set(minX, maxY, minZ);
    this.vectors[4].set(minX, minY, maxZ);
    this.vectors[5].set(maxX, maxY, minZ);
    this.vectors[6].set(minX, maxY, maxZ);
    this.vectors[7].set(maxX, minY, maxZ);

    // 计算中心和半尺寸
    const temp0 = BoundingBox.tempVector0;
    const temp1 = BoundingBox.tempVector1;

    temp0.copyFrom(max).add(min);
    this.center.copyFrom(temp0).scale(0.5);

    temp1.copyFrom(max).subtract(min);
    this.extendSize.copyFrom(temp1).scale(0.5);

    this.worldMatrix = worldMatrix || Matrix4.fromIdentity();
    this.update(this.worldMatrix);
  }

  /**
   * 更新世界空间数据
   * @param world - 世界变换矩阵
   */
  update (world: Matrix4): void {
    const minWorld = this.minimumWorld;
    const maxWorld = this.maximumWorld;
    const vectorsWorld = this.vectorsWorld;
    const vectors = this.vectors;

    if (!world.isIdentity()) {
      // 初始化为极值
      minWorld.set(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      maxWorld.set(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

      // 变换所有顶点并更新最小最大值
      for (let i = 0; i < 8; i++) {
        world.transformPoint(vectors[i], vectorsWorld[i]);
        const v = vectorsWorld[i];

        minWorld.x = Math.min(minWorld.x, v.x);
        minWorld.y = Math.min(minWorld.y, v.y);
        minWorld.z = Math.min(minWorld.z, v.z);
        maxWorld.x = Math.max(maxWorld.x, v.x);
        maxWorld.y = Math.max(maxWorld.y, v.y);
        maxWorld.z = Math.max(maxWorld.z, v.z);
      }

      // 计算世界空间的半尺寸和中心
      const temp0 = BoundingBox.tempVector0;
      const temp1 = BoundingBox.tempVector1;

      temp0.copyFrom(maxWorld).subtract(minWorld);
      this.extendSizeWorld.copyFrom(temp0).scale(0.5);

      temp1.copyFrom(maxWorld).add(minWorld);
      this.centerWorld.copyFrom(temp1).scale(0.5);
    } else {
      // 单位矩阵，直接复制
      minWorld.copyFrom(this.minimum);
      maxWorld.copyFrom(this.maximum);

      for (let i = 0; i < 8; i++) {
        vectorsWorld[i].copyFrom(vectors[i]);
      }

      this.extendSizeWorld.copyFrom(this.extendSize);
      this.centerWorld.copyFrom(this.center);
    }

    // 提取 OBB 方向（世界矩阵的 X, Y, Z 轴）
    const m = world.elements;

    this.directions[0].set(m[0], m[1], m[2]);
    this.directions[1].set(m[4], m[5], m[6]);
    this.directions[2].set(m[8], m[9], m[10]);

    this.worldMatrix = world;
  }

  /**
   * 缩放包围盒
   * @param factor - 缩放因子
   * @returns 返回自身以支持链式调用
   */
  scale (factor: number): BoundingBox {
    const diff = BoundingBox.tempVector0;

    diff.copyFrom(this.maximum).subtract(this.minimum);
    const len = diff.length();

    diff.scale(1 / len);

    const distance = len * factor;

    diff.scale(distance * 0.5);

    const min = BoundingBox.tempVector1;
    const max = BoundingBox.tempVector2;

    min.copyFrom(this.center).subtract(diff);
    max.copyFrom(this.center).add(diff);

    this.reConstruct(min, max, this.worldMatrix);

    return this;
  }

  /**
   * 获取世界变换矩阵
   * @returns 世界矩阵
   */
  getWorldMatrix (): Matrix4 {
    return this.worldMatrix;
  }

  /**
   * 测试点是否在包围盒内
   * @param point - 要测试的点
   * @returns 如果点在包围盒内返回 true
   */
  intersectsPoint (point: Vector3): boolean {
    const min = this.minimumWorld;
    const max = this.maximumWorld;
    const delta = -0.000001; // Epsilon

    if (max.x - point.x < delta || delta > point.x - min.x) {
      return false;
    }
    if (max.y - point.y < delta || delta > point.y - min.y) {
      return false;
    }
    if (max.z - point.z < delta || delta > point.z - min.z) {
      return false;
    }

    return true;
  }

  /**
   * 测试包围盒是否与另一个包围盒相交
   * @param box - 另一个包围盒
   * @returns 如果相交返回 true
   */
  intersectsBox (box: BoundingBox): boolean {
    return this.intersectsMinMax(box.minimumWorld, box.maximumWorld);
  }

  /**
   * 测试包围盒是否与 min/max 定义的区域相交
   * @param min - 最小点
   * @param max - 最大点
   * @returns 如果相交返回 true
   */
  intersectsMinMax (min: Vector3, max: Vector3): boolean {
    const myMin = this.minimumWorld;
    const myMax = this.maximumWorld;

    if (myMax.x < min.x || myMin.x > max.x) {
      return false;
    }
    if (myMax.y < min.y || myMin.y > max.y) {
      return false;
    }
    if (myMax.z < min.z || myMin.z > max.z) {
      return false;
    }

    return true;
  }

  /**
   * 静态方法：测试两个包围盒是否相交
   * @param box0 - 第一个包围盒
   * @param box1 - 第二个包围盒
   * @returns 如果相交返回 true
   */
  static intersects (box0: BoundingBox, box1: BoundingBox): boolean {
    return box0.intersectsMinMax(box1.minimumWorld, box1.maximumWorld);
  }
}