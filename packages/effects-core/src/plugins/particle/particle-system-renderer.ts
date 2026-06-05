import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import type { Texture } from '../../texture';
import type { ParticleRibbonRendererProps } from './particle-ribbon-renderer';
import { ParticleRibbonRenderer } from './particle-ribbon-renderer';
import type { ParticleMeshProps } from './particle-mesh';
import { ParticleSpriteRenderer } from './particle-sprite-renderer';
import type { Mesh, Renderer } from '../../render';
import type { Engine } from '../../engine';
import { RendererComponent } from '../../components';
import type { ParticleEmitter } from './particle-emitter';

/**
 * @since 2.0.0
 */
export class ParticleSystemRenderer extends RendererComponent {
  meshes: Mesh[];

  spriteRenderer: ParticleSpriteRenderer;
  ribbonRenderer?: ParticleRibbonRenderer;

  private viewDirX = 0;
  private viewDirY = 0;
  private viewDirZ = -1;

  constructor (engine: Engine) {
    super(engine);

    this.name = 'ParticleSystemRenderer';
  }

  override onStart (): void {
    this._priority = this.item.renderOrder;
  }

  override onUpdate (dt: number): void {
  }

  override render (renderer: Renderer): void {
    const camera = renderer.renderingData.currentFrame?.camera;

    if (camera) {
      const e = camera.getInverseViewMatrix().elements;

      this.viewDirX = -e[8];
      this.viewDirY = -e[9];
      this.viewDirZ = -e[10];
    }
    this.maskManager.drawStencilMask(renderer, this);

    for (const mesh of this.meshes) {
      mesh.render(renderer);
    }
  }

  /**
   * @internal
   */
  setup (particleMeshProps: ParticleMeshProps, trailMeshProps: ParticleRibbonRendererProps | null = null) {
    this.meshes = [];
    this.materials = [];

    this.spriteRenderer = new ParticleSpriteRenderer(this.engine, particleMeshProps);

    if (trailMeshProps) {
      this.ribbonRenderer = new ParticleRibbonRenderer(this.engine, trailMeshProps);
    }

    this.meshes.push(this.spriteRenderer.mesh);
    this.materials.push(this.spriteRenderer.mesh.material);

    if (this.ribbonRenderer) {
      this.meshes.push(this.ribbonRenderer.mesh);
      this.materials.push(this.ribbonRenderer.mesh.material);
    }
  }

  generateSpriteData (emitter: ParticleEmitter): void {
    this.spriteRenderer.generateDynamicData(emitter);
  }

  generateRibbonData (trailEmitter: ParticleEmitter): void {
    if (!this.ribbonRenderer) {
      return;
    }
    this.ribbonRenderer.setViewDirection(this.viewDirX, this.viewDirY, this.viewDirZ);
    this.ribbonRenderer.generateDynamicData(trailEmitter);
  }

  reset (): void {
    this.spriteRenderer.clear();
    this.ribbonRenderer?.clear();
  }

  updateTime (now: number): void {
    this.spriteRenderer.updateTime(now);
  }

  minusTimeForLoop (duration: number): void {
    this.spriteRenderer.minusTimeForLoop(duration);
  }

  updateWorldMatrix (worldMatrix: Matrix4): void {
    this.spriteRenderer.mesh.worldMatrix = worldMatrix;
    if (this.ribbonRenderer) {
      this.ribbonRenderer.mesh.worldMatrix = worldMatrix;
    }
  }

  setVisible (visible: boolean): void {
    this.spriteRenderer.mesh.setVisible(visible);
    this.ribbonRenderer?.mesh.setVisible(visible);
  }

  getTextures (): Texture[] {
    const textures: Texture[] = [];
    // @ts-expect-error textures 是否可以考虑挂在 Material 上
    const spriteMtlTextures = this.spriteRenderer.mesh.material.textures;

    Object.keys(spriteMtlTextures).forEach(key => {
      textures.push(spriteMtlTextures[key]);
    });
    if (this.ribbonRenderer) {
      // @ts-expect-error 同上
      const ribbonMtlTextures = this.ribbonRenderer.mesh.material.textures;

      Object.keys(ribbonMtlTextures).forEach(key => {
        textures.push(ribbonMtlTextures[key]);
      });
    }

    return textures;
  }
}
