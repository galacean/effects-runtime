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
  private subdivisionLevel = 1; // 细分级别
  private wireframe = false; // 是否使用线框模式

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

  /**
   * 应用Loop细分算法
   */
  private applyLoopSubdivision (): void {
    // 获取原始几何体数据
    const originalGeometry = this.effectComponent.geometry;
    const originalPositions = originalGeometry.getAttributeData('aPos');
    let originalIndices = originalGeometry.getIndexData();
    const originalUVs = originalGeometry.getAttributeData('aUV');

    console.log(originalPositions);
    console.log(originalIndices);
    console.log(originalUVs);
    console.log('--------------------------------');

    originalIndices = originalIndices?.slice(0, 6); // TODO 临时去掉垃圾数据

    if (!originalPositions || !originalIndices) {
      console.warn('细分网格需要顶点和索引数据');

      return;
    }

    // 转换位置数据为顶点数组，每个顶点是一个[x,y,z]数组
    const vertices: number[][] = [];
    // 转换索引数据为三角形数组，每个三角形是顶点索引的数组[a,b,c]
    const triangles: number[][] = [];
    // 转换UV数据为数组，如果存在
    const uvs: number[][] = [];

    for (let i = 0; i < originalPositions.length; i += 3) {
      vertices.push([
        originalPositions[i],
        originalPositions[i + 1],
        originalPositions[i + 2],
      ]);
    }

    for (let i = 0; i < originalIndices.length; i += 3) {
      triangles.push([
        originalIndices[i],
        originalIndices[i + 1],
        originalIndices[i + 2],
      ]);
    }

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

    console.log(newPositions);
    console.log(newIndices);
    console.log(newUVs);

    // 创建新的几何体
    const newGeometry = Geometry.create(this.engine, {
      attributes: {
        aPos: {
          type: glContext.FLOAT,
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
        : { data: new Uint16Array(newIndices), releasable: true },
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

    // 存储边到它们的三角形的映射，用于识别轮廓边
    const edgeToTriangles = new Map<string, number[]>();
    // 存储边到中点索引的映射
    const edgeToMidpoint = new Map<string, number>();

    // 存储新的几何数据
    const newVertices = [...vertices];
    const newTriangles: number[][] = [];
    const newUVs = [...uvs];

    // 构建边到三角形的映射
    for (let i = 0; i < triangles.length; i++) {
      const [a, b, c] = triangles[i];

      // 对于每个三角形的三条边，记录它们所属的三角形
      this.addEdge(edgeToTriangles, a, b, i);
      this.addEdge(edgeToTriangles, b, c, i);
      this.addEdge(edgeToTriangles, c, a, i);
    }

    console.log(edgeToTriangles);

    // 为每条边创建中点
    for (const [edge, triIndices] of edgeToTriangles.entries()) {
      const [a, b] = edge.split(',').map(Number);

      // 判断是否为轮廓边（只被一个三角形使用）
      const isBoundary = triIndices.length === 1;

      // 计算中点位置
      let midpoint: number[];

      if (isBoundary) {
        // 对于轮廓边，直接使用线性插值保持锐利
        midpoint = [
          (vertices[a][0] + vertices[b][0]) / 2,
          (vertices[a][1] + vertices[b][1]) / 2,
          (vertices[a][2] + vertices[b][2]) / 2,
        ];
      } else {
        // 对于普通边，使用Loop算法计算中点位置
        // 找到共享这条边的两个三角形
        const tri1 = triangles[triIndices[0]];
        const tri2 = triangles[triIndices[1]];

        // 找到对面的顶点
        const opposite1 = tri1.find(v => v !== a && v !== b) as number;
        const opposite2 = tri2.find(v => v !== a && v !== b) as number;

        // 应用Loop规则：3/8 * (端点和) + 1/8 * (对面顶点和)
        midpoint = [
          3 / 8 * (vertices[a][0] + vertices[b][0]) + 1 / 8 * (vertices[opposite1][0] + vertices[opposite2][0]),
          3 / 8 * (vertices[a][1] + vertices[b][1]) + 1 / 8 * (vertices[opposite1][1] + vertices[opposite2][1]),
          3 / 8 * (vertices[a][2] + vertices[b][2]) + 1 / 8 * (vertices[opposite1][2] + vertices[opposite2][2]),
        ];
      }

      // 添加中点到顶点列表
      const midpointIndex = newVertices.length;

      newVertices.push(midpoint);

      // 记录边到中点的映射
      edgeToMidpoint.set(edge, midpointIndex);

      // 处理UV坐标
      if (uvs.length > 0) {
        const midpointUV = [
          (uvs[a][0] + uvs[b][0]) / 2,
          (uvs[a][1] + uvs[b][1]) / 2,
        ];

        newUVs.push(midpointUV);
      }
    }

    // 更新原始顶点位置
    for (let i = 0; i < vertices.length; i++) {
      // 找到与顶点i相连的顶点
      const connectedVertices: number[] = [];
      const boundaryEdges: [number, number][] = [];

      // 检查每个三角形是否包含顶点i
      for (let j = 0; j < triangles.length; j++) {
        const tri = triangles[j];
        const vertexIndex = tri.indexOf(i);

        if (vertexIndex !== -1) {
          // 获取这个三角形中顶点i的相邻顶点
          const next = tri[(vertexIndex + 1) % 3];
          const prev = tri[(vertexIndex + 2) % 3];

          if (!connectedVertices.includes(next)) {
            connectedVertices.push(next);
          }
          if (!connectedVertices.includes(prev)) {
            connectedVertices.push(prev);
          }

          // 检查边是否是轮廓
          const edge1 = this.getEdgeKey(i, next);
          const edge2 = this.getEdgeKey(i, prev);

          if (edgeToTriangles.get(edge1)?.length === 1) {
            boundaryEdges.push([i, next]);
          }
          if (edgeToTriangles.get(edge2)?.length === 1) {
            boundaryEdges.push([i, prev]);
          }
        }
      }

      // 判断是否为边界顶点
      const isBoundaryVertex = boundaryEdges.length > 0;

      // 如果是边界顶点且要保持锐利几何，特殊处理
      if (isBoundaryVertex) {
        // 如果有多于一条边界边，表示这是一个角点，直接保持不变
        if (boundaryEdges.length > 1) {
          // 不改变位置，保持锐利角
        } else {
          // 如果只有一条边界边，可以在边界上平滑
          const [_, otherVertex] = boundaryEdges[0];

          // 简单的1D平滑: 1/8 * neighbor + 7/8 * self
          newVertices[i] = [
            7 / 8 * vertices[i][0] + 1 / 8 * vertices[otherVertex][0],
            7 / 8 * vertices[i][1] + 1 / 8 * vertices[otherVertex][1],
            7 / 8 * vertices[i][2] + 1 / 8 * vertices[otherVertex][2],
          ];
        }
      } else {
        // 应用Loop规则更新内部顶点
        const n = connectedVertices.length;
        const beta = n > 3 ? 3 / (8 * n) : (n === 3 ? 3 / 16 : 0);

        // 计算新位置：(1 - n*beta) * 原位置 + beta * 相邻点和
        let newX = (1 - n * beta) * vertices[i][0];
        let newY = (1 - n * beta) * vertices[i][1];
        let newZ = (1 - n * beta) * vertices[i][2];

        for (const neighbor of connectedVertices) {
          newX += beta * vertices[neighbor][0];
          newY += beta * vertices[neighbor][1];
          newZ += beta * vertices[neighbor][2];
        }

        newVertices[i] = [newX, newY, newZ];
      }
    }

    // 创建新的三角形拓扑
    for (let i = 0; i < triangles.length; i++) {
      const [a, b, c] = triangles[i];

      // 获取各边的中点
      const midAB = edgeToMidpoint.get(this.getEdgeKey(a, b)) as number;
      const midBC = edgeToMidpoint.get(this.getEdgeKey(b, c)) as number;
      const midCA = edgeToMidpoint.get(this.getEdgeKey(c, a)) as number;

      // 创建四个新三角形
      newTriangles.push([a, midAB, midCA]);
      newTriangles.push([b, midBC, midAB]);
      newTriangles.push([c, midCA, midBC]);
      newTriangles.push([midAB, midBC, midCA]);
    }

    return { vertices: newVertices, triangles: newTriangles, uvs: newUVs };
  }

  // 辅助方法：生成唯一的边键
  private getEdgeKey (a: number, b: number): string {
    return a < b ? `${a},${b}` : `${b},${a}`;
  }

  // 辅助方法：添加边到映射
  private addEdge (edgeMap: Map<string, number[]>, a: number, b: number, triIndex: number): void {
    const key = this.getEdgeKey(a, b);

    if (!edgeMap.has(key)) {
      edgeMap.set(key, []);
    }
    edgeMap.get(key)?.push(triIndex);
  }
}

