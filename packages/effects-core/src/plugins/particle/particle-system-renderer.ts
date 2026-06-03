import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { vec3 } from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import type { Texture } from '../../texture';
import type { TrailMeshProps, TrailPointOptions } from './trail-mesh';
import { TrailMesh } from './trail-mesh';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleMeshProps } from './particle-mesh';
import { ParticleMesh } from './particle-mesh';
import type { Mesh, Renderer } from '../../render';
import type { Engine } from '../../engine';
import { RendererComponent } from '../../components';

export type TrailUpdateContext = {
  db: ParticleDataBuffer,
  timePassed: number,
  emitterLifetime: number,
  trails: {
    lifetime: ValueGetter<number>,
    dieWithParticles: boolean,
    sizeAffectsWidth: boolean,
    sizeAffectsLifetime: boolean,
    inheritParticleColor: boolean,
    parentAffectsPosition: boolean,
  },
  getPointPositionF64: (index: number) => Vector3,
  parentTransformPosition: Vector3 | null,
};

/**
 * @since 2.0.0
 */
export class ParticleSystemRenderer extends RendererComponent {
  meshes: Mesh[];
  particleMesh: ParticleMesh;

  private trailMesh?: TrailMesh;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'ParticleSystemRenderer';
  }

  override onStart (): void {
    this._priority = this.item.renderOrder;
  }

  override onUpdate (dt: number): void {
    const time = this.particleMesh.time;
    const uParams = this.particleMesh.mesh.material.getVector4('uParams') ?? new Vector4();

    this.particleMesh.mesh.material.setVector4('uParams', uParams.set(time, this.item.duration, 0, 0));
  }

  override render (renderer: Renderer): void {
    this.maskManager.drawStencilMask(renderer, this);

    for (const mesh of this.meshes) {
      mesh.render(renderer);
    }
  }

  /**
   * @internal
   */
  setup (particleMeshProps: ParticleMeshProps, trailMeshProps: TrailMeshProps | null = null,) {
    this.meshes = [];
    this.materials = [];

    this.particleMesh = new ParticleMesh(this.engine, particleMeshProps);

    if (trailMeshProps) {
      this.trailMesh = new TrailMesh(this.engine, trailMeshProps);
    }

    this.meshes.push(this.particleMesh.mesh);
    this.materials.push(this.particleMesh.mesh.material);

    if (this.trailMesh) {
      this.meshes.push(this.trailMesh.mesh);
      this.materials.push(this.trailMesh.mesh.material);
    }
  }

  /**
   * 将 DataBuffer 中的逐帧累计数据同步到 GPU geometry。
   * 对齐 Pro 的 renderer 读取 buffer → 写入 geometry 的职责分离。
   */
  syncParticleData (db: ParticleDataBuffer): void {
    if (db.activeCount === 0) {
      return;
    }
    const geo = this.particleMesh.geometry;

    this.expandToQuad(geo, 'aTranslation', db.finalOffset, db.activeCount, 3);
    this.expandToQuad(geo, 'aRotation0', db.rotMatrix, db.activeCount, 9);
  }

  private expandToQuad (geo: any, attr: string, src: Float32Array, count: number, stride: number): void {
    const dst = geo.getAttributeData(attr) as Float32Array;
    const n = Math.min(count, Math.floor(dst.length / (stride * 4)));

    for (let i = 0; i < n; i++) {
      const si = i * stride;
      const di = i * stride * 4;

      for (let v = 0; v < 4; v++) {
        const vo = di + v * stride;

        for (let c = 0; c < stride; c++) {
          dst[vo + c] = src[si + c];
        }
      }
    }
    geo.setAttributeData(attr, dst);
  }

  /**
   * 更新拖尾数据。对齐 Pro 的 renderer 负责读取粒子状态 → 生成 trail geometry。
   */
  updateTrailData (ctx: TrailUpdateContext): void {
    const { db, timePassed, emitterLifetime, trails, getPointPositionF64, parentTransformPosition } = ctx;

    for (let ti = 0; ti < db.activeCount; ti++) {
      if (!db.alive[ti]) {
        continue;
      }
      if (db.expiry[ti] < timePassed) {
        if (trails.dieWithParticles) {
          this.clearTrail(ti);
        }
      } else if (timePassed > db.delayF64[ti]) {
        const position = getPointPositionF64(ti);
        const color = trails.inheritParticleColor ? this.getParticlePointColor(ti) : [1, 1, 1, 1];
        const si2 = ti * 2;
        const size: vec3 = [db.sizeF64[si2], db.sizeF64[si2 + 1], 1];

        let width = 1;
        let lifetime = trails.lifetime.getValue(emitterLifetime);

        if (trails.sizeAffectsWidth) {
          width *= size[0];
        }
        if (trails.sizeAffectsLifetime) {
          lifetime *= size[0];
        }
        if (trails.parentAffectsPosition && parentTransformPosition) {
          position.add(parentTransformPosition);
          const pos = this.getTrailStartPosition(ti);

          if (pos) {
            position.subtract(pos);
          }
        }
        this.addTrailPoint(ti, position, {
          color,
          lifetime,
          size: width,
          time: db.delayF64[ti],
        });
      }
    }
  }

  reset () {
    this.particleMesh.clearPoints();
    this.trailMesh?.clearAllTrails();
  }

  updateTime (now: number, delta: number) {
    this.particleMesh.time = now;
    if (this.trailMesh) {
      this.trailMesh.time = now;
      this.trailMesh.onUpdate(delta);
    }
  }

  minusTimeForLoop (duration: number) {
    this.particleMesh.minusTime(duration);
    this.trailMesh?.minusTime(duration);
  }

  updateWorldMatrix (worldMatrix: Matrix4) {
    this.particleMesh.mesh.worldMatrix = worldMatrix;
    if (this.trailMesh) {
      this.trailMesh.mesh.worldMatrix = worldMatrix;
    }
  }

  setVisible (visible: boolean) {
    this.particleMesh.mesh.setVisible(visible);
    this.trailMesh?.mesh.setVisible(visible);
  }

  getTextures (): Texture[] {
    const textures: Texture[] = [];
    // @ts-expect-error textures 是否可以考虑挂在 Material 上
    const particleMeshTextures = this.particleMesh.mesh.material.textures;

    Object.keys(particleMeshTextures).forEach(key => {
      textures.push(particleMeshTextures[key]);
    });
    if (this.trailMesh) {
      // @ts-expect-error 同上
      const trailMeshTextures = this.trailMesh.mesh.material.textures;

      Object.keys(trailMeshTextures).forEach(key => {
        textures.push(trailMeshTextures[key]);
      });
    }

    return textures;
  }

  removeParticlePoint (index: number) {
    this.particleMesh.removePoint(index);
  }

  getParticlePointColor (index: number) {
    return this.particleMesh.getPointColor(index);
  }

  hasTrail () {
    return this.trailMesh !== undefined;
  }

  clearTrail (pointIndex: number) {
    this.trailMesh?.clearTrail(pointIndex);
  }

  addTrailPoint (index: number, position: Vector3, options: TrailPointOptions) {
    this.trailMesh?.addPoint(index, position, options);
  }

  setTrailStartPosition (index: number, position: Vector3) {
    this.trailMesh?.setPointStartPos(index, position);
  }

  getTrailStartPosition (index: number) {
    return (this.trailMesh as TrailMesh).getPointStartPos(index);
  }
}
