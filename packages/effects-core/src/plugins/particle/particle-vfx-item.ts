import { VFXItem } from '../../vfx-item';
import type { FrameContext } from '../timeline/playable';
import { ClipPlayable, PlayableAsset } from '../timeline/playable';
import { ParticleSystem } from './particle-system';

/**
 * @since 2.0.0
 */
export class ParticleBehaviourPlayable extends ClipPlayable {
  getParticleSystem (boundObject: object | undefined): ParticleSystem | null {
    if (!(boundObject instanceof VFXItem)) {
      return null;
    }

    return boundObject.getComponent(ParticleSystem);
  }

  override evaluate (boundObject: object | undefined, context: FrameContext): void {
    const particleSystem = this.getParticleSystem(boundObject);

    if (!particleSystem) {
      return;
    }

    if (context.time >= 0 && context.time < particleSystem.time) {
      particleSystem.reset();
    }

    const maxSimulateTime = 0.016; // simulate at most 16ms one frame to avoid long time step

    while (particleSystem.time + maxSimulateTime < context.time) {
      particleSystem.simulate(maxSimulateTime);
    }

    particleSystem.simulate(context.time - particleSystem.time);
  }
}

export class ParticleBehaviourPlayableAsset extends PlayableAsset {
  override createPlayable (): ClipPlayable {
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
