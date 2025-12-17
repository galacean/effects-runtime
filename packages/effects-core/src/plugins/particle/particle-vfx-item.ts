import { VFXItem } from '../../vfx-item';
import type { FrameContext } from '../timeline/playable';
import { Playable, PlayableAsset } from '../timeline/playable';
import { ParticleSystem } from './particle-system';

/**
 * @since 2.0.0
 */
export class ParticleBehaviourPlayable extends Playable {
  private particleSystem: ParticleSystem;

  getParticleSystem (context: FrameContext): ParticleSystem | null {
    const boundObject = context.output.getUserData();

    if (this.particleSystem) {
      return this.particleSystem;
    }

    if (!(boundObject instanceof VFXItem)) {
      return null;
    }

    this.particleSystem = boundObject.getComponent(ParticleSystem);

    if (this.particleSystem) {
      this.particleSystem.name = boundObject.name;
    }

    return this.particleSystem;
  }

  override processFrame (context: FrameContext): void {
    const particleSystem = this.getParticleSystem(context);

    if (!particleSystem) {
      return;
    }

    if (particleSystem) {
      if (
        this.time >= 0 &&
        this.time < particleSystem.item.duration &&
        particleSystem.isEnded()
      ) {
        particleSystem.reset();
      }
      particleSystem.simulate(context.deltaTime);
    }
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
