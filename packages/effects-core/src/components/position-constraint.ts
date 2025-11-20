import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../vfx-item';
import { Component } from './component';
import { effectsClass } from '../decorators';
import type { ComponentData } from '@galacean/effects-specification';
import type * as spec from '@galacean/effects-specification';

const tempVector3 = new Vector3(0, 0, 0);
const tempVector3Second = new Vector3(0, 0, 0);

export class ConstraintTarget {
  target: VFXItem | null = null;
  weight = 1.0;
}

export interface ConstraintTargetData {
  target: spec.DataPath,
  weight: number,
}

export interface PositionConstraintData extends ComponentData {
  positionAtRest: spec.Vector3Data,
  positionOffset: spec.Vector3Data,
  weight: number,
  constrainX: boolean,
  constrainY: boolean,
  constrainZ: boolean,
  targets: ConstraintTargetData[],
}

/**
 * 位置约束组件
 * 用于约束物体跟随目标对象的位置
 */
@effectsClass('PositionConstraint')
export class PositionConstraint extends Component {
  /**
   * 初始位置（当前元素的初始世界位置）
   */
  private positionAtRest = new Vector3(0, 0, 0);
  /**
   * 位置偏移
   */
  private positionOffset = new Vector3(0, 0, 0);
  /**
   * 约束权重 (0-1)
   */
  private weight = 1.0;
  /**
   * 是否约束 X 轴
   */
  private constrainX = true;
  /**
   * 是否约束 Y 轴
   */
  private constrainY = true;
  /**
   * 是否约束 Z 轴
   */
  private constrainZ = true;
  /**
   * 约束目标
   */
  private targets: ConstraintTarget[] = [];

  override onStart (): void {
    // 保存当前元素的初始世界位置
    const pos = this.item.transform.getWorldPosition();

    this.positionAtRest.copyFrom(pos);
  }

  override onUpdate (dt: number): void {
    if (this.targets.length === 0) {
      return;
    }

    // 重置 tempVector3 用于计算融合位置
    tempVector3.set(0, 0, 0);
    let totalWeight = 0;

    // 计算所有目标的加权平均位置
    for (const constraintTarget of this.targets) {
      if (constraintTarget.target) {
        const targetPos = constraintTarget.target.transform.getWorldPosition();
        const weight = constraintTarget.weight;

        tempVector3.x += targetPos.x * weight;
        tempVector3.y += targetPos.y * weight;
        tempVector3.z += targetPos.z * weight;
        totalWeight += weight;
      }
    }

    // 归一化加权位置
    if (totalWeight > 0) {
      tempVector3.x /= totalWeight;
      tempVector3.y /= totalWeight;
      tempVector3.z /= totalWeight;
    }

    // 应用偏移
    tempVector3.x += this.positionOffset.x;
    tempVector3.y += this.positionOffset.y;
    tempVector3.z += this.positionOffset.z;

    // 根据全局权重在初始位置和融合位置之间插值，结果存入 tempVector3Second
    tempVector3Second.set(
      this.lerp(this.positionAtRest.x, tempVector3.x, this.weight),
      this.lerp(this.positionAtRest.y, tempVector3.y, this.weight),
      this.lerp(this.positionAtRest.z, tempVector3.z, this.weight),
    );

    // 应用轴约束，复用 tempVector3 存储当前位置
    tempVector3.copyFrom(this.item.transform.getWorldPosition());
    const finalX = this.constrainX ? tempVector3Second.x : tempVector3.x;
    const finalY = this.constrainY ? tempVector3Second.y : tempVector3.y;
    const finalZ = this.constrainZ ? tempVector3Second.z : tempVector3.z;

    // 设置新的世界位置
    this.item.transform.setWorldPosition(finalX, finalY, finalZ);
  }

  /**
   * 添加约束目标
   * @param target - 目标元素
   * @param weight - 权重值 (0-1)
   */
  addTarget (target: VFXItem, weight = 1.0): void {
    const constraintTarget = new ConstraintTarget();

    constraintTarget.target = target;
    constraintTarget.weight = Math.max(0, Math.min(1, weight));
    this.targets.push(constraintTarget);
  }

  /**
   * 移除约束目标
   * @param target - 要移除的目标元素
   */
  removeTarget (target: VFXItem): void {
    const index = this.targets.findIndex(ct => ct.target === target);

    if (index !== -1) {
      this.targets.splice(index, 1);
    }
  }

  /**
   * 清除所有约束目标
   */
  clearTargets (): void {
    this.targets = [];
  }

  /**
   * 设置位置偏移
   * @param x - X 轴偏移
   * @param y - Y 轴偏移
   * @param z - Z 轴偏移
   */
  setPositionOffset (x: number, y: number, z: number): void {
    this.positionOffset.set(x, y, z);
  }

  /**
   * 设置全局约束权重
   * @param weight - 权重值 (0-1)，0 表示保持初始位置，1 表示完全跟随目标
   */
  setWeight (weight: number): void {
    this.weight = Math.max(0, Math.min(1, weight));
  }

  /**
   * 线性插值
   * @param start - 起始值
   * @param end - 结束值
   * @param t - 插值因子 (0-1)
   */
  private lerp (start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  override fromData (data: PositionConstraintData): void {
    super.fromData(data);

    // Deserialize all properties
    this.positionAtRest.copyFrom(data.positionAtRest);
    this.positionOffset.copyFrom(data.positionOffset);
    this.weight = data.weight;
    this.constrainX = data.constrainX;
    this.constrainY = data.constrainY;
    this.constrainZ = data.constrainZ;

    this.targets = [];
    for (const targetData of data.targets) {
      const constraintTarget = new ConstraintTarget();

      constraintTarget.target = this.engine.findObject(targetData.target);
      constraintTarget.weight = targetData.weight;
      this.targets.push(constraintTarget);
    }
  }
}
