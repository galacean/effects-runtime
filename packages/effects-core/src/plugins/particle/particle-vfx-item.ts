import { VFXItem } from '../../vfx-item';
import type { FrameContext } from '../cal/playable-graph';
import { Playable, PlayableAsset } from '../cal/playable-graph';
import { ParticleSystem } from './particle-system';

/**
 * @since 2.0.0
 */
export class ParticleBehaviourPlayable extends Playable {
  lastTime = 0;
  particleSystem: ParticleSystem;

  start (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (this.particleSystem || !(boundObject instanceof VFXItem)) {
      return;
    }
    this.particleSystem = boundObject.getComponent(ParticleSystem);

    if (this.particleSystem) {
      this.particleSystem.name = boundObject.name;
    }
  }

  override processFrame (context: FrameContext): void {
    if (this.time >= 0) {
      this.start(context);
    }
    const particleSystem = this.particleSystem;

    if (particleSystem) {
      if (
        this.time >= 0 &&
        this.time < particleSystem.item.duration &&
        particleSystem.isEnded()
      ) {
        particleSystem.reset();
      }
      particleSystem.update(this.time - particleSystem.time);
    }
    this.lastTime = this.time;
  }
}

export class ParticleBehaviourPlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    return new ParticleBehaviourPlayable();
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
