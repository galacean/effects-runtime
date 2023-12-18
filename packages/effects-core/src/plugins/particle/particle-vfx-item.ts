import { Playable } from '../cal/playable-graph';
import { ParticleSystem } from './particle-system';

/**
 * @since 2.0.0
 * @internal
 */
export class ParticleBehaviourPlayable extends Playable {
  particleSystem: ParticleSystem;

  override onPlayablePlay (): void {
    this.particleSystem = this.bindingItem.getComponent(ParticleSystem)!;

    if (this.particleSystem) {
      this.particleSystem.name = this.bindingItem.name;
      this.particleSystem.start();
      this.particleSystem.initEmitterTransform();
    }
  }

  override processFrame (dt: number): void {
    const particleSystem = this.particleSystem;

    if (particleSystem) {
      const parentItem = this.bindingItem.parent!;

      particleSystem.setParentTransform(parentItem.transform);
      particleSystem.setVisible(true);
      particleSystem.onUpdate(dt);
    }
  }
}
