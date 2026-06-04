import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Texture } from '../../texture';
import type { TrailMeshProps, TrailPointOptions } from './trail-mesh';
import { TrailMesh } from './trail-mesh';
import type { ParticleDataBuffer } from './particle-data-buffer';
import type { ParticleMeshProps } from './particle-mesh';
import { ParticleMesh } from './particle-mesh';
import type { Mesh, Renderer } from '../../render';
import type { Engine } from '../../engine';
import { RendererComponent } from '../../components';
import type { ParsedTrailConfig } from './parse-spec';

/**
 * @since 2.0.0
 */
export class ParticleSystemRenderer extends RendererComponent {
  meshes: Mesh[];
  particleMesh: ParticleMesh;

  private trailMesh?: TrailMesh;
  private trailConfig?: ParsedTrailConfig;

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

  generateDynamicData (db: ParticleDataBuffer): void {
    const count = db.activeCount;

    if (count === 0) {
      return;
    }
    const mesh = this.particleMesh;
    const geo = mesh.geometry;
    const anchor = mesh.anchor;
    const texOffsets = mesh.textureOffsets;
    const useSprite = mesh.useSprite;

    this.ensureGeometryCapacity(count);

    const aPos = geo.getAttributeData('aPos') as Float32Array;
    const aRot = geo.getAttributeData('aRot') as Float32Array;
    const aOffset = geo.getAttributeData('aOffset') as Float32Array;
    const aTranslation = geo.getAttributeData('aTranslation') as Float32Array;
    const aRotation0 = geo.getAttributeData('aRotation0') as Float32Array;
    const aSize = geo.getAttributeData('aSize') as Float32Array;
    const aColorScale = geo.getAttributeData('aColorScale') as Float32Array;
    const aSprite = useSprite ? geo.getAttributeData('aSprite') as Float32Array : null;
    const wholeUV = [0, 0, 1, 1];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const i2 = i * 2;
      const i9 = i * 9;
      const uv = (db.uv[i4] !== 0 || db.uv[i4 + 1] !== 0 || db.uv[i4 + 2] !== 0 || db.uv[i4 + 3] !== 0)
        ? db.uv : null;

      for (let j = 0; j < 4; j++) {
        const vi = i * 4 + j;
        const p12 = vi * 12;
        const r8 = vi * 8;
        const o4 = vi * 4;
        const t3 = vi * 3;
        const rot9 = vi * 9;
        const s2 = vi * 2;
        const c4 = vi * 4;

        aPos[p12] = 0;
        aPos[p12 + 1] = 0;
        aPos[p12 + 2] = 0;
        aPos[p12 + 3] = db.velocity[i3];
        aPos[p12 + 4] = db.velocity[i3 + 1];
        aPos[p12 + 5] = db.velocity[i3 + 2];

        const ji = j * 2;
        const sx = (sizeOffsets[ji] - anchor.x) * db.size[i2];
        const sy = (sizeOffsets[ji + 1] - anchor.y) * db.size[i2 + 1];

        aPos[p12 + 6] = db.dirX[i3] * sx;
        aPos[p12 + 7] = db.dirX[i3 + 1] * sx;
        aPos[p12 + 8] = db.dirX[i3 + 2] * sx;
        aPos[p12 + 9] = db.dirY[i3] * sy;
        aPos[p12 + 10] = db.dirY[i3 + 1] * sy;
        aPos[p12 + 11] = db.dirY[i3 + 2] * sy;

        aRot[r8] = db.rotation[i3];
        aRot[r8 + 1] = db.rotation[i3 + 1];
        aRot[r8 + 2] = db.rotation[i3 + 2];
        aRot[r8 + 3] = db.seed[i];
        aRot[r8 + 4] = db.color[i4];
        aRot[r8 + 5] = db.color[i4 + 1];
        aRot[r8 + 6] = db.color[i4 + 2];
        aRot[r8 + 7] = db.color[i4 + 3];

        const offset = j * 2;
        const uvy = useSprite ? (1 - texOffsets[offset + 1]) : texOffsets[offset + 1];
        const uvBase = uv ? [uv[i4], uv[i4 + 1], uv[i4 + 2], uv[i4 + 3]] : wholeUV;

        aOffset[o4] = uvBase[0] + texOffsets[offset] * uvBase[2];
        aOffset[o4 + 1] = uvBase[1] + uvy * uvBase[3];
        aOffset[o4 + 2] = db.delay[i];
        aOffset[o4 + 3] = db.lifetime[i];

        aTranslation[t3] = db.finalOffset[i3];
        aTranslation[t3 + 1] = db.finalOffset[i3 + 1];
        aTranslation[t3 + 2] = db.finalOffset[i3 + 2];

        for (let k = 0; k < 9; k++) {
          aRotation0[rot9 + k] = db.rotMatrix[i9 + k];
        }

        aSize[s2] = db.sizeScale[i2];
        aSize[s2 + 1] = db.sizeScale[i2 + 1];

        aColorScale[c4] = db.colorScale[i4];
        aColorScale[c4 + 1] = db.colorScale[i4 + 1];
        aColorScale[c4 + 2] = db.colorScale[i4 + 2];
        aColorScale[c4 + 3] = db.colorScale[i4 + 3];

        if (aSprite) {
          const sp3 = vi * 3;

          aSprite[sp3] = db.sprite[i3];
          aSprite[sp3 + 1] = db.sprite[i3 + 1];
          aSprite[sp3 + 2] = db.sprite[i3 + 2];
        }
      }
    }

    geo.setAttributeData('aPos', aPos);
    geo.setAttributeData('aRot', aRot);
    geo.setAttributeData('aOffset', aOffset);
    geo.setAttributeData('aTranslation', aTranslation);
    geo.setAttributeData('aRotation0', aRotation0);
    geo.setAttributeData('aSize', aSize);
    geo.setAttributeData('aColorScale', aColorScale);
    if (aSprite) {
      geo.setAttributeData('aSprite', aSprite);
    }
    geo.setDrawCount(count * 6);
  }

  private ensureGeometryCapacity (particleCount: number): void {
    const mesh = this.particleMesh;

    if (particleCount <= mesh.maxParticleBufferCount) {
      return;
    }
    const vertexCount = particleCount * 4;
    const geo = mesh.geometry;

    geo.setAttributeData('aPos', new Float32Array(vertexCount * 12));
    geo.setAttributeData('aRot', new Float32Array(vertexCount * 8));
    geo.setAttributeData('aOffset', new Float32Array(vertexCount * 4));
    geo.setAttributeData('aTranslation', new Float32Array(vertexCount * 3));
    geo.setAttributeData('aRotation0', new Float32Array(vertexCount * 9));
    geo.setAttributeData('aSize', new Float32Array(vertexCount * 2));
    geo.setAttributeData('aColorScale', new Float32Array(vertexCount * 4));
    if (mesh.useSprite) {
      geo.setAttributeData('aSprite', new Float32Array(vertexCount * 3));
    }

    const indices = new Uint16Array(particleCount * 6);

    for (let i = 0; i < particleCount; i++) {
      const vi = i * 4;
      const ii = i * 6;

      indices[ii] = vi;
      indices[ii + 1] = vi + 1;
      indices[ii + 2] = vi + 2;
      indices[ii + 3] = vi + 2;
      indices[ii + 4] = vi + 1;
      indices[ii + 5] = vi + 3;
    }
    geo.setIndexData(indices);
    mesh.maxParticleBufferCount = particleCount;
  }

  setTrailConfig (config: ParsedTrailConfig): void {
    this.trailConfig = config;
  }

  updateTrails (db: ParticleDataBuffer, timePassed: number, emitterLifetime: number, worldMatrix: Matrix4): void {
    const trails = this.trailConfig;

    if (!trails) {
      return;
    }
    for (let ti = 0; ti < db.activeCount; ti++) {
      if (!db.alive[ti]) {
        continue;
      }
      if (db.expiry[ti] < timePassed) {
        if (trails.dieWithParticles) {
          this.clearTrail(ti);
        }
      } else if (timePassed > db.delay[ti]) {
        const i3 = ti * 3;
        const position = tempTrailPos.set(
          db.finalOffset[i3],
          db.finalOffset[i3 + 1],
          db.finalOffset[i3 + 2],
        );

        if (trails.parentAffectsPosition) {
          const e = worldMatrix.elements;

          tempParentPos.set(e[12], e[13], e[14]);
          let startPos = this.getTrailStartPosition(ti);

          if (!startPos) {
            this.setTrailStartPosition(ti, tempParentPos.clone());
            startPos = tempParentPos;
          }
          position.add(tempParentPos);
          position.subtract(startPos);
        }
        const color = trails.inheritParticleColor ? this.getParticlePointColor(ti) : [1, 1, 1, 1];
        const si2 = ti * 2;
        const sizeX = db.size[si2];

        let width = 1;
        let lifetime = trails.lifetime.getValue(emitterLifetime);

        if (trails.sizeAffectsWidth) {
          width *= sizeX;
        }
        if (trails.sizeAffectsLifetime) {
          lifetime *= sizeX;
        }
        this.addTrailPoint(ti, position, {
          color,
          lifetime,
          size: width,
          time: db.delay[ti],
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

const tempTrailPos = new Vector3();
const tempParentPos = new Vector3();
const sizeOffsets = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];
