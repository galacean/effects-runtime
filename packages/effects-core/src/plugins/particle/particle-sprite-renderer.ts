import type { ParticleEmitter } from './particle-emitter';
import type { ParticleMeshProps } from './particle-mesh';
import { ParticleMesh } from './particle-mesh';
import { ParticleRenderer } from './particle-renderer';
import type { Engine } from '../../engine';
import type { Geometry, Mesh } from '../../render';

const sizeOffsets = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

export class ParticleSpriteRenderer extends ParticleRenderer {
  readonly mesh: Mesh;
  readonly geometry: Geometry;

  private particleMesh: ParticleMesh;

  constructor (engine: Engine, props: ParticleMeshProps) {
    super();
    this.particleMesh = new ParticleMesh(engine, props);
    this.mesh = this.particleMesh.mesh;
    this.geometry = this.particleMesh.geometry;
  }

  get time (): number {
    return this.particleMesh.time;
  }

  updateTime (now: number): void {
    this.particleMesh.time = now;
  }

  minusTimeForLoop (duration: number): void {
    this.particleMesh.minusTime(duration);
  }

  generateDynamicData (emitter: ParticleEmitter): void {
    const db = emitter.dataBuffer;
    const liveIndices = db.liveIndices;
    const liveCount = liveIndices.length;

    if (liveCount === 0) {
      this.geometry.setDrawCount(0);

      return;
    }
    const mesh = this.particleMesh;
    const geo = this.geometry;
    const anchor = mesh.anchor;
    const texOffsets = mesh.textureOffsets;
    const useSprite = mesh.useSprite;

    this.ensureCapacity(liveCount);

    const aPos = geo.getAttributeData('aPos') as Float32Array;
    const aRot = geo.getAttributeData('aRot') as Float32Array;
    const aOffset = geo.getAttributeData('aOffset') as Float32Array;
    const aTranslation = geo.getAttributeData('aTranslation') as Float32Array;
    const aSprite = useSprite ? geo.getAttributeData('aSprite') as Float32Array : null;
    const wholeUV = [0, 0, 1, 1];

    for (let outIdx = 0; outIdx < liveCount; outIdx++) {
      const i = liveIndices[outIdx];
      const i3 = i * 3;
      const i4 = i * 4;
      const i2 = i * 2;
      const uv = (db.uv[i4] !== 0 || db.uv[i4 + 1] !== 0 || db.uv[i4 + 2] !== 0 || db.uv[i4 + 3] !== 0)
        ? db.uv : null;

      for (let j = 0; j < 4; j++) {
        const vi = outIdx * 4 + j;
        const p12 = vi * 12;
        const r8 = vi * 8;
        const o4 = vi * 4;
        const t3 = vi * 3;

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
        aOffset[o4 + 2] = db.age[i];
        aOffset[o4 + 3] = db.lifetime[i];

        aTranslation[t3] = db.position[i3];
        aTranslation[t3 + 1] = db.position[i3 + 1];
        aTranslation[t3 + 2] = db.position[i3 + 2];

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
    if (aSprite) {
      geo.setAttributeData('aSprite', aSprite);
    }
    geo.setDrawCount(liveCount * 6);
  }

  clear (): void {
    this.particleMesh.clearPoints();
  }

  getPointColor (index: number): number[] {
    return this.particleMesh.getPointColor(index);
  }

  private ensureCapacity (particleCount: number): void {
    const mesh = this.particleMesh;

    if (particleCount <= mesh.maxParticleBufferCount) {
      return;
    }
    const vertexCount = particleCount * 4;
    const geo = this.geometry;

    geo.setAttributeData('aPos', new Float32Array(vertexCount * 12));
    geo.setAttributeData('aRot', new Float32Array(vertexCount * 8));
    geo.setAttributeData('aOffset', new Float32Array(vertexCount * 4));
    geo.setAttributeData('aTranslation', new Float32Array(vertexCount * 3));
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
}
