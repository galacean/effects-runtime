import type { Engine } from '@galacean/effects';
import { spec, math, effectsClass, Component, SpriteComponent, Shader, generateGUID } from '@galacean/effects';
import fs from './shader/fragment.glsl';
import vs from './shader/vertex.glsl';

@effectsClass('FFDComponent')
export class FFDComponent extends Component {
  // @ts-expect-error
  private data: spec.FFDComponentData;

  private rowNum = 5;                     // 行数量（列控制点数）
  private colNum = 5;                     // 列数量（行控制点数）

  private controlPoints: math.Vector3[] = [];  // 控制点数组， from time line

  private currentSpriteComponent: SpriteComponent;      // 存储当前的SpriteComponent
  private boundMin = new math.Vector3(-0.5, -0.5, 0.0); // 当前SpriteComponent的BBX
  private boundMax = new math.Vector3(0.5, 0.5, 0.0);   // 当前SpriteComponent的BBX

  constructor (engine: Engine) {
    super(engine);
  }

  override onStart (): void {
    // 收集相关的 SpriteComponent
    this.collectSpriteComponents();
  }

  override onUpdate (dt: number): void {
    this.updateControlPoints();
  }

  // @ts-expect-error
  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;
  }

  /**
   * 收集所有相关的 SpriteComponents（自己和子元素的）
   */
  private collectSpriteComponents () {
    // 收集同级 SpriteComponent
    if (this.item) {
      const currentComponent = this.item.getComponent(SpriteComponent);

      if (currentComponent) {
        // 修改当前 sprite 组件的 shader
        const shader = new Shader(this.engine);

        shader.fromData({
          vertex: vs,
          fragment: fs,
          id: generateGUID(),
          dataType: spec.DataType.Shader,
        });
        currentComponent.material.shader = shader;
        this.currentSpriteComponent = currentComponent;
      }
      // // 收集子元素的spriteComponent 暂不考虑FFD叠加效果
      // if (this.item.children && this.item.children.length > 0) {
      //   for (const child of this.item.children) {
      //     const childComponent = child.getComponent(SpriteComponent);

      //     if (childComponent) {
      //       this.relatedSpriteComponents.push(childComponent);
      //     }
      //   }
      // }
    }
  }

  /**
   * 更新控制点，控制点顺序为以左下角点为起点，行优先
   */
  private updateControlPoints () {
    if (!this.data || !this.data.controlPoints) {
      return;
    }

    // 更新控制点位置
    for (let i = 0; i < Math.min(this.data.controlPoints.length, this.rowNum * this.colNum); i++) {
      const point = this.data.controlPoints[i];

      if (i < this.controlPoints.length) {
        this.controlPoints[i].x = point.x;
        this.controlPoints[i].y = point.y;
        this.controlPoints[i].z = point.z;
      } else {
        this.controlPoints.push(new math.Vector3(point.x, point.y, point.z));
      }
    }
    // 更新所有相关材质的 uniform
    this.updateMaterialUniforms();
  }

  /**
   * 更新相关 uniform
   */
  private updateMaterialUniforms (): void {
    // 使用已收集的 spriteComponent，无需每次都重新收集
    const material = this.currentSpriteComponent.material;

    if (material) {
      material.setVector3('_BoundMin', this.boundMin);
      material.setVector3('_BoundMax', this.boundMax);
      material.setInt('_RowNum', this.rowNum);
      material.setInt('_ColNum', this.colNum);

      for (let i = 0; i < this.colNum; i++) {
        for (let j = 0; j < this.rowNum; j++) {
          const idx = i * this.rowNum + j;

          if (idx < this.controlPoints.length) {
            const controlPoint = this.controlPoints[idx];

            material.setVector3(`_ControlPoints[${idx}]`, controlPoint);
          }
        }
      }
    }
  }
}