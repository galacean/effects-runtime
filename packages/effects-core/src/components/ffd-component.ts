import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { Component } from './component';
import { SpriteComponent } from '../plugins';
import { Shader } from '../render';
import { generateGUID } from '../utils';
// TODO 临时本地声明，提供给编辑器
declare module '@galacean/effects-specification' {
  interface FFDComponentData extends spec.ComponentData {
    controlPoints?: Vector3[],
  }
}

@effectsClass('FFDComponent')
export class FFDComponent extends Component {
  private controlPoints: Vector3[] = [];  // 控制点数组， from time line

  private data: spec.FFDComponentData;
  private reset = false;                  // 控制点重置
  private additive = true;                // 效果叠加

  private fixedValueExpand = false;       // 等长扩张
  private fixedValueShrink = false;       // 等长收缩
  private variableValueExpand = false;    // 按距离扩张
  private variableValueShrink = false;    // 按距离收缩

  private trapezoidExpandTop = false;     // 梯形扩张
  private trapezoidShrinkTop = false;     // 梯形收缩
  private trapezoidExpandBottom = false;  // 梯形扩张
  private trapezoidShrinkBottom = false;  // 梯形收缩
  private trapezoidExpandLeft = false;    // 梯形扩张
  private trapezoidShrinkLeft = false;    // 梯形收缩
  private trapezoidExpandRight = false;   // 梯形扩张
  private trapezoidShrinkRight = false;   // 梯形收缩

  private rowNum = 5;                     // 行数量（列控制点数）
  private colNum = 5;                     // 列数量（行控制点数）

  private relatedSpriteComponents: SpriteComponent[] = []; // 存储相关的SpriteComponent
  private boundMin = new Vector3(-0.5, -0.5, 0.0);
  private boundMax = new Vector3(0.5, 0.5, 0.0);
  private leftTopIndices: number[] = [];
  private rightTopIndices: number[] = [];
  private leftBottomIndices: number[] = [];
  private rightBottomIndices: number[] = [];

  private trapezoidOps = [
    { flag: 'trapezoidExpandTop', edge: 'top', xGap:  0.2, yGap:  0.1 },
    { flag: 'trapezoidShrinkTop', edge: 'top', xGap: -0.2, yGap: -0.1 },
    { flag: 'trapezoidExpandBottom', edge: 'bottom', xGap:  0.2, yGap:  0.1 },
    { flag: 'trapezoidShrinkBottom', edge: 'bottom', xGap: -0.2, yGap: -0.1 },
    { flag: 'trapezoidExpandLeft', edge: 'left', xGap:  0.2, yGap:  0.1 },
    { flag: 'trapezoidShrinkLeft', edge: 'left', xGap: -0.2, yGap: -0.1 },
    { flag: 'trapezoidExpandRight', edge: 'right', xGap:  0.2, yGap:  0.1 },
    { flag: 'trapezoidShrinkRight', edge: 'right', xGap: -0.2, yGap: -0.1 },
  ] as const;

  constructor (engine: Engine) {
    super(engine);
  }

  override onStart (): void {
    // 收集相关的SpriteComponent
    this.collectSpriteComponents();

    // 基于相关组件的包围盒更新控制点
    this.initControlPointsFromBoundingBox();

    // 划分4个象限的控制点，暂时还未用到
    this.setQuadrantIndices();
  }

  override onUpdate (dt: number): void {
    // 接入编辑器数据后取消注释
    // this.updateControlPoints();
    if (this.reset) {
      this.initControlPointsFromBoundingBox();
      this.reset = false;
    }
    // 判断是否处于可叠加状态，不在的话执行模板前要reset
    const maybeReset = () => {
      if (!this.additive) {
        this.initControlPointsFromBoundingBox();
      }
    };

    if (this.fixedValueExpand) {
      maybeReset();
      this.expandByFixedValue(0.25); // 乘1.25的反操作是乘0.8
      this.fixedValueExpand = false;
    }
    if (this.fixedValueShrink) {
      maybeReset();
      this.expandByFixedValue(-0.2);
      this.fixedValueShrink = false;
    }

    if (this.variableValueExpand) {
      maybeReset();
      this.expandByVariableValue(0.15);
      this.variableValueExpand = false;
    }
    if (this.variableValueShrink) {
      maybeReset();
      this.expandByVariableValue(-0.15);
      this.variableValueShrink = false;
    }

    for (const op of this.trapezoidOps) {
      const flag = this[op.flag as keyof this] as boolean;

      if (flag) {
        maybeReset();
        this.expandTrapezoidEdge(op.edge, op.xGap, op.yGap);
        (this[op.flag as keyof this] as boolean) = false;
      }
    }
  }

  override fromData (data: spec.FFDComponentData): void {
    super.fromData(data);
    this.data = data;
  }

  /**
   * 收集所有相关的SpriteComponents（自己和子元素的）
   */
  private collectSpriteComponents () {
    this.relatedSpriteComponents = [];

    // 收集同级SpriteComponent
    if (this.item) {
      const siblingComponents = this.item.getComponents(SpriteComponent);

      if (siblingComponents && siblingComponents.length > 0) {

        // 网格细分 begin：debug用
        // 修改当前sprite组件的shader
        const shader = new Shader(this.engine);

        shader.fromData({
          vertex: FFDVertexShader,
          fragment: FFDFragmentShader,
          id: generateGUID(),
          dataType: spec.DataType.Shader,
        });

        // 修改当前sprite组件的geometry，即进行网格细分
        const xCount = 13; // x方向格点数
        const yCount = 13; // y方向格点数

        for (const siblingComponent of siblingComponents) {
          const subdivPosition = [];
          const subdivUV = [];
          const subdivIndex = [];

          const { minX, minY, minZ, maxX, maxY, maxZ } = this.getComponentBoundingBox(siblingComponent);
          const componentSize = siblingComponent.transform.size;

          // 更新包围盒边界，这里需要手动乘一下组件的size
          this.boundMin = new Vector3(componentSize.x * minX, componentSize.y * minY, minZ);
          this.boundMax = new Vector3(componentSize.x * maxX, componentSize.y * maxY, maxZ);

          //@ts-expect-error
          const split: number[] = siblingComponent.splits[0] as number[];
          const texOffset = split[4] ? [0, 0, 1, 0, 0, 1, 1, 1] : [0, 1, 0, 0, 1, 1, 1, 0];

          const tox = split[0];
          const toy = split[1];
          const tsx = split[4] ? split[3] : split[2];
          const tsy = split[4] ? split[2] : split[3];

          const uv00 = [texOffset[2] * tsx + tox, texOffset[3] * tsy + toy];
          const uv01 = [texOffset[0] * tsx + tox, texOffset[1] * tsy + toy];
          const uv11 = [texOffset[4] * tsx + tox, texOffset[5] * tsy + toy];
          const uv10 = [texOffset[6] * tsx + tox, texOffset[7] * tsy + toy];

          for (let yi = 0; yi < yCount; yi++) {
            const y = this.boundMin.y + yi * ((this.boundMax.y - this.boundMin.y) / (yCount - 1));
            const v = yi / (yCount - 1);

            for (let xi = 0; xi < xCount; xi++) {
              const x = this.boundMin.x + xi * ((this.boundMax.x - this.boundMin.x) / (xCount - 1));
              const u = xi / (xCount - 1);

              subdivPosition.push(x, y, 0);
              // 映射到split上
              const uvx = uv00[0] * (1 - u) * (1 - v) + uv01[0] * (1 - u) * v + uv11[0] * u * v + uv10[0] * u * (1 - v);
              const uvy = uv00[1] * (1 - u) * (1 - v) + uv01[1] * (1 - u) * v + uv11[1] * u * v + uv10[1] * u * (1 - v);

              subdivUV.push(uvx, uvy);
            }
          }
          for (let yi = 0; yi < yCount - 1; yi++) {
            for (let xi = 0; xi < xCount - 1; xi++) {
              const i0 = yi * xCount + xi;              // 左上
              const i1 = (yi + 1) * xCount + xi;        // 左下
              const i2 = yi * xCount + (xi + 1);        // 右上
              const i3 = (yi + 1) * xCount + (xi + 1);  // 右下

              // 两个三角形
              subdivIndex.push(i0, i1, i2); // 左上-左下-右上
              subdivIndex.push(i2, i1, i3); // 右上-左下-右下
            }
          }

          siblingComponent.geometry.setAttributeData('aPos', new Float32Array(subdivPosition));
          siblingComponent.geometry.setIndexData(new Uint16Array(subdivIndex));
          siblingComponent.geometry.setAttributeData('aUV', new Float32Array(subdivUV));
          siblingComponent.geometry.setDrawCount(subdivIndex.length);
          siblingComponent.geometry.subMeshes.length = 0;
          for (const subMesh of siblingComponent.geometry.subMeshes) {
            siblingComponent.geometry.subMeshes.push({
              offset: subMesh.offset,
              indexCount:  subMesh.indexCount,
              vertexCount:  subMesh.vertexCount,
            });
          }
          siblingComponent.material.shader = shader;
        }
        // 网格细分 end：debug用
        this.relatedSpriteComponents.push(...siblingComponents);
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
   * 基于包围盒初始化控制点
   */
  private initControlPointsFromBoundingBox () {
    // 此时this.item应该已经初始化
    if (!this.item) {
      console.warn('FFDComponent: item is not initialized, cannot get bounding box');

      return;
    }

    // 使用已收集的SpriteComp来获取包围盒
    for (const spriteComp of this.relatedSpriteComponents) {

      const { minX, minY, minZ, maxX, maxY, maxZ } = this.getComponentBoundingBox(spriteComp);

      // 更新包围盒边界
      this.boundMin = new Vector3(minX, minY, minZ);
      this.boundMax = new Vector3(maxX, maxY, maxZ);

      // 基于包围盒范围均匀生成rowNum x colNum个控制点
      this.controlPoints = [];
      for (let row = 0; row < this.rowNum; row++) {
        const y = this.boundMin.y + (row / (this.rowNum - 1)) * (this.boundMax.y - this.boundMin.y);

        for (let col = 0; col < this.colNum; col++) {
          const x = this.boundMin.x + (col / (this.colNum - 1)) * (this.boundMax.x - this.boundMin.x);
          const z = minZ;
          const cp = new Vector3(x, y, z);

          this.controlPoints.push(cp);
        }
      }
      // 更新所有相关材质的uniform
      this.updateMaterialUniforms();
    }
  }

  /**
   * 更新控制点，控制点使用列优先传输
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
        this.controlPoints.push(new Vector3(point.x, point.y, point.z));
      }
    }

    // 更新所有相关材质的uniform
    this.updateMaterialUniforms();
  }

  private setQuadrantIndices (): void {
    this.leftTopIndices = [];
    this.rightTopIndices = [];
    this.leftBottomIndices = [];
    this.rightBottomIndices = [];

    // 使用已收集的SpriteComp来获取包围盒
    for (const spriteComp of this.relatedSpriteComponents) {

      const { minX, minY, minZ, maxX, maxY, maxZ } = this.getComponentBoundingBox(spriteComp);

      // 更新包围盒边界
      this.boundMin = new Vector3(minX, minY, minZ);
      this.boundMax = new Vector3(maxX, maxY, maxZ);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      for (let col = 0; col < this.colNum; col++) {
        for (let row = 0; row < this.rowNum; row++) {
          const idx = col * this.rowNum + row;
          // 控制点在真实包围盒中的(x,y)
          const x = this.controlPoints[idx].x;
          const y = this.controlPoints[idx].y;

          if (y > centerY) {
          // 上
            if (x < centerX) {
              this.leftTopIndices.push(idx);
            } else {
              this.rightTopIndices.push(idx);
            }
          } else { // 归下（中轴归下）
            if (x < centerX) {
              this.leftBottomIndices.push(idx);
            } else {
              this.rightBottomIndices.push(idx);
            }
          }
        }
      }
    }
  }

  /**
 * 按照sprite boundingbox中心做四周的等长扩展/收缩
 * @param amount  大于0表示扩展，小于0表示收缩
 */
  private expandByFixedValue (amount: number = 0.25): void {
    const N = this.controlPoints?.length || 0;

    if (N === 0) {
      console.error('FFDComponent: controlPoints 不能为空');

      return;
    }

    const boundCenter = new Vector3(
      (this.boundMin.x + this.boundMax.x) * 0.5,
      (this.boundMin.y + this.boundMax.y) * 0.5,
      (this.boundMin.z + this.boundMax.z) * 0.5
    );

    // 遍历所有控制点，绕boundCenter缩放
    this.controlPoints.forEach(p => {
      const dx = p.x - boundCenter.x;
      const dy = p.y - boundCenter.y;

      p.set(
        boundCenter.x + dx * (1 + amount),
        boundCenter.y + dy * (1 + amount),
        p.z
      );
    });

    this.updateMaterialUniforms();
  }

  /**
 * 按照控制点离sprite boundingbox中心的距离做扩展/收缩，距离越小位移量越大
 * @param amount  大于0表示扩展，小于0表示收缩
 */
  private expandByVariableValue (amount: number = 0.25): void {
    const N = this.controlPoints?.length || 0;

    if (N === 0) {
      console.error('FFDComponent: controlPoints 不能为空');

      return;
    }

    const center = new Vector3(
      (this.boundMin.x + this.boundMax.x) * 0.5,
      (this.boundMin.y + this.boundMax.y) * 0.5,
      (this.boundMin.z + this.boundMax.z) * 0.5
    );

    // 计算最小最大距离
    let minDist = Infinity, maxDist = -Infinity;

    this.controlPoints.forEach(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len < minDist) {minDist = len;}
      if (len > maxDist) {maxDist = len;}
    });

    const distRange = Math.max(maxDist - minDist, 1e-6);
    const minRatio = 0.2; // 距离最远的点 也有最小 20% 的幅度

    this.controlPoints.forEach(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) { return; }

      const norm = (len - minDist) / distRange; // norm: 0~1, 0为最近，1为最远
      const scale = amount * (minRatio + (1 - minRatio) * (1 - norm));
      // norm=0 -> scale=amount
      // norm=1 -> scale=amount*minRatio

      p.set(
        p.x + (dx / len) * scale,
        p.y + (dy / len) * scale,
        p.z
      );
    });

    this.updateMaterialUniforms();
  }

  /**
 * 四边任选一边固定，其余点线性插值做梯形变形
 * @param edge  主要变形方向："top" | "bottom" | "left" | "right"
 * @param xGap  若edge为top/bottom表示两侧横向扩展量,若edge为left/right则为纵向扩展量。
 * @param yGap  若edge为top/bottom表示两侧纵向扩展量,若edge为left/right则为横向扩展量。
 */
  private expandTrapezoidEdge (
    edge: 'top' | 'bottom' | 'left' | 'right',
    xGap: number = 0,
    yGap: number = 0
  ): void {
    const N = this.controlPoints?.length || 0;

    if (N === 0) {
      console.error('FFDComponent: controlPoints 不能为空');

      return;
    }

    const rows = this.rowNum, cols = this.colNum;

    // 计算控制点包围盒
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;

    this.controlPoints.forEach(p => {
      if (p.y < minY) {minY = p.y;}
      if (p.y > maxY) {maxY = p.y;}
      if (p.x < minX) {minX = p.x;}
      if (p.x > maxX) {maxX = p.x;}
    });

    if (edge === 'top') {
      // 底边不动，顶边扩展
      for (let row = 0; row < rows; ++row) {
        const t = rows === 1 ? 1 : row / (rows - 1);
        const ySrc = minY + (maxY - minY) * t;
        const yDst = minY + (maxY - minY + yGap) * t;
        const rowExpand = t * xGap;

        for (let col = 0; col < cols; ++col) {
          const idx = row * cols + col;
          const p = this.controlPoints[idx];
          const sideNorm = (cols === 1) ? 0 : col / (cols - 1) * 2 - 1;

          if (row === 0) {continue;} // 底边不动
          p.x += sideNorm * rowExpand;
          p.y += (yDst - ySrc);
        }
      }
    } else if (edge === 'bottom') {
      // 顶边不动，底边扩展：从顶到底插值
      for (let row = 0; row < rows; ++row) {
        const t = rows === 1 ? 0 : 1 - row / (rows - 1);
        const ySrc = maxY - (maxY - minY) * t;
        const yDst = maxY - (maxY - minY + yGap) * t;
        const rowExpand = t * xGap;

        for (let col = 0; col < cols; ++col) {
          const idx = row * cols + col;
          const p = this.controlPoints[idx];
          const sideNorm = (cols === 1) ? 0 : col / (cols - 1) * 2 - 1;

          if (row === rows - 1) {continue;} // 顶边不动
          p.x += sideNorm * rowExpand;
          p.y += (yDst - ySrc);
        }
      }
    } else if (edge === 'left') {
      // 右边不动，左边扩展
      for (let col = 0; col < cols; ++col) {
        const t = cols === 1 ? 1 : col / (cols - 1);
        const xSrc = minX + (maxX - minX) * t;
        const xDst = minX + (maxX - minX + xGap) * t;
        const colExpand = t * yGap;

        for (let row = 0; row < rows; ++row) {
          const idx = row * cols + col;
          const p = this.controlPoints[idx];
          const sideNorm = (rows === 1) ? 0 : row / (rows - 1) * 2 - 1;

          if (col === 0) {continue;} // 左侧不动
          p.y += sideNorm * colExpand;
          p.x += (xDst - xSrc);
        }
      }
    } else if (edge === 'right') {
      // 左边不动，右边扩展：从左向右插值
      for (let col = 0; col < cols; ++col) {
        const t = cols === 1 ? 0 : 1 - col / (cols - 1);
        const xSrc = maxX - (maxX - minX) * t;
        const xDst = maxX - (maxX - minX + xGap) * t;
        const colExpand = t * yGap;

        for (let row = 0; row < rows; ++row) {
          const idx = row * cols + col;
          const p = this.controlPoints[idx];
          const sideNorm = (rows === 1) ? 0 : row / (rows - 1) * 2 - 1;

          if (col === cols - 1) {continue;} // 右侧不动
          p.y += sideNorm * colExpand;
          p.x += (xDst - xSrc);
        }
      }
    }

    this.updateMaterialUniforms();
  }

  /**
   * 更新相关uniform
   */
  private updateMaterialUniforms (): void {
    // 使用已收集的spriteComponent，无需每次都重新收集
    for (const spriteComp of this.relatedSpriteComponents) {
      const material = spriteComp.material;

      if (material) {
        material.setVector3('uBoundMin', this.boundMin);
        material.setVector3('uBoundMax', this.boundMax);
        material.setInt('uRowNum', this.rowNum);
        material.setInt('uColNum', this.colNum);
        for (let i = 0; i < this.colNum; i++) {
          for (let j = 0; j < this.rowNum; j++) {
            const idx = i * this.rowNum + j;

            if (idx < this.controlPoints.length) {
              const controlPoint = this.controlPoints[idx];

              material.setVector3(`uControlPoints[${idx}]`, controlPoint);
            }
          }
        }
      }
    }
  }

  /**
   * 获取组件的BoundingBox
   */
  private getComponentBoundingBox (vComponent: SpriteComponent) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const box = vComponent.getBoundingBox();

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

    // 如果没有找到有效的包围盒，使用默认值
    if (minX === Infinity || maxX === -Infinity) {
      minX = -0.5; minY = -0.5; minZ = 0;
      maxX = 0.5; maxY = 0.5; maxZ = 0;
      console.warn('FFDComponent: No valid bounding box found, using default range.');
    }

    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

}

const FFDVertexShader = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 uv0;

#define MAX_BLOCK_NUM 10
#define EPSILON 1e-6

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;
uniform vec3 uControlPoints[MAX_BLOCK_NUM * MAX_BLOCK_NUM];
uniform vec3 uBoundMin;
uniform vec3 uBoundMax;
uniform int uColNum;   // 列数量（行控制点数）
uniform int uRowNum;   // 行数量（列控制点数）

// 计算二项式系数 C(n, k)
float binomialCoefficient(int n, int k) {
  // 减少循环次数：C(n, k) == C(n, n-k)
  if(k > n-k) k = n-k; 

  float result = 1.0;
  for(int i = 1; i <= k; ++i) {
      result *= float(n - i + 1) / float(i);
  }
  return result;
}

// 计算n阶第k项的基函数值Bernstein(n, k, t)
float bernstein(int n, int k, float t) {
  // t在[0, 1]范围外直接返回0
  if(t < 0.0 || t > 1.0) return 0.0;

  // 端点精度处理
  if(abs(t) < EPSILON && k == 0)     return 1.0;
  else if(abs(t-1.0) < EPSILON && k == n) return 1.0;

  // 计算公式：C(n, k) * t^k * (1-t)^(n-k)
  float coeff = binomialCoefficient(n, k);
  float tk  = (k == 0)   ? 1.0 : pow(t, float(k));
  float tnk = ((n-k)==0) ? 1.0 : pow(1.0-t, float(n-k));
  return coeff * tk * tnk;
} 

vec3 bezierSurface(vec3 originalPos) {
  // 判断点是否在包围盒内，不在则直接返回原始位置
  bool isInBoundingBox =
      originalPos.x >= uBoundMin.x - EPSILON && originalPos.x <= uBoundMax.x + EPSILON &&
      originalPos.y >= uBoundMin.y - EPSILON && originalPos.y <= uBoundMax.y + EPSILON &&
      originalPos.z >= uBoundMin.z - EPSILON && originalPos.z <= uBoundMax.z + EPSILON;
  if (!isInBoundingBox) {
      return originalPos;
  }

  float u = (originalPos.x - uBoundMin.x) / (uBoundMax.x - uBoundMin.x);
  float v = (originalPos.y - uBoundMin.y) / (uBoundMax.y - uBoundMin.y);

  vec3 newPos = vec3(0.0);

  for (int row = 0; row < MAX_BLOCK_NUM; ++row) {
      if(row >= uRowNum) break;
      float bv = bernstein(uRowNum - 1, row, v);
      for (int col = 0; col < MAX_BLOCK_NUM; ++col) {
          if(col >= uColNum) break;
          float bu = bernstein(uColNum - 1, col, u);
          int idx = row * uColNum + col;
          newPos += uControlPoints[idx] * bu * bv;
      }
  }
  return newPos;
}

void main() {
  uv0 = aUV;
  vec3 newPos = bezierSurface(aPos);
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(newPos, 1.0);
}
`;

const FFDFragmentShader = `
precision highp float;

varying vec2 uv0;

uniform sampler2D _MainTex;

void main() {
    vec2 uvMain = uv0;
    vec3 color = texture2D(_MainTex, uv0).rgb;
    gl_FragColor =vec4(color, 1.0);
}
`;