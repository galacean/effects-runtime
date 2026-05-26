import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

const tmpPos: [number, number, number] = [0, 0, 0];

export type ProShapePrimitive = 'box' | 'sphere' | 'cylinder' | 'ring' | 'plane';

export interface ProShapeLocationModuleProps extends ProModuleProps {
  shape: ProShapePrimitive,
  center: [number, number, number],
  sphereMin: number,
  sphereMax: number,
  boxSize: [number, number, number],
  boxSurfaceOnly: boolean,
  cylinderHeight: number,
  cylinderRadius: number,
  ringRadius: number,
  ringThickness: number,
  planeSize: [number, number],
}

/**
 * 统一形状发射模块：支持 Box / Sphere / Cylinder / Ring / Plane 五种基础形状。
 *
 * 对齐 Niagara Stateless 的 ShapeLocation（ENSM_ShapePrimitive 枚举切换）。
 * 执行顺序在 InitializeParticle 之后，累加到已写入的 position 上。
 */
export class ProShapeLocationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  shape: ProShapePrimitive = 'sphere';
  center: [number, number, number] = [0, 0, 0];

  // Sphere
  sphereMin = 0;
  sphereMax = 1;

  // Box
  boxSize: [number, number, number] = [1, 1, 1];
  boxSurfaceOnly = false;

  // Cylinder
  cylinderHeight = 1;
  cylinderRadius = 1;

  // Ring
  ringRadius = 1;
  ringThickness = 0;

  // Plane
  planeSize: [number, number] = [1, 1];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProShapeLocationModuleProps {
    return {
      shape: this.shape,
      center: [...this.center],
      sphereMin: this.sphereMin,
      sphereMax: this.sphereMax,
      boxSize: [...this.boxSize],
      boxSurfaceOnly: this.boxSurfaceOnly,
      cylinderHeight: this.cylinderHeight,
      cylinderRadius: this.cylinderRadius,
      ringRadius: this.ringRadius,
      ringThickness: this.ringThickness,
      planeSize: [...this.planeSize],
    };
  }

  override fromJSON (data: ProShapeLocationModuleProps): void {
    if (data.shape === 'box' || data.shape === 'sphere' || data.shape === 'cylinder' || data.shape === 'ring' || data.shape === 'plane') {
      this.shape = data.shape;
    }
    if (data.center && data.center.length === 3) {
      this.center = [data.center[0], data.center[1], data.center[2]];
    }
    if (typeof data.sphereMin === 'number') { this.sphereMin = data.sphereMin; }
    if (typeof data.sphereMax === 'number') { this.sphereMax = data.sphereMax; }
    if (data.boxSize && data.boxSize.length === 3) {
      this.boxSize = [data.boxSize[0], data.boxSize[1], data.boxSize[2]];
    }
    if (typeof data.boxSurfaceOnly === 'boolean') { this.boxSurfaceOnly = data.boxSurfaceOnly; }
    if (typeof data.cylinderHeight === 'number') { this.cylinderHeight = data.cylinderHeight; }
    if (typeof data.cylinderRadius === 'number') { this.cylinderRadius = data.cylinderRadius; }
    if (typeof data.ringRadius === 'number') { this.ringRadius = data.ringRadius; }
    if (typeof data.ringThickness === 'number') { this.ringThickness = data.ringThickness; }
    if (data.planeSize && data.planeSize.length === 2) {
      this.planeSize = [data.planeSize[0], data.planeSize[1]];
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout ?? null;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;
    const [cx, cy, cz] = this.center;

    for (let i = firstInstance; i < lastInstance; i++) {
      let ox = 0, oy = 0, oz = 0;

      switch (this.shape) {
        case 'sphere':
          [ox, oy, oz] = this.sampleSphere(randomStream);

          break;
        case 'box':
          [ox, oy, oz] = this.sampleBox(randomStream);

          break;
        case 'cylinder':
          [ox, oy, oz] = this.sampleCylinder(randomStream);

          break;
        case 'ring':
          [ox, oy, oz] = this.sampleRing(randomStream);

          break;
        case 'plane':
          [ox, oy, oz] = this.samplePlane(randomStream);

          break;
      }

      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(dataBuffer, i, tmpPos[0] + cx + ox, tmpPos[1] + cy + oy, tmpPos[2] + cz + oz);
    }
  }

  private sampleSphere (rs: { nextFloat(): number }): [number, number, number] {
    const cosTheta = rs.nextFloat() * 2 - 1;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = rs.nextFloat() * Math.PI * 2;
    const rMin = this.sphereMin;
    const rMax = this.sphereMax;
    const r = rMin === 0
      ? rMax * Math.cbrt(rs.nextFloat())
      : Math.cbrt(rMin * rMin * rMin + rs.nextFloat() * (rMax * rMax * rMax - rMin * rMin * rMin));

    return [
      r * sinTheta * Math.cos(phi),
      r * sinTheta * Math.sin(phi),
      r * cosTheta,
    ];
  }

  private sampleBox (rs: { nextFloat(): number }): [number, number, number] {
    const [sx, sy, sz] = this.boxSize;

    if (!this.boxSurfaceOnly) {
      return [
        (rs.nextFloat() - 0.5) * sx,
        (rs.nextFloat() - 0.5) * sy,
        (rs.nextFloat() - 0.5) * sz,
      ];
    }
    // Surface only: pick a random face then random point on that face
    const face = Math.floor(rs.nextFloat() * 6);
    const u = rs.nextFloat() - 0.5;
    const v = rs.nextFloat() - 0.5;

    switch (face) {
      case 0: return [0.5 * sx, u * sy, v * sz];
      case 1: return [-0.5 * sx, u * sy, v * sz];
      case 2: return [u * sx, 0.5 * sy, v * sz];
      case 3: return [u * sx, -0.5 * sy, v * sz];
      case 4: return [u * sx, v * sy, 0.5 * sz];
      default: return [u * sx, v * sy, -0.5 * sz];
    }
  }

  private sampleCylinder (rs: { nextFloat(): number }): [number, number, number] {
    const angle = rs.nextFloat() * Math.PI * 2;
    const r = this.cylinderRadius * Math.sqrt(rs.nextFloat());
    const h = (rs.nextFloat() - 0.5) * this.cylinderHeight;

    return [r * Math.cos(angle), h, r * Math.sin(angle)];
  }

  private sampleRing (rs: { nextFloat(): number }): [number, number, number] {
    const angle = rs.nextFloat() * Math.PI * 2;
    const r = this.ringRadius + (rs.nextFloat() - 0.5) * this.ringThickness;

    return [r * Math.cos(angle), 0, r * Math.sin(angle)];
  }

  private samplePlane (rs: { nextFloat(): number }): [number, number, number] {
    return [
      (rs.nextFloat() - 0.5) * this.planeSize[0],
      0,
      (rs.nextFloat() - 0.5) * this.planeSize[1],
    ];
  }
}
