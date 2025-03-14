import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { Component } from './component';
import { MeshComponent } from './mesh-component';

// TODO 临时本地声明，提供给编辑器
declare module '@galacean/effects-specification' {
  interface FFDComponentData extends spec.ComponentData {
    controlPoints?: {
      x: number,
      y: number,
      z: number,
    }[],
  }
}

@effectsClass('FFDComponent')
export class FFDComponent extends Component {
  private data: spec.FFDComponentData;
  private animated = false;

  private controlPoints = new Float32Array(25 * 3); // 控制点数组
  private boundMin = new Vector3(-0.5, -0.5, 0.0);
  private boundMax = new Vector3(0.5, 0.5, 0.0);

  constructor (engine: Engine) {
    super(engine);

    // 初始化默认控制点 (会在onStart中基于实际包围盒更新)
    this.initDefaultControlPoints();
  }

  override onStart (): void {
    // 在组件启动时，基于相关组件的包围盒更新控制点
    this.initControlPointsFromBoundingBox();
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.updateControlPoints();
      this.animated = false;
    }
  }

  /**
   * 初始化默认控制点
   */
  private initDefaultControlPoints () {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const idx = (i * 5 + j) * 3;
        const x = j / 4.0 - 0.5;
        const y = i / 4.0 - 0.5;
        const z = 0.0;

        this.controlPoints[idx] = x;
        this.controlPoints[idx + 1] = y;
        this.controlPoints[idx + 2] = z;
      }
    }
  }

  /**
   * 基于包围盒初始化控制点
   */
  private initControlPointsFromBoundingBox () {
    // 此时this.item应该已经初始化
    if (!this.item) {
      console.warn('FFDComponent: item is not initialized, cannot get bounding box');

      return;
    }

    // 初始化一个无限大的包围盒
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    // 从同级的MeshComponent组件获取包围盒
    const siblingMeshComponents = this.item.getComponents(MeshComponent);

    if (siblingMeshComponents && siblingMeshComponents.length > 0) {
      for (const meshComp of siblingMeshComponents) {
        // 不需要比较组件类型，只需确认不是在比较相同的实例
        const box = meshComp.getBoundingBox();

        if (box && box.area && box.area[0]?.p0 !== undefined) {
          minX = Math.min(
            minX,
            box.area[0].p0.x,
            box.area[0].p1.x,
            box.area[0].p2.x
          );
          maxX = Math.max(
            maxX,
            box.area[0].p0.x,
            box.area[0].p1.x,
            box.area[0].p2.x
          );

          minY = Math.min(
            minY,
            box.area[0].p0.y,
            box.area[0].p1.y,
            box.area[0].p2.y
          );
          maxY = Math.max(
            maxY,
            box.area[0].p0.y,
            box.area[0].p1.y,
            box.area[0].p2.y
          );

          minZ = Math.min(
            minZ,
            box.area[0].p0.z,
            box.area[0].p1.z,
            box.area[0].p2.z
          );
          maxZ = Math.max(
            maxZ,
            box.area[0].p0.z,
            box.area[0].p1.z,
            box.area[0].p2.z
          );
        }
      }
    }

    // 同时从子组件获取包围盒并合并
    if (this.item.children && this.item.children.length > 0) {
      // 遍历所有子组件，合并它们的包围盒
      for (const child of this.item.children) {
        const childComponent = child.getComponent(MeshComponent);

        if (childComponent) {
          const childBox = childComponent.getBoundingBox();

          if (childBox && childBox.area) {
            // 合并子组件的包围盒
            if (childBox.area[0]?.p0 !== undefined) {
              minX = Math.min(minX, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);
              maxX = Math.max(maxX, childBox.area[0].p0.x, childBox.area[0].p1.x, childBox.area[0].p2.x);

              minY = Math.min(minY, childBox.area[0].p0.y, childBox.area[0].p1.y, childBox.area[0].p2.y);
              maxY = Math.max(maxY, childBox.area[0].p0.y, childBox.area[0].p1.y, childBox.area[0].p2.y);

              minZ = Math.min(minZ, childBox.area[0].p0.z, childBox.area[0].p1.z, childBox.area[0].p2.z);
              maxZ = Math.max(maxZ, childBox.area[0].p0.z, childBox.area[0].p1.z, childBox.area[0].p2.z);
            }
          }
        }
      }
    }

    // 如果没有找到有效的包围盒，使用默认值
    if (minX === Infinity || maxX === -Infinity) {
      minX = -0.5; minY = -0.5; minZ = 0;
      maxX = 0.5; maxY = 0.5; maxZ = 0;
      console.warn('FFDComponent: No valid bounding box found, using default range.');
    }

    // 更新包围盒边界
    this.boundMin = new Vector3(minX, minY, minZ);
    this.boundMax = new Vector3(maxX, maxY, maxZ);

    // 基于包围盒范围均匀生成5x5控制点
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const idx = (i * 5 + j) * 3;

        // 将控制点均匀分布在包围盒范围内
        const x = minX + (j / 4.0) * (maxX - minX);
        const y = minY + (i / 4.0) * (maxY - minY);
        const z = minZ; // 通常Z值保持不变

        this.controlPoints[idx] = x;
        this.controlPoints[idx + 1] = y;
        this.controlPoints[idx + 2] = z;

        // TODO 更新uniform
        // this.material.setVector3(`u_ControlPoints[${i * 5 + j}]`, new Vector3(x, y, z));
      }
    }
  }

  /**
   * 更新控制点
   */
  private updateControlPoints () {
    if (!this.data || !this.data.controlPoints) {
      return;
    }

    // 更新控制点位置
    for (let i = 0; i < Math.min(this.data.controlPoints.length, 25); i++) {
      const point = this.data.controlPoints[i];
      const idx = i * 3;

      this.controlPoints[idx] = point.x;
      this.controlPoints[idx + 1] = point.y;
      this.controlPoints[idx + 2] = point.z;

      // TODO 更新 uniform
      // this.material.setVector3(`u_ControlPoints[${i}]`, new Vector3(point.x, point.y, point.z));
    }
  }

  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;

    // 标记需要更新
    this.animated = true;
  }
}
