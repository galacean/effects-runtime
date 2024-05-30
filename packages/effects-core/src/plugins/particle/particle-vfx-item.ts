import type { VFXItem } from '../../vfx-item';
import type { FrameContext, PlayableGraph } from '../cal/playable-graph';
import { Playable, PlayableAsset } from '../cal/playable-graph';
import { ParticleSystem } from './particle-system';

/**
 * @since 2.0.0
 * @internal
 */
export class ParticleBehaviourPlayable extends Playable {
  particleSystem: ParticleSystem;

  override onPlayablePlay (context: FrameContext): void {
    const binding = context.output.getUserData() as VFXItem;

    this.particleSystem = binding.getComponent(ParticleSystem);

    if (this.particleSystem) {
      this.particleSystem.name = binding.name;
      this.particleSystem.start();
      this.particleSystem.initEmitterTransform();
    }
  }

  override processFrame (context: FrameContext): void {
    const particleSystem = this.particleSystem;

    if (particleSystem) {
      // const parentItem = this.bindingItem.parent!;

      // TODO: [1.31] @十弦 验证 https://github.com/galacean/effects-runtime/commit/3e7d73d37b7d98c2a25e4544e80e928b17801ccd#diff-fae062f28caf3771cfedd3a20dc22f9749bd054c7541bf2fd50a9a5e413153d4
      // particleSystem.setParentTransform(parentItem.transform);
      particleSystem.setVisible(true);
      particleSystem.onUpdate(context.deltaTime);
    }
  }
}

export class ParticleBehaviourPlayableAsset extends PlayableAsset {
  override createPlayable (graph: PlayableGraph): Playable {
    return new ParticleBehaviourPlayable(graph);
  }
}

export const particleUniformTypeMap: Record<string, string> = {
  'uSprite': 'vec4',
  'uParams': 'vec4',
  'uAcceleration': 'vec4',
  'uGravityModifierValue': 'vec4',
  'uOpacityOverLifetimeValue': 'vec4',
  'uRXByLifeTimeValue': 'vec4',
  'uRYByLifeTimeValue': 'vec4',
  'uRZByLifeTimeValue': 'vec4',
  'uLinearXByLifetimeValue': 'vec4',
  'uLinearYByLifetimeValue': 'vec4',
  'uLinearZByLifetimeValue': 'vec4',
  'uSpeedLifetimeValue': 'vec4',
  'uOrbXByLifetimeValue': 'vec4',
  'uOrbYByLifetimeValue': 'vec4',
  'uOrbZByLifetimeValue': 'vec4',
  'uSizeByLifetimeValue': 'vec4',
  'uSizeYByLifetimeValue': 'vec4',
  'uColorParams': 'vec4',
  'uFSprite': 'vec4',
  'uPreviewColor': 'vec4',
  'uVCurveValues': 'vec4Array',
  'uFCurveValues': 'vec4',
  'uFinalTarget': 'vec3',
  'uForceCurve': 'vec4',
  'uOrbCenter': 'vec3',
  'uTexOffset': 'vec2',
  'uPeriodValue': 'vec4',
  'uMovementValue': 'vec4',
  'uStrengthValue': 'vec4',
  'uWaveParams': 'vec4',
};
