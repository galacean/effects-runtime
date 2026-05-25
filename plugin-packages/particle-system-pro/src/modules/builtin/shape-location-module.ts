import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpPos: [number, number, number] = [0, 0, 0];

export type ProShapePrimitive = 'box' | 'sphere' | 'cylinder' | 'ring' | 'plane';

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
