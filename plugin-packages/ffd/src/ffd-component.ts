import type { Engine } from '@galacean/effects';
import { spec, math, effectsClass, Component, SpriteComponent, Shader, generateGUID } from '@galacean/effects';
import fs from './shader/fragment.glsl';
import vs from './shader/vertex.glsl';

@effectsClass('FFDComponent')
export class FFDComponent extends Component {
  private data: spec.FFDComponentData;

  private enableFFD = true;
  private rowNum = 5;                     // 行数量（列控制点数）
  private colNum = 5;                     // 列数量（行控制点数）

  private controlPoints: math.Vector3[] = [];  // 控制点数组， from time line

  private currentSpriteComponent: SpriteComponent;      // 存储当前的SpriteComponent
  private boundMin = new math.Vector3(-0.5, -0.5, 0.0); // 当前SpriteComponent的BBX
  private boundMax = new math.Vector3(0.5, 0.5, 0.0);   // 当前SpriteComponent的BBX

  constructor (engine: Engine) {
    super(engine);

    if (engine.displayServer.renderingDevice.gpuCapability.detail.maxVertexUniforms < 256) {
      this.enableFFD = false;
    }
  }

  override onStart (): void {
    // 收集相关的 SpriteComponent
    this.collectSpriteComponents();
  }

  override onUpdate (dt: number): void {
    this.updateShaderUniform();
  }

  /** 编辑器读取副本，避免绕过批量更新直接修改控制点。 */
  getLattice () {
    return {
      enabled: this.enableFFD && this.rowNum >= 2 && this.rowNum <= 13 && this.colNum >= 2 && this.colNum <= 13
        && this.controlPoints.length === this.rowNum * this.colNum,
      rows: this.rowNum,
      columns: this.colNum,
      points: this.controlPoints.map(point => point.clone()),
      min: new math.Vector3().copyFrom(this.boundMin),
      max: new math.Vector3().copyFrom(this.boundMax),
    };
  }

  /**
   * 一次写入完整晶格；保留尺寸和索引顺序，并同步可序列化数据。
   * 点数须与当前晶格一致，坐标须为有限值；不合法时抛错且不修改点集。
   */
  setControlPoints (points: readonly math.Vector3[]): void {
    if (!this.data || points.length !== this.controlPoints.length
      || points.some(point => ![point.x, point.y, point.z].every(Number.isFinite))) {
      throw new Error('Invalid FFD control points.');
    }
    this.controlPoints = points.map(point => point.clone());
    this.data.controlPoints = this.controlPoints.map(point => point.clone());
    this.updateShaderUniform();
  }

  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;
    this.initData();
  }

  /**
   * 获取当前的SpriteComponent
   */
  private collectSpriteComponents () {
    if (this.item) {
      const currentComponent = this.item.getComponent(SpriteComponent);

      if (currentComponent) {
        // 修改当前 sprite 组件的 shader
        if (this.enableFFD) {
          const shader = new Shader(this.engine);

          shader.fromData({
            vertex: vs,
            fragment: fs,
            id: generateGUID(),
            dataType: spec.DataType.Shader,
          });
          currentComponent.material.shader = shader;
        }

        this.currentSpriteComponent = currentComponent;
      }
    }
  }

  /**
   * 更新控制点位置
   */
  private initData () {
    if (!this.data || !this.data.controlPoints) {
      return;
    }
    this.boundMax = this.data.boundMax;
    this.boundMin = this.data.boundMin;
    this.rowNum = this.data.rowNum;
    this.colNum = this.data.colNum;

    const capacity = this.rowNum * this.colNum;
    const count = Math.min(this.data.controlPoints.length, capacity);

    this.controlPoints.length = 0;
    for (let i = 0; i < count; i++) {
      const points: any = this.data.controlPoints[i];

      this.controlPoints.push(
        points instanceof math.Vector3
          ? points
          : new math.Vector3(points?.x ?? 0, points?.y ?? 0, points?.z ?? 0)
      );
    }

    for (let i = count; i < capacity; i++) {
      this.controlPoints.push(new math.Vector3(0, 0, 0));
    }
    // 更新所有相关材质的 uniform
    this.updateShaderUniform();
  }

  /**
   * 更新相关 uniform
   */
  private updateShaderUniform (): void {
    // 确保当前的 SpriteComponent 存在
    if (!this.currentSpriteComponent) {
      return;
    }
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
