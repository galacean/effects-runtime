import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { Component } from './component';
import { MeshComponent } from './mesh-component';

// TODO 临时本地声明，提供给编辑器
declare module '@galacean/effects-specification' {
  interface FFDComponentData extends spec.ComponentData {
    controlPoints?: Vector3[],
  }
}

@effectsClass('FFDComponent')
export class FFDComponent extends Component {
  private controlPoints: Vector3[] = []; // 控制点数组， from time line

  private data: spec.FFDComponentData;
  private animated = false;

  private relatedMeshComponents: MeshComponent[] = []; // 存储相关的MeshComponent
  private boundMin = new Vector3(-0.5, -0.5, 0.0);
  private boundMax = new Vector3(0.5, 0.5, 0.0);

  constructor (engine: Engine) {
    super(engine);

    // 初始化默认控制点 (会在onStart中基于实际包围盒更新)
    this.initDefaultControlPoints();
  }

  override onStart (): void {
    // 收集相关的MeshComponent
    this.collectRelatedMeshComponents();

    // 在组件启动时，基于相关组件的包围盒更新控制点
    this.initControlPointsFromBoundingBox();
  }

  override onUpdate (dt: number): void {
    if (this.animated) {
      this.updateControlPoints();
      this.animated = false;
    }
  }

  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;

    // 标记需要更新
    this.animated = true;
  }

  /**
   * 初始化默认控制点
   */
  private initDefaultControlPoints () {
    this.controlPoints = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const x = j / 4.0 - 0.5;
        const y = i / 4.0 - 0.5;
        const z = 0.0;

        this.controlPoints.push(new Vector3(x, y, z));
      }
    }

    // 初始化后更新相关材质的uniform
    this.updateMaterialUniforms();
  }

  /**
   * 收集所有相关的MeshComponent（自己和子元素的）
   */
  private collectRelatedMeshComponents () {
    this.relatedMeshComponents = [];

    // 收集同级MeshComponent
    if (this.item) {
      const siblingMeshComponents = this.item.getComponents(MeshComponent);

      if (siblingMeshComponents && siblingMeshComponents.length > 0) {
        this.relatedMeshComponents.push(...siblingMeshComponents);
      }

      // 收集子元素的MeshComponent
      if (this.item.children && this.item.children.length > 0) {
        for (const child of this.item.children) {
          const childComponent = child.getComponent(MeshComponent);

          if (childComponent) {
            this.relatedMeshComponents.push(childComponent);
          }
        }
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

    // 使用已收集的MeshComponent来获取包围盒
    for (const meshComp of this.relatedMeshComponents) {
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
    this.controlPoints = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        // 将控制点均匀分布在包围盒范围内
        const x = minX + (j / 4.0) * (maxX - minX);
        const y = minY + (i / 4.0) * (maxY - minY);
        const z = minZ; // 通常Z值保持不变

        this.controlPoints.push(new Vector3(x, y, z));
      }
    }

    // 更新所有相关材质的uniform
    this.updateMaterialUniforms();
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

      if (i < this.controlPoints.length) {
        this.controlPoints[i].x = point.x;
        this.controlPoints[i].y = point.y;
        this.controlPoints[i].z = point.z;
      } else {
        this.controlPoints.push(new Vector3(point.x, point.y, point.z));
      }
    }

    // 更新所有相关材质的uniform
    this.updateMaterialUniforms();
  }

  /**
   * 更新所有相关材质的uniform
   */
  private updateMaterialUniforms (): void {
    // 使用已收集的MeshComponent，无需每次都重新收集
    for (const meshComp of this.relatedMeshComponents) {
      const material = meshComp.material;

      if (material) {
        // 设置包围盒信息
        material.setVector3('u_BoundMin', this.boundMin);
        material.setVector3('u_BoundMax', this.boundMax);

        // 设置控制点信息
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            const idx = i * 5 + j;

            if (idx < this.controlPoints.length) {
              const controlPoint = this.controlPoints[idx];

              material.setVector3(`u_ControlPoints[${idx}]`, controlPoint);
            }
          }
        }
      }
    }
  }
}
