/* eslint-disable no-console */
import type * as spec from '@galacean/effects-specification';
import { EffectComponent } from './effect-component';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Geometry } from '../render';
import { Component } from './component';
// 导入 Delaunator 库
import Delaunator from './delaunator';

// TODO 改到编辑时做，现在是运行时细分的。
// TODO 细分算法还有问题

@effectsClass('SubdComponent')
export class SubdComponent extends Component {
  private animated = false;

  private subdivisionLevel = 4; // 细分级别控制整体密度
  private wireframe = true; // 是否使用线框模式

  // 存储EffectComponent引用
  private effectComponent: EffectComponent;

  constructor (engine: Engine) {
    super(engine);
  }

  override onStart (): void {
    // 获取EffectComponent
    this.effectComponent = this.item.getComponent(EffectComponent);

    if (!this.effectComponent || !this.effectComponent.geometry) {
      console.warn('SubdComponent 需要 EffectComponent 才能工作');

      return;
    }

    if (this.subdivisionLevel > 0) {
      // 在组件启动时创建细分网格
      this.createSubdividedMesh();
    }
  }

  override onUpdate (dt: number): void {
    // 如果需要动态更新，可以在这里添加逻辑
    if (this.animated) {
      this.createSubdividedMesh();
      this.animated = false;
    }
  }

  private createSubdividedMesh (): void {
    // 如果细分级别为0，不执行细分，直接使用原始几何体
    if (this.subdivisionLevel <= 0) {
      return;
    }

    // 如果没有EffectComponent或几何体，直接返回
    if (!this.effectComponent || !this.effectComponent.geometry) {
      return;
    }

    // 获取原始几何体数据
    const originalPositions = this.effectComponent.geometry.getAttributeData('aPos');

    console.log(originalPositions);

    if (!originalPositions) {
      return;
    }

    // TODO 这里有问题，得到的 _originalIndices 非常奇怪。但应该不影响
    // const _originalIndices = originalGeometry.getIndexData();
    // console.log(_originalIndices);

    // 泊松盘采样生成轮廓和内部顶点
    const poissonPoints = this.generatePoissonPoints(originalPositions);

    console.log(poissonPoints);

    // 确保生成了足够的泊松采样点
    if (poissonPoints.length < 1 && this.subdivisionLevel > 1) {
      // 如果没有足够的泊松采样点，则使用原始几何体
      return;
    }

    // 步骤3：进行Delaunay三角剖分
    const indices = this.delaunay2D(poissonPoints);

    // 调试日志
    console.log('顶点:', poissonPoints);
    console.log('索引:', indices);
    console.log('三角形数量:', indices.length / 3);

    // 检查生成的三角形索引是否有效
    let invalidIndex = false;

    for (let i = 0; i < indices.length; i++) {
      if (indices[i] >= poissonPoints.length) {
        console.error(`发现无效索引: ${indices[i]}, 点总数: ${poissonPoints.length}`);
        invalidIndex = true;

        break;
      }
    }

    if (invalidIndex) {
      console.error('三角剖分生成了无效索引，请检查delaunay2D方法');
    }

    // 如果三角剖分失败或没有产生任何三角形，返回
    if (indices.length < 3) {
      return;
    }

    // 准备最终的顶点和UV数据
    const positions: number[] = [];
    const uvs: number[] = [];

    // 对所有点添加顶点和UV坐标
    for (const point of poissonPoints) {
      // 顶点坐标（z=0，因为我们是在2D平面上工作）
      // TODO 改成3D
      positions.push(point[0], point[1], 0);

      // 计算UV坐标（基于点的位置，归一化到0-1范围）
      const u = (point[0] + 0.5);
      const v = (point[1] + 0.5);

      uvs.push(u, v);
    }

    console.log(positions);

    // 创建新的几何体，而不是直接修改原始几何体
    // 使用 Geometry.create 创建新的几何体
    const newGeometry = Geometry.create(
      this.engine,
      {
        attributes: {
          aPos: {
            size: 3,
            data: new Float32Array(positions),
          },
          aUV: {
            size: 2,
            data: new Float32Array(uvs),
          },
        },
        indices: this.wireframe
          ? { data: new Uint16Array(this.createWireframeIndices(indices)) }
          : { data: new Uint16Array(indices) },
        mode: this.wireframe ? glContext.LINES : glContext.TRIANGLES,
        drawCount: this.wireframe ? this.createWireframeIndices(indices).length : indices.length,
      }
    );

    // 替换 effectComponent 的几何体引用
    this.effectComponent.geometry = newGeometry;
  }

  // 辅助方法：创建线框索引
  private createWireframeIndices (triangleIndices: number[]): number[] {
    const wireIndices: number[] = [];

    for (let i = 0; i < triangleIndices.length; i += 3) {
      // 三角形的三条边
      wireIndices.push(triangleIndices[i], triangleIndices[i + 1]);
      wireIndices.push(triangleIndices[i + 1], triangleIndices[i + 2]);
      wireIndices.push(triangleIndices[i + 2], triangleIndices[i]);
    }

    return wireIndices;
  }

  private delaunay2D (points: Array<[number, number]>): number[] {
    // 如果点太少，直接返回
    if (points.length < 3) {
      return [];
    }

    try {
      // 为 Delaunator 转换点格式为平坦数组 [x0, y0, x1, y1, ...]
      const flatCoords: number[] = [];

      for (const point of points) {
        flatCoords.push(point[0], point[1]);
      }

      // 使用 Delaunator 进行三角剖分
      const delaunator = new Delaunator(flatCoords);

      // 确保三角形数据存在
      if (!delaunator.triangles || delaunator.triangles.length === 0) {
        console.warn('Delaunator did not generate any triangles');

        return [];
      }

      // 这里我们直接使用 delaunator.triangles
      // 它已经是一个包含三角形顶点索引的数组，索引是按照三个一组表示一个三角形
      // 索引格式与原算法相同，都是从0开始的顶点索引
      const indices: number[] = Array.from(delaunator.triangles);

      return indices;
    } catch (e) {
      console.error('Delaunay triangulation failed:', e);

      // 如果 Delaunator 失败了，返回空数组
      return [];
    }
  }

  // 判断点是否在多边形内（射线法）
  private pointInPolygon (point: [number, number], contour: Array<[number, number]>): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const xi = contour[i][0];
      const yi = contour[i][1];
      const xj = contour[j][0];
      const yj = contour[j][1];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-10) + xi;

      if (intersect) { inside = !inside; }
    }

    return inside;
  }

  // 获取点集的边界
  private getBounds (points: Array<[number, number]>): [number, number, number, number] {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p[0] < minX) { minX = p[0]; }
      if (p[1] < minY) { minY = p[1]; }
      if (p[0] > maxX) { maxX = p[0]; }
      if (p[1] > maxY) { maxY = p[1]; }
    }

    return [minX, minY, maxX, maxY];
  }

  // 泊松圆盘采样算法
  private generatePoissonPoints (originalPositions: spec.TypedArray): Array<[number, number]> {
    if (!originalPositions) {
      return [];
    }

    // 从原始几何体提取2D轮廓
    const contour: Array<[number, number]> = [];

    for (let i = 0; i < originalPositions.length; i += 3) {
      contour.push([originalPositions[i], originalPositions[i + 1]]);
    }

    // 如果轮廓太小，返回空数组
    if (contour.length < 3) {
      return [];
    }

    // 获取多边形的边界
    const [minX, minY, maxX, maxY] = this.getBounds(contour);

    // 基于细分级别计算需要的点数和采样半径
    // TODO 这个函数要线性还是非线性？
    const numPoints = this.subdivisionLevel * this.subdivisionLevel * 3;
    const radius = Math.sqrt(((maxX - minX) * (maxY - minY)) / numPoints);
    const cellSize = radius / Math.sqrt(2);

    // 结果和活动点数组
    const points: Array<[number, number]> = [];
    const active: Array<[number, number]> = [];

    // 计算网格维度
    const gridWidth = Math.ceil((maxX - minX) / cellSize);
    const gridHeight = Math.ceil((maxY - minY) / cellSize);
    const grid = new Array(gridWidth * gridHeight).fill(null);

    // 工具函数：将点映射到网格索引
    const getGridIndex = (p: [number, number]): number => {
      const i = Math.floor((p[0] - minX) / cellSize);
      const j = Math.floor((p[1] - minY) / cellSize);

      return i + j * gridWidth;
    };

    // 工具函数：检查点是否满足最小距离条件
    const isValidPoint = (p: [number, number]): boolean => {
      const [x, y] = p;
      const gridX = Math.floor((x - minX) / cellSize);
      const gridY = Math.floor((y - minY) / cellSize);

      // 检查周围邻近网格
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const neighborIndex = gridX + i + (gridY + j) * gridWidth;

          if (neighborIndex < 0 || neighborIndex >= grid.length) { continue; }
          const neighbor = grid[neighborIndex];

          if (neighbor) {
            const [nx, ny] = neighbor;
            const distanceSquared = (nx - x) ** 2 + (ny - y) ** 2;

            if (distanceSquared < radius * radius) { return false; }
          }
        }
      }

      return true;
    };

    // 添加轮廓点
    const borderPoints: Array<[number, number]> = [];

    // 外轮廓细分 - 与内部点保持一致的密度
    contour.forEach((point1, index) => {
      const point2 = contour[(index + 1) % contour.length];
      const dx = point2[0] - point1[0];
      const dy = point2[1] - point1[1];
      const edgeLength = Math.sqrt(dx * dx + dy * dy);
      // 使用radius作为边上点的间距，确保与内部点密度一致
      const numSamples = Math.max(1, Math.ceil(edgeLength / radius));

      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const x = point1[0] + t * dx;
        const y = point1[1] + t * dy;

        borderPoints.push([x, y]);
      }
    });

    // 将边界点加入网格
    borderPoints.forEach(point => {
      points.push(point);
      const gridIndex = getGridIndex(point);

      grid[gridIndex] = point;
    });

    // 添加初始点
    let firstPoint: [number, number];
    let attempts = 0;
    const maxAttempts = 100;

    do {
      firstPoint = [
        Math.random() * (maxX - minX) + minX,
        Math.random() * (maxY - minY) + minY,
      ];
      attempts++;
      if (attempts > maxAttempts) {
        // 如果找不到合适的初始点，直接返回边界点
        return points;
      }
    } while (!this.pointInPolygon(firstPoint, contour) || !isValidPoint(firstPoint));

    points.push(firstPoint);
    active.push(firstPoint);
    grid[getGridIndex(firstPoint)] = firstPoint;

    // 主循环：泊松盘采样内部点
    // k是每个候选点尝试的次数
    const k = 30;

    while (active.length > 0 && points.length < numPoints) {
      const activeIndex = Math.floor(Math.random() * active.length);
      const activePoint = active[activeIndex];
      let found = false;

      for (let i = 0; i < k; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const distance = radius * (Math.random() + 1); // 半径到2*半径之间随机
        const newPoint: [number, number] = [
          activePoint[0] + distance * Math.cos(angle),
          activePoint[1] + distance * Math.sin(angle),
        ];

        // 确保点在多边形内并满足最小距离条件
        if (
          newPoint[0] >= minX &&
          newPoint[0] <= maxX &&
          newPoint[1] >= minY &&
          newPoint[1] <= maxY &&
          this.pointInPolygon(newPoint, contour) &&
          isValidPoint(newPoint)
        ) {
          points.push(newPoint);
          active.push(newPoint);
          grid[getGridIndex(newPoint)] = newPoint;
          found = true;

          break;
        }
      }
      // 如果未找到符合条件的新点，从活跃点列表中移除
      if (!found) {
        active.splice(activeIndex, 1);
      }
    }

    return points;
  }
}

