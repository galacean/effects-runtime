import * as spec from '@galacean/effects-specification';
import type { Ray, Vector3 } from '@galacean/effects-math/es/core/index';
import type { Composition } from '../../composition';
import { assertExist, DestroyOptions } from '../../utils';
import { VFXItem } from '../../vfx-item';
import type { BoundingBoxSphere, HitTestCustomParams } from '../interact/click-handler';
import { HitTestType } from '../interact/click-handler';
import type { ParticleSystemProps } from './particle-system';
import { ParticleSystem } from './particle-system';

export class ParticleVFXItem extends VFXItem<ParticleSystem> {
  override name: string;
  particle: ParticleSystemProps;

  private destroyed: boolean;

  override get type () {
    return spec.ItemType.particle;
  }

  override onConstructed (props: spec.ParticleItem) {
    this.particle = props.content as unknown as ParticleSystemProps;
  }

  override onLifetimeBegin (composition: Composition, particleSystem: ParticleSystem) {
    if (particleSystem) {
      particleSystem.name = this.name;
      particleSystem.start();
      particleSystem.onDestroy = () => {
        this.destroyed = true;
      };
    }

    return particleSystem;
  }

  override onItemUpdate (dt: number, lifetime: number) {
    if (this.content) {
      let hide = !this.contentVisible;

      const parentItem = this.parentId && this.composition?.getItemByID(this.parentId);

      if (!hide && parentItem) {
        const parentData = parentItem.getRenderData();

        if (parentData) {
          this.content.setParentTransform(parentData.transform);
          if (!parentData.visible) {
            hide = false;
          }
        }
      }
      if (hide) {
        this.content.setVisible(false);
      } else {
        this.content.setVisible(true);
        this.content.onUpdate(dt);
      }

    }
  }

  override onItemRemoved (composition: Composition, content: ParticleSystem) {
    if (content) {
      composition.destroyTextures(content.getTextures());
      content.meshes.forEach(mesh => mesh.dispose({ material: { textures: DestroyOptions.keep } }));
    }
  }

  /**
   * @internal
   */
  override setColor (r: number, g: number, b: number, a: number) {
    this.content.setColor(r, g, b, a);
  }

  override setOpacity (opacity: number) {
    this.content.setOpacity(opacity);
  }

  stopParticleEmission () {
    if (this.content) {
      this.content.emissionStopped = true;
    }
  }

  resumeParticleEmission () {
    if (this.content) {
      this.content.emissionStopped = false;
    }
  }

  protected override doCreateContent (composition: Composition) {
    assertExist(this.particle);

    return new ParticleSystem(this.particle, composition.getRendererOptions(), this);
  }

  override isEnded (now: number): boolean {
    return super.isEnded(now) && this.destroyed;
  }

  override getBoundingBox (): void | BoundingBoxSphere {
    const pt = this.content;

    if (!pt) {
      return;
    } else {
      const area = pt.getParticleBoxes();

      return {
        type: HitTestType.sphere,
        area,
      };
    }
  }

  override getHitTestParams (force?: boolean): void | HitTestCustomParams {
    const interactParams = this.content?.interaction;

    if (force || interactParams) {
      return {
        type: HitTestType.custom,
        collect: (ray: Ray): Vector3[] | void =>
          this.content?.raycast({
            radius: interactParams?.radius || 0.4,
            multiple: !!interactParams?.multiple,
            removeParticle: interactParams?.behavior === spec.ParticleInteractionBehavior.removeParticle,
            ray,
          }),
      };
    }
  }
}
