/* eslint-disable no-console */
import { EffectComponent } from './effect-component';
import { effectsClass } from '../decorators';
import type { Engine } from '../engine';
import { glContext } from '../gl';
import { Geometry } from '../render';
import { Component } from './component';
import type { PoissonSamplerOptions } from '../utils/mesh-utils';
import { createWireframeIndices, delaunay2D, generatePoissonPoints } from '../utils/mesh-utils';

// TODO 改到编辑时做，现在是运行时细分的。
// TODO 细分算法还有问题，应该是 effect geo index 有问题
// 2D采样 + 3D重建，泊松采样在XY平面上生成均匀分布的点，然后为每个点计算适当的Z值

@effectsClass('SubdComponent')
export class SubdComponent extends Component {
  private animated = false;

  private subdivisionLevel = 4; // 细分级别控制整体密度
  private wireframe = true; // 是否使用线框模式

  // 存储EffectComponent引用
  // TODO 支持别的组件
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

  /**
   * 创建细分网格
   * 使用泊松采样和Delaunay三角剖分生成新的网格
   */
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

    if (!originalPositions) {
      return;
    }

    // TODO 这里有问题，得到的 _originalIndices 非常奇怪
    // const _originalIndices = originalGeometry.getIndexData();
    // console.log(_originalIndices);

    // 创建采样配置并进行泊松盘采样生成轮廓和内部顶点
    const poissonOptions: PoissonSamplerOptions = {
      subdivisionLevel: this.subdivisionLevel,
    };
    const poissonPoints = generatePoissonPoints(originalPositions, poissonOptions);

    console.log(poissonPoints);

    // 确保生成了足够的泊松采样点
    if (poissonPoints.length < 3) {
      console.warn('没有足够的泊松采样点，无法生成有效的三角网格');

      return;
    }

    // 进行Delaunay三角剖分（使用 3D 点）
    const indices = delaunay2D(poissonPoints);

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
      // 直接使用3D点的坐标
      positions.push(point[0], point[1], point[2]);

      // 计算UV坐标（基于点的x,y位置，归一化到0-1范围）
      // TODO UV 需要继承原来的 UV
      const u = (point[0] + 0.5);
      const v = (point[1] + 0.5);

      uvs.push(u, v);
    }

    console.log('最终顶点位置:', positions);

    // 创建新的几何体，而不是直接修改原始几何体
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
          ? { data: new Uint16Array(createWireframeIndices(indices)) }
          : { data: new Uint16Array(indices) },
        mode: this.wireframe ? glContext.LINES : glContext.TRIANGLES,
        drawCount: this.wireframe ? createWireframeIndices(indices).length : indices.length,
      }
    );

    // 替换 effectComponent 的几何体引用
    this.effectComponent.geometry = newGeometry;
  }
}

