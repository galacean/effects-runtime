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
      // const parentItem = this.bindingItem.parent!;

      // TODO: [1.31] @十弦 验证 https://github.com/galacean/effects-runtime/commit/3e7d73d37b7d98c2a25e4544e80e928b17801ccd#diff-fae062f28caf3771cfedd3a20dc22f9749bd054c7541bf2fd50a9a5e413153d4
      // particleSystem.setParentTransform(parentItem.transform);
      particleSystem.setVisible(true);
      particleSystem.onUpdate(dt);
    }
  }
}
