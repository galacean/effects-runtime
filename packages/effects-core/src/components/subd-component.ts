import { Color } from '@galacean/effects-math/es/core/color';
import type * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import type { MaterialProps } from '../material';
import { Material } from '../material';
import { Geometry, GLSLVersion } from '../render';
import { MeshComponent } from './mesh-component';

// TODO 临时本地声明，提供给编辑器
interface SubdComponentData extends spec.ComponentData {
  subdivisionLevel?: number, // 细分级别
}

@effectsClass('SubdComponent')
export class SubdComponent extends MeshComponent {
  private data: SubdComponentData;
  private subdivisionLevel = 1; // 默认细分级别
  private animated = false;

  // 泊松采样的最小距离
  private minDistance = 0.1;

  //! DEBUG 是否显示线框模式
  private wireframeMode = true;

  // FFD 顶点着色器
  private vert = `
precision highp float;

attribute vec3 aPos;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;

void main() {
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
`;

  // 基础片段着色器
  private frag = `
precision highp float;

void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
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

  override fromData (data: SubdComponentData): void {
    super.fromData(data);
    this.data = data;

    // 更新细分级别
    if (this.data.subdivisionLevel !== undefined && this.data.subdivisionLevel !== this.subdivisionLevel) {
      this.subdivisionLevel = this.data.subdivisionLevel;
      this.createSubdividedMesh();
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

    // 收集原始顶点
    const originalVertices: Array<[number, number, number]> = [];

    for (let i = 0; i < originalPositions.length; i += 3) {
      originalVertices.push([
        originalPositions[i],
        originalPositions[i + 1],
        originalPositions[i + 2],
      ]);
    }

    // 生成泊松采样点（仅在正方形内生成额外的点）
    const poissonPoints = this.generatePoissonPoints();

    // 确保生成了足够的泊松采样点
    if (poissonPoints.length < 1) {
      // 如果没有足够的泊松采样点，则使用原始几何体
      return;
    }

    // 将所有点合并起来
    const allPoints: Array<[number, number, number]> = [...originalVertices];

    // 添加泊松采样点（z坐标为0）
    for (const point of poissonPoints) {
      allPoints.push([point[0], point[1], 0]);
    }

    // 直接使用四个角点和泊松采样点进行三角剖分，不使用delaunay2D方法
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // 添加所有顶点和UV
    for (let i = 0; i < allPoints.length; i++) {
      const point = allPoints[i];

      positions.push(point[0], point[1], point[2]);

      // 计算UV（基于点的位置）
      const u = (point[0] + 0.5);
      const v = (point[1] + 0.5);

      uvs.push(u, v);
    }

    // 使用原始四个顶点（矩形四角）和内部的泊松采样点创建三角形
    // 这里使用简单的方法：将每个泊松采样点与矩形的四个角连接形成三角形
    if (originalVertices.length >= 4) {
      // 首先添加矩形本身的两个三角形
      indices.push(0, 1, 2); // 第一个三角形
      indices.push(2, 3, 0); // 第二个三角形

      // 然后将每个泊松采样点与四个角相连
      for (let i = 4; i < allPoints.length; i++) {
        // 与四个角点相连
        indices.push(0, 1, i);
        indices.push(1, 2, i);
        indices.push(2, 3, i);
        indices.push(3, 0, i);
      }
    }

    // 更新几何体
    this.geometry.setAttributeData('aPos', new Float32Array(positions));

    if (uvs.length > 0) {
      this.geometry.setAttributeData('aUV', new Float32Array(uvs));
    }

    this.geometry.setIndexData(new Uint16Array(indices));
    this.geometry.setDrawCount(indices.length);

    //! DEBUG 如果当前是线框模式，转换为线条渲染
    if (this.wireframeMode) {
      this.convertTrianglesToLines();
    }
  }

  private performDelaunayTriangulation (
    vertices: Array<[number, number, number]>,
    faces: Array<[number, number, number]>
  ): { positions: number[], indices: number[] } {
    // 最终结果
    const resultPositions: number[] = [];
    const resultIndices: number[] = [];

    // 处理每个三角形面
    for (const face of faces) {
      // 获取当前面的三个顶点
      const v1 = vertices[face[0]];
      const v2 = vertices[face[1]];
      const v3 = vertices[face[2]];

      // 为当前面执行Delaunay细分
      const subdivided = this.subdivideTriangle(v1, v2, v3, this.subdivisionLevel);

      // 记录当前结果中的顶点数量（作为索引偏移量）
      const indexOffset = resultPositions.length / 3;

      // 添加顶点
      for (const pos of subdivided.positions) {
        resultPositions.push(pos[0], pos[1], pos[2]);
      }

      // 添加索引（需要调整索引值）
      for (const idx of subdivided.indices) {
        resultIndices.push(idx + indexOffset);
      }
    }

    return { positions: resultPositions, indices: resultIndices };
  }

  private subdivideTriangle (
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    level: number
  ): { positions: Array<[number, number, number]>, indices: number[] } {
    // 如果细分级别为0，直接返回原始三角形
    if (level <= 0) {
      return {
        positions: [v1, v2, v3],
        indices: [0, 1, 2],
      };
    }

    // 计算三角形的法向量以获取投影平面
    const normal = this.calculateNormal(v1, v2, v3);

    // 创建投影平面的基向量
    const basis = this.createBasisVectors(normal);

    // 将3D顶点投影到2D平面
    const points2D: Array<[number, number]> = [
      this.projectPointTo2D(v1, basis),
      this.projectPointTo2D(v2, basis),
      this.projectPointTo2D(v3, basis),
    ];

    // 创建更多点进行细分
    const additionalPoints: Array<[number, number]> = [];

    // 根据细分级别添加三角形边上的点
    for (let i = 1; i < level; i++) {
      const t = i / level;

      // 边1上的点
      additionalPoints.push([
        points2D[0][0] * (1 - t) + points2D[1][0] * t,
        points2D[0][1] * (1 - t) + points2D[1][1] * t,
      ]);

      // 边2上的点
      additionalPoints.push([
        points2D[1][0] * (1 - t) + points2D[2][0] * t,
        points2D[1][1] * (1 - t) + points2D[2][1] * t,
      ]);

      // 边3上的点
      additionalPoints.push([
        points2D[2][0] * (1 - t) + points2D[0][0] * t,
        points2D[2][1] * (1 - t) + points2D[0][1] * t,
      ]);
    }

    // 添加三角形内部的点
    if (level > 1) {
      for (let i = 1; i < level; i++) {
        for (let j = 1; j < level - i; j++) {
          const a = i / level;
          const b = j / level;
          const c = 1 - a - b;

          additionalPoints.push([
            points2D[0][0] * a + points2D[1][0] * b + points2D[2][0] * c,
            points2D[0][1] * a + points2D[1][1] * b + points2D[2][1] * c,
          ]);
        }
      }
    }

    // 合并所有2D点
    const allPoints2D = [...points2D, ...additionalPoints];

    // 执行2D Delaunay三角剖分
    const delaunay = this.delaunay2D(allPoints2D);

    // 将2D点投影回3D
    const positions: Array<[number, number, number]> = [];

    for (const point of allPoints2D) {
      positions.push(this.projectPointTo3D(point, v1, basis));
    }

    return { positions, indices: delaunay };
  }

  private calculateNormal (
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number]
  ): [number, number, number] {
    // 计算两个边向量
    const edge1: [number, number, number] = [
      v2[0] - v1[0],
      v2[1] - v1[1],
      v2[2] - v1[2],
    ];

    const edge2: [number, number, number] = [
      v3[0] - v1[0],
      v3[1] - v1[1],
      v3[2] - v1[2],
    ];

    // 计算叉积
    const normal: [number, number, number] = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0],
    ];

    // 归一化
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);

    return [
      normal[0] / length,
      normal[1] / length,
      normal[2] / length,
    ];
  }

  private createBasisVectors (normal: [number, number, number]): {
    u: [number, number, number],
    v: [number, number, number],
  } {
    // 创建与法线垂直的两个基向量
    let u: [number, number, number];

    // 选择与法线不平行的向量
    if (Math.abs(normal[0]) < Math.abs(normal[1]) && Math.abs(normal[0]) < Math.abs(normal[2])) {
      u = [1, 0, 0];
    } else if (Math.abs(normal[1]) < Math.abs(normal[2])) {
      u = [0, 1, 0];
    } else {
      u = [0, 0, 1];
    }

    // 计算叉积得到第一个基向量
    const ux = normal[1] * u[2] - normal[2] * u[1];
    const uy = normal[2] * u[0] - normal[0] * u[2];
    const uz = normal[0] * u[1] - normal[1] * u[0];

    // 归一化
    const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);

    u = [ux / uLen, uy / uLen, uz / uLen];

    // 计算第二个基向量（叉积）
    const vx = normal[1] * u[2] - normal[2] * u[1];
    const vy = normal[2] * u[0] - normal[0] * u[2];
    const vz = normal[0] * u[1] - normal[1] * u[0];

    // 归一化
    const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const v: [number, number, number] = [vx / vLen, vy / vLen, vz / vLen];

    return { u, v };
  }

  private projectPointTo2D (
    point: [number, number, number],
    basis: { u: [number, number, number], v: [number, number, number] }
  ): [number, number] {
    // 将3D点投影到2D平面
    const u = basis.u;
    const v = basis.v;

    const x = point[0] * u[0] + point[1] * u[1] + point[2] * u[2];
    const y = point[0] * v[0] + point[1] * v[1] + point[2] * v[2];

    return [x, y];
  }

  private projectPointTo3D (
    point2D: [number, number],
    originPoint: [number, number, number],
    basis: { u: [number, number, number], v: [number, number, number] }
  ): [number, number, number] {
    // 将2D点投影回3D空间
    const u = basis.u;
    const v = basis.v;

    // 计算3D坐标
    const x = originPoint[0] + point2D[0] * u[0] + point2D[1] * v[0];
    const y = originPoint[1] + point2D[0] * u[1] + point2D[1] * v[1];
    const z = originPoint[2] + point2D[0] * u[2] + point2D[1] * v[2];

    return [x, y, z];
  }

  private delaunay2D (points: Array<[number, number]>): number[] {
    // 简单的Delaunay三角剖分实现
    const indices: number[] = [];

    // 如果点太少，直接返回
    if (points.length < 3) {
      return indices;
    }

    // 创建超级三角形（足够大以包含所有点）
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }

    const dx = (maxX - minX) * 10;
    const dy = (maxY - minY) * 10;

    const superTriangle: Array<[number, number]> = [
      [minX - dx, minY - dy],
      [maxX + dx, minY - dy],
      [minX + (maxX - minX) / 2, maxY + dy],
    ];

    // 所有点（包括超级三角形的点）
    const allPoints = [...superTriangle, ...points];

    // 三角形列表，每个三角形是三个顶点索引
    const triangles: Array<[number, number, number]> = [[0, 1, 2]];

    // 逐个插入点
    for (let i = 3; i < allPoints.length; i++) {
      const point = allPoints[i];

      // 保存边的列表
      const edges: Array<[number, number]> = [];

      // 检查每个现有三角形
      for (let j = triangles.length - 1; j >= 0; j--) {
        const triangle = triangles[j];

        // 三角形的三个顶点
        const v1 = allPoints[triangle[0]];
        const v2 = allPoints[triangle[1]];
        const v3 = allPoints[triangle[2]];

        // 检查点是否在三角形的外接圆内
        if (this.isPointInCircumcircle(point, v1, v2, v3)) {
          // 保存三角形的边
          edges.push([triangle[0], triangle[1]]);
          edges.push([triangle[1], triangle[2]]);
          edges.push([triangle[2], triangle[0]]);

          // 移除这个三角形
          triangles.splice(j, 1);
        }
      }

      // 找出唯一的边（不重复的边）
      const uniqueEdges: Array<[number, number]> = [];

      for (let j = 0; j < edges.length; j++) {
        let isUnique = true;

        for (let k = 0; k < edges.length; k++) {
          if (j !== k) {
            if ((edges[j][0] === edges[k][1] && edges[j][1] === edges[k][0]) ||
              (edges[j][0] === edges[k][0] && edges[j][1] === edges[k][1])) {
              isUnique = false;

              break;
            }
          }
        }

        if (isUnique) {
          uniqueEdges.push(edges[j]);
        }
      }

      // 使用唯一边和当前点创建新三角形
      for (const edge of uniqueEdges) {
        triangles.push([edge[0], edge[1], i]);
      }
    }

    // 移除包含超级三角形顶点的三角形
    for (let i = triangles.length - 1; i >= 0; i--) {
      const t = triangles[i];

      if (t[0] < 3 || t[1] < 3 || t[2] < 3) {
        triangles.splice(i, 1);
      }
    }

    // 调整索引（减去超级三角形顶点的数量）
    for (const triangle of triangles) {
      indices.push(triangle[0] - 3, triangle[1] - 3, triangle[2] - 3);
    }

    return indices;
  }

  private isPointInCircumcircle (
    p: [number, number],
    a: [number, number],
    b: [number, number],
    c: [number, number]
  ): boolean {
    const abSq = Math.pow(a[0], 2) + Math.pow(a[1], 2);
    const cdSq = Math.pow(b[0], 2) + Math.pow(b[1], 2);
    const efSq = Math.pow(c[0], 2) + Math.pow(c[1], 2);

    const circum = [
      [a[0], a[1], abSq, 1],
      [b[0], b[1], cdSq, 1],
      [c[0], c[1], efSq, 1],
      [p[0], p[1], Math.pow(p[0], 2) + Math.pow(p[1], 2), 1],
    ];

    const det = this.determinant4x4(circum);

    return det < 0;
  }

  private determinant4x4 (matrix: number[][]): number {
    const n11 = matrix[0][0], n12 = matrix[0][1], n13 = matrix[0][2], n14 = matrix[0][3];
    const n21 = matrix[1][0], n22 = matrix[1][1], n23 = matrix[1][2], n24 = matrix[1][3];
    const n31 = matrix[2][0], n32 = matrix[2][1], n33 = matrix[2][2], n34 = matrix[2][3];
    const n41 = matrix[3][0], n42 = matrix[3][1], n43 = matrix[3][2], n44 = matrix[3][3];

    return (
      n14 * n23 * n32 * n41 - n13 * n24 * n32 * n41 - n14 * n22 * n33 * n41 + n12 * n24 * n33 * n41 +
      n13 * n22 * n34 * n41 - n12 * n23 * n34 * n41 - n14 * n23 * n31 * n42 + n13 * n24 * n31 * n42 +
      n14 * n21 * n33 * n42 - n11 * n24 * n33 * n42 - n13 * n21 * n34 * n42 + n11 * n23 * n34 * n42 +
      n14 * n22 * n31 * n43 - n12 * n24 * n31 * n43 - n14 * n21 * n32 * n43 + n11 * n24 * n32 * n43 +
      n12 * n21 * n34 * n43 - n11 * n22 * n34 * n43 - n13 * n22 * n31 * n44 + n12 * n23 * n31 * n44 +
      n13 * n21 * n32 * n44 - n11 * n23 * n32 * n44 - n12 * n21 * n33 * n44 + n11 * n22 * n33 * n44
    );
  }

  // 泊松圆盘采样算法
  private generatePoissonPoints (): Array<[number, number]> {
    // 根据细分级别计算需要生成的点数
    const numPoints = Math.max(4, this.subdivisionLevel * this.subdivisionLevel * 2);

    // 泊松圆盘采样的参数
    const minDist = this.minDistance;
    const width = 1.0; // 正方形宽度
    const height = 1.0; // 正方形高度
    const cellSize = minDist / Math.sqrt(2);

    // 结果数组
    const result: Array<[number, number]> = [];

    // 活动点列表
    const activePoints: Array<[number, number]> = [];

    // 网格
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const grid: number[][] = new Array(cols).fill(0).map(() => new Array(rows).fill(-1));

    // 添加第一个随机点
    const firstPoint: [number, number] = [
      Math.random() * width - width / 2,
      Math.random() * height - height / 2,
    ];

    const col = Math.floor((firstPoint[0] + width / 2) / cellSize);
    const row = Math.floor((firstPoint[1] + height / 2) / cellSize);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      grid[col][row] = 0;
      activePoints.push(firstPoint);
      result.push(firstPoint);
    }

    // 主循环
    while (activePoints.length > 0 && result.length < numPoints) {
      // 随机选择一个活动点
      const randomIndex = Math.floor(Math.random() * activePoints.length);
      const point = activePoints[randomIndex];

      // 尝试生成新点
      let found = false;

      for (let i = 0; i < 30; i++) { // 每个点尝试30次
        // 在点周围的圆环生成随机点
        const angle = Math.random() * Math.PI * 2;
        const radius = minDist + Math.random() * minDist;

        const newPoint: [number, number] = [
          point[0] + Math.cos(angle) * radius,
          point[1] + Math.sin(angle) * radius,
        ];

        // 检查新点是否在边界内
        if (newPoint[0] < -width / 2 || newPoint[0] >= width / 2 ||
            newPoint[1] < -height / 2 || newPoint[1] >= height / 2) {
          continue;
        }

        // 计算网格位置
        const newCol = Math.floor((newPoint[0] + width / 2) / cellSize);
        const newRow = Math.floor((newPoint[1] + height / 2) / cellSize);

        if (newCol < 0 || newCol >= cols || newRow < 0 || newRow >= rows) {
          continue;
        }

        // 检查与已有点的距离
        let valid = true;

        // 检查周围的网格
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            const checkCol = newCol + dc;
            const checkRow = newRow + dr;

            if (checkCol >= 0 && checkCol < cols && checkRow >= 0 && checkRow < rows) {
              const index = grid[checkCol][checkRow];

              if (index !== -1) {
                const existingPoint = result[index];
                const dx = newPoint[0] - existingPoint[0];
                const dy = newPoint[1] - existingPoint[1];
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) {
                  valid = false;

                  break;
                }
              }
            }
          }

          if (!valid) {
            break;
          }
        }

        if (valid) {
          // 添加新点
          grid[newCol][newRow] = result.length;
          activePoints.push(newPoint);
          result.push(newPoint);
          found = true;

          break;
        }
      }

      // 如果没有找到有效点，从活动列表中移除
      if (!found) {
        activePoints.splice(randomIndex, 1);
      }
    }

    return result;
  }

  //! DEBUG ================== 线框模式 ==================

  // 设置线框模式
  setWireframeMode (enabled: boolean): void {
    this.wireframeMode = enabled;
    this.updateRenderMode();
  }

  // 切换线框模式
  toggleWireframeMode (): void {
    this.wireframeMode = !this.wireframeMode;
    this.updateRenderMode();
  }

  // 更新渲染模式
  private updateRenderMode (): void {
    if (!this.geometry) {
      return;
    }

    if (this.wireframeMode) {
      // 线框模式 - 用线条渲染
      // 获取当前几何体的数据
      const indices = this.geometry.getIndexData();

      if (!indices) {
        return;
      }

      // 如果当前是三角形渲染模式，需要转换为线条索引
      this.convertTrianglesToLines();
    } else {
      // 普通模式 - 用三角形渲染
      // 重新创建几何体以恢复三角形模式
      this.createSubdividedMesh();
    }
  }

  // 将三角形索引转换为线条索引
  private convertTrianglesToLines (): void {
    if (!this.geometry) {
      return;
    }

    const indices = this.geometry.getIndexData();
    const positions = this.geometry.getAttributeData('aPos');
    const uvs = this.geometry.getAttributeData('aUV');

    if (!indices || !positions || !uvs) {
      return;
    }

    // 创建线条索引
    const lineIndices = [];

    // 遍历三角形，为每条边创建线条索引
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      // 添加三角形的三条边
      lineIndices.push(i0, i1); // 边1
      lineIndices.push(i1, i2); // 边2
      lineIndices.push(i2, i0); // 边3
    }

    // 创建一个新的几何体，使用线条绘制模式
    this.geometry = Geometry.create(this.engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
          size: 3,
          data: new Float32Array(positions),
        },
        aUV: {
          type: glContext.FLOAT,
          size: 2,
          data: new Float32Array(uvs),
        },
      },
      indices: { data: new Uint16Array(lineIndices) },
      mode: glContext.LINES,
      drawCount: lineIndices.length,
    });
  }
}

