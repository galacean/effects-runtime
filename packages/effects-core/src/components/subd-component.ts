/* eslint-disable no-console */
import { Color } from '@galacean/effects-math/es/core/color';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { Geometry, GLSLVersion } from '../render';
import { MeshComponent } from './mesh-component';
// 导入 Delaunator 库
import Delaunator from './delaunator';

@effectsClass('SubdComponent')
export class SubdComponent extends MeshComponent {
  private animated = false;

  private subdivisionLevel = 10; // 细分级别控制整体密度
  private wireframe = true; // 是否使用线框模式

  // TODO 占个位
  private vert = `
precision highp float;

attribute vec3 aPos;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;

varying vec3 vPos;

void main() {
  vPos = aPos;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
`;

  // 基础片段着色器
  private frag = `
precision highp float;

varying vec3 vPos;

void main() {
  // 使用位置作为颜色，以便更好地可视化三角形
  vec3 color = abs(fract(vPos * 0.5) * 2.0 - 1.0);
  
  gl_FragColor = vec4(color, 1.0);
}
`;

  constructor (engine: Engine) {
    super(engine);

    // 创建一个简单的正方形（4个顶点）
    if (!this.geometry) {
      // 定义正方形的4个顶点
      const vertices = [
        -0.5, -0.5, 0, // 左下
        0.5, -0.5, 0,  // 右下
        0.5, 0.5, 0,   // 右上
        -0.5, 0.5, 0,   // 左上
      ];

      // 定义UV坐标
      const uvs = [
        0, 0,  // 左下
        1, 0,  // 右下
        1, 1,  // 右上
        0, 1,   // 左上
      ];

      const indices = [];

      // 生成三角形索引
      // 每个网格由两个三角形组成
      indices.push(0, 1, 2);
      indices.push(2, 3, 0);

      this.geometry = Geometry.create(engine, {
        attributes: {
          aPos: {
            type: glContext.FLOAT,
            size: 3,
            data: new Float32Array(vertices),
          },
          aUV: {
            type: glContext.FLOAT,
            size: 2,
            data: new Float32Array(uvs),
          },
        },
        indices: { data: new Uint16Array(indices) },
        mode: glContext.TRIANGLES,
        drawCount: indices.length,
      });
    }

    // 创建材质
    if (!this.material) {
      const materialProps: MaterialProps = {
        shader: {
          vertex: this.vert,
          fragment: this.frag,
          glslVersion: GLSLVersion.GLSL1,
        },
      };

      this.material = Material.create(engine, materialProps);
      this.material.setColor('_Color', new Color(1, 1, 1, 1));
      this.material.depthMask = false;
      this.material.depthTest = true;
      this.material.blending = true;
    }
  }

  override onStart (): void {
    this.item.getHitTestParams = this.getHitTestParams;

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
    // 如果没有几何体，直接返回
    if (!this.geometry) {
      return;
    }

    // 获取原始几何体数据
    const originalPositions = this.geometry.getAttributeData('aPos');
    // 获取但不使用的变量添加下划线前缀
    const _originalUVs = this.geometry.getAttributeData('aUV');
    const _originalIndices = this.geometry.getIndexData();

    if (!originalPositions) {
      return;
    }

    // 如果细分级别为0，不执行细分，直接使用原始几何体
    if (this.subdivisionLevel <= 0) {
      return;
    }

    // 收集原始顶点（轮廓点）
    const originalVertices: Array<[number, number, number]> = [];

    for (let i = 0; i < originalPositions.length; i += 3) {
      originalVertices.push([
        originalPositions[i],
        originalPositions[i + 1],
        originalPositions[i + 2],
      ]);
    }

    // 泊松盘采样生成轮廓和内部顶点
    const poissonPoints = this.generatePoissonPoints();

    // 确保生成了足够的泊松采样点
    if (poissonPoints.length < 1 && this.subdivisionLevel > 1) {
      // 如果没有足够的泊松采样点，则使用原始几何体
      return;
    }

    // 步骤3：进行Delaunay三角剖分
    const indices = this.delaunay2D(poissonPoints);

    // 调试日志
    console.log('三角剖分点数:', poissonPoints.length);
    console.log('三角剖分生成的索引数:', indices.length);
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
      positions.push(point[0], point[1], 0);

      // 计算UV坐标（基于点的位置，归一化到0-1范围）
      const u = (point[0] + 0.5);
      const v = (point[1] + 0.5);

      uvs.push(u, v);
    }

    // 更新几何体
    this.geometry.setAttributeData('aPos', new Float32Array(positions));
    if (uvs.length > 0) {
      this.geometry.setAttributeData('aUV', new Float32Array(uvs));
    }

    // 根据线框模式决定索引和绘制模式
    if (this.wireframe) {
      // 创建线框索引
      const wireIndices: number[] = [];

      for (let i = 0; i < indices.length; i += 3) {
        // 三角形的三条边
        wireIndices.push(indices[i], indices[i + 1]);
        wireIndices.push(indices[i + 1], indices[i + 2]);
        wireIndices.push(indices[i + 2], indices[i]);
      }

      // 使用线框索引
      this.geometry.setIndexData(new Uint16Array(wireIndices));
      this.geometry.setDrawCount(wireIndices.length);

      // 设置为线框模式
      try {
        // 尝试直接设置绘制模式
        (this.geometry as any).mode = glContext.LINES;
      } catch (e) {
        console.warn('无法设置线框模式:', e);
      }
    } else {
      // 使用普通三角形索引
      this.geometry.setIndexData(new Uint16Array(indices));
      this.geometry.setDrawCount(indices.length);

      // 设置为三角形模式
      try {
        // 尝试直接设置绘制模式
        (this.geometry as any).mode = glContext.TRIANGLES;
      } catch (e) {
        console.warn('无法设置三角形模式:', e);
      }
    }
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

  // 泊松圆盘采样算法 - 改进版
  private generatePoissonPoints (): Array<[number, number]> {
    // 从原始几何体提取2D轮廓
    const contour: Array<[number, number]> = [];
    const originalPositions = this.geometry?.getAttributeData('aPos');

    if (!originalPositions) {
      return [];
    }

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
    // 增加点的数量，使内部点密度更高
    const numPoints = Math.max(10, this.subdivisionLevel * this.subdivisionLevel * 3);
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

