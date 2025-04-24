/* eslint-disable no-console */
import { EffectComponent } from './effect-component';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Geometry } from '../render';
import { Component } from './component';
import { createWireframeIndices } from '../utils/mesh-utils';

// Loop细分算法实现
// Loop算法是一种用于三角形网格的细分算法，通过添加新点和重新计算顶点位置来实现平滑细分

@effectsClass('LoopSubdComponent')
export class LoopSubdComponent extends Component {
  private animated = false;

  private subdivisionLevel = 1; // 细分级别
  private wireframe = false; // 是否使用线框模式

  // 存储EffectComponent引用
  private effectComponent: EffectComponent;

  constructor (engine: Engine) {
    super(engine);
  }

  override onStart (): void {
    // 获取EffectComponent
    this.effectComponent = this.item.getComponent(EffectComponent);

    if (!this.effectComponent || !this.effectComponent.geometry) {
      console.warn('LoopSubdComponent 需要 EffectComponent 才能工作');

      return;
    }

    if (this.subdivisionLevel > 0) {
      // 在组件启动时创建细分网格
      this.applyLoopSubdivision();
    }
  }

  override onUpdate (dt: number): void {
    // 如果需要动态更新，可以在这里添加逻辑
    if (this.animated) {
      this.applyLoopSubdivision();
      this.animated = false;
    }
  }

  /**
   * 应用Loop细分算法
   */
  private applyLoopSubdivision (): void {
    if (this.subdivisionLevel <= 0 || !this.effectComponent || !this.effectComponent.geometry) {
      return;
    }

    // 获取原始几何体数据
    const originalGeometry = this.effectComponent.geometry;
    const originalPositions = originalGeometry.getAttributeData('aPos');
    const originalIndices = originalGeometry.getIndexData();
    const originalUVs = originalGeometry.getAttributeData('aUV');

    if (!originalPositions || !originalIndices) {
      console.warn('细分网格需要顶点和索引数据');

      return;
    }

    // 转换位置数据为顶点数组，每个顶点是一个[x,y,z]数组
    const vertices: number[][] = [];

    for (let i = 0; i < originalPositions.length; i += 3) {
      vertices.push([
        originalPositions[i],
        originalPositions[i + 1],
        originalPositions[i + 2],
      ]);
    }

    // 转换索引数据为三角形数组，每个三角形是顶点索引的数组[a,b,c]
    const triangles: number[][] = [];

    for (let i = 0; i < originalIndices.length; i += 3) {
      triangles.push([
        originalIndices[i],
        originalIndices[i + 1],
        originalIndices[i + 2],
      ]);
    }

    // 转换UV数据为数组，如果存在
    const uvs: number[][] = [];

    if (originalUVs) {
      for (let i = 0; i < originalUVs.length; i += 2) {
        uvs.push([originalUVs[i], originalUVs[i + 1]]);
      }
    }

    // 应用多次细分
    let subdividedMesh = { vertices, triangles, uvs };

    for (let i = 0; i < this.subdivisionLevel; i++) {
      subdividedMesh = this.loopSubdivideOnce(subdividedMesh);
    }

    // 将结果转换回几何体数据格式
    const newPositions: number[] = [];

    subdividedMesh.vertices.forEach(v => {
      newPositions.push(v[0], v[1], v[2]);
    });

    const newIndices: number[] = [];

    subdividedMesh.triangles.forEach(t => {
      newIndices.push(t[0], t[1], t[2]);
    });

    const newUVs: number[] = [];

    subdividedMesh.uvs.forEach(uv => {
      newUVs.push(uv[0], uv[1]);
    });

    // 创建新的几何体
    const newGeometry = Geometry.create(
      this.engine,
      {
        attributes: {
          aPos: {
            size: 3,
            data: new Float32Array(newPositions),
          },
          aUV: {
            size: 2,
            data: new Float32Array(newUVs),
          },
        },
        indices: this.wireframe
          ? { data: new Uint16Array(createWireframeIndices(newIndices)) }
          : { data: new Uint16Array(newIndices) },
        mode: this.wireframe ? glContext.LINES : glContext.TRIANGLES,
        drawCount: this.wireframe ? createWireframeIndices(newIndices).length : newIndices.length,
      }
    );

    // 替换 effectComponent 的几何体引用
    this.effectComponent.geometry = newGeometry;
  }

  /**
   * 执行单次Loop细分
   */
  private loopSubdivideOnce (mesh: { vertices: number[][], triangles: number[][], uvs: number[][] }): { vertices: number[][], triangles: number[][], uvs: number[][] } {
    const { vertices, triangles, uvs } = mesh;

    // 创建边哈希表用于查找共享边
    const edgeMap = new Map<string, number>();
    const edgeVertices: number[][] = [];
    const edgeUVs: number[][] = [];

    // 1. 为每条边创建新的中点顶点
    triangles.forEach(triangle => {
      for (let i = 0; i < 3; i++) {
        const v1 = triangle[i];
        const v2 = triangle[(i + 1) % 3];

        // 确保边的顺序一致性（小索引在前）
        const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;

        if (!edgeMap.has(edgeKey)) {
          // 计算边的中点位置（Loop算法中需要考虑相邻面的影响）
          const midpoint = [
            (vertices[v1][0] + vertices[v2][0]) / 2,
            (vertices[v1][1] + vertices[v2][1]) / 2,
            (vertices[v1][2] + vertices[v2][2]) / 2,
          ];

          // 计算中点的UV坐标
          const midUV = uvs.length > 0 ? [
            (uvs[v1][0] + uvs[v2][0]) / 2,
            (uvs[v1][1] + uvs[v2][1]) / 2,
          ] : [0, 0];

          // 存储新顶点的索引
          edgeMap.set(edgeKey, vertices.length + edgeVertices.length);
          edgeVertices.push(midpoint);
          edgeUVs.push(midUV);
        }
      }
    });

    // 2. 调整原始顶点的位置（Loop算法的平滑规则）
    const newVertices = [...vertices.map(v => [...v])]; // 深拷贝原始顶点

    // 计算每个顶点的相邻顶点
    const vertexNeighbors: number[][] = vertices.map(() => []);

    triangles.forEach(triangle => {
      for (let i = 0; i < 3; i++) {
        const v1 = triangle[i];
        const v2 = triangle[(i + 1) % 3];
        const v3 = triangle[(i + 2) % 3];

        // 添加相邻顶点（如果还没有添加）
        if (!vertexNeighbors[v1].includes(v2)) {vertexNeighbors[v1].push(v2);}
        if (!vertexNeighbors[v1].includes(v3)) {vertexNeighbors[v1].push(v3);}
      }
    });

    // 应用Loop算法的顶点更新规则
    for (let i = 0; i < vertices.length; i++) {
      const neighbors = vertexNeighbors[i];
      const n = neighbors.length;

      if (n > 0) {
        // 计算beta值（Loop算法中的权重参数）
        const beta = n > 3
          ? 3 / (8 * n)
          : (n === 3 ? 3 / 16 : 0);

        // 计算新位置
        const newPos = [0, 0, 0];

        // 原始顶点权重
        const selfWeight = 1 - n * beta;

        newPos[0] = vertices[i][0] * selfWeight;
        newPos[1] = vertices[i][1] * selfWeight;
        newPos[2] = vertices[i][2] * selfWeight;

        // 相邻顶点贡献
        for (const neighborIdx of neighbors) {
          newPos[0] += vertices[neighborIdx][0] * beta;
          newPos[1] += vertices[neighborIdx][1] * beta;
          newPos[2] += vertices[neighborIdx][2] * beta;
        }

        newVertices[i] = newPos;
      }
    }

    // 3. 合并所有顶点和UV
    const resultVertices = [...newVertices, ...edgeVertices];
    const resultUVs = [...uvs, ...edgeUVs];

    // 4. 创建新的三角形
    const resultTriangles: number[][] = [];

    triangles.forEach(triangle => {
      const [v1, v2, v3] = triangle;

      // 获取三条边上的中点顶点索引
      const e1 = edgeMap.get(v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`);
      const e2 = edgeMap.get(v2 < v3 ? `${v2}-${v3}` : `${v3}-${v2}`);
      const e3 = edgeMap.get(v3 < v1 ? `${v3}-${v1}` : `${v1}-${v3}`);

      if (e1 === undefined || e2 === undefined || e3 === undefined) {
        console.error('细分算法错误：找不到边的中点');

        return mesh;
      }

      // 每个原始三角形被分为四个新三角形
      resultTriangles.push([v1, e1, e3]);  // 第一个新三角形
      resultTriangles.push([e1, v2, e2]);  // 第二个新三角形
      resultTriangles.push([e3, e2, v3]);  // 第三个新三角形
      resultTriangles.push([e1, e2, e3]);  // 第四个新三角形（中间）
    });

    return {
      vertices: resultVertices,
      triangles: resultTriangles,
      uvs: resultUVs,
    };
  }
}

