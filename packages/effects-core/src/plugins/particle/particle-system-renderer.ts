import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { Vector4 } from '@galacean/effects-math/es/core/vector4';
import type { Texture } from '../../texture';
import type { TrailMeshProps, TrailPointOptions } from './trail-mesh';
import { TrailMesh } from './trail-mesh';
import type { ParticleMeshProps, Point } from './particle-mesh';
import { ParticleMesh } from './particle-mesh';
import type { Mesh, Renderer } from '../../render';
import type { Engine } from '../../engine';
import { RendererComponent } from '../../components';

/**
 * @since 2.0.0
 * @internal
 */
export class ParticleSystemRenderer extends RendererComponent {
  meshes: Mesh[];
  particleMesh: ParticleMesh;

  private trailMesh?: TrailMesh;

  constructor (
    engine: Engine,
    particleMeshProps: ParticleMeshProps,
    trailMeshProps?: TrailMeshProps,
  ) {
    super(engine);

    this.name = 'ParticleSystemRenderer';
    this.particleMesh = new ParticleMesh(engine, particleMeshProps);

    if (trailMeshProps !== undefined) {
      this.trailMesh = new TrailMesh(engine, trailMeshProps);
    }

    const meshes = [this.particleMesh.mesh];

    this.materials.push(this.particleMesh.mesh.material);

    if (this.trailMesh) {
      meshes.push(this.trailMesh.mesh);
      this.materials.push(this.trailMesh.mesh.material);
    }

    this.meshes = meshes;
  }

  override start (): void {
    this._priority = this.item.listIndex;
    this.particleMesh.gravityModifier.scaleXCoord(this.item.duration);
  }

  override update (dt: number): void {
    const time = this.particleMesh.time;

    this.particleMesh.mesh.material.setVector4('uParams', new Vector4(time, this.item.duration, 0, 0));
  }

  override render (renderer: Renderer): void {
    for (const mesh of this.meshes) {
      mesh.render(renderer);
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
    const textures = [];

    // @ts-expect-error
    for (const texture of Object.values(this.particleMesh.mesh.material.textures)) {
      textures.push(texture);
    }
    if (this.trailMesh) {
      // @ts-expect-error
      for (const texture of Object.values(this.trailMesh.mesh.material.textures)) {
        textures.push(texture);
      }
    }

    return textures as Texture[];
  }

  setParticlePoint (index: number, point: Point) {
    this.particleMesh.setPoint(index, point);
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
