import type { ParticleContent, ParticleShape, ParticleShapeSphere, ColorOverLifetime } from '@galacean/effects-specification';
import { ParticleEmitterShapeType } from '@galacean/effects-specification';
import {
  deleteEmptyValue, ensureColorExpression, ensureFixedNumber, ensureFixedNumberWithRandom,
  ensureFixedVec3, ensureNumberExpression, getGradientColor, objectValueToNumber,
} from './utils';

export function getStandardParticleContent (particle: any): ParticleContent {
  const options = particle.options;
  const transform = particle.transform;
  let shape: ParticleShape = {
    type: ParticleEmitterShapeType.NONE,
  };

  if (particle.shape) {
    const shapeType = particle.shape.shape?.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');

    shape = {
      ...particle.shape,
      type: ParticleEmitterShapeType[shapeType as keyof typeof ParticleEmitterShapeType],
    };
    if (particle.shape.upDirection) {
      const [x, y, z] = particle.shape.upDirection;

      if (x === 0 && y === 0 && z === 0) {
        delete (shape as ParticleShapeSphere).upDirection;
      }
    }
  }
  if (options.startTurbulence) {
    shape.turbulenceX = ensureNumberExpression(options.turbulenceX);
    shape.turbulenceY = ensureNumberExpression(options.turbulenceY);
    shape.turbulenceZ = ensureNumberExpression(options.turbulenceZ);
  }
  const emission = particle.emission;

  if (emission.bursts && emission.bursts.length > 0) {
    emission.bursts = emission.bursts.map((b: any) => objectValueToNumber(b));
  }
  if (emission.burstOffsets && emission.burstOffsets.length > 0) {
    emission.burstOffsets = emission.burstOffsets.map((b: any) => objectValueToNumber(b));
  }
  if (emission.rateOverTime) {
    emission.rateOverTime = ensureNumberExpression(emission.rateOverTime);
  }

  const ret: ParticleContent = {
    renderer: particle.renderer,
    shape,
    splits: particle.splits,
    emission: emission,
    options: {
      startLifetime: ensureNumberExpression(options.startLifetime)!,
      start3DSize: !!options.start3DSize,
      startSize: ensureNumberExpression(options.startSize),
      startSizeX: ensureNumberExpression(options.startSizeX),
      startSizeY: ensureNumberExpression(options.startSizeY),
      sizeAspect: ensureNumberExpression(options.sizeAspect),
      maxCount: options.maxCount,
      startDelay: ensureNumberExpression(options.startDelay),
      startColor: ensureColorExpression(options.startColor, true),
      startRotationZ: ensureNumberExpression(options.startRotation || options.startRotationZ),
      particleFollowParent: options.particleFollowParent,
    },
  };

  if (options.start3DRotation) {
    ret.options.startRotationX = ensureNumberExpression(options.startRotationX);
    ret.options.startRotationY = ensureNumberExpression(options.startRotationY);
  }

  if (transform && transform.path) {
    ret.emitterTransform = {
      path: ensureFixedVec3(transform.path),
    };
  }
  const sizeOverLifetime = particle.sizeOverLifetime;

  if (sizeOverLifetime) {
    if (sizeOverLifetime.separateAxes) {
      ret.sizeOverLifetime = {
        separateAxes: true,
        x: ensureNumberExpression(sizeOverLifetime.x),
        y: ensureNumberExpression(sizeOverLifetime.y),
      };
    } else {
      ret.sizeOverLifetime = {
        size: ensureNumberExpression(sizeOverLifetime.size),
      };
    }
  }
  const velocityOverLifetime = particle.velocityOverLifetime || {};
  let sol = velocityOverLifetime.speedOverLifetime;

  if (sol) {
    sol = ensureFixedNumber(sol);
  } else {
    sol = undefined;
  }
  ret.positionOverLifetime = {
    gravity: options.gravity,
    gravityOverLifetime: ensureFixedNumber(options.gravityModifier),
    startSpeed: ensureNumberExpression(options.startSpeed),
    speedOverLifetime: sol,
    asMovement: velocityOverLifetime.asMovement,
    linearX: ensureNumberExpression(velocityOverLifetime.linearX),
    linearY: ensureNumberExpression(velocityOverLifetime.linearY),
    linearZ: ensureNumberExpression(velocityOverLifetime.linearZ),
    asRotation: velocityOverLifetime.asRotation,
    orbCenter: velocityOverLifetime.orbCenter,
    orbitalX: ensureNumberExpression(velocityOverLifetime.orbitalX),
    orbitalY: ensureNumberExpression(velocityOverLifetime.orbitalY),
    orbitalZ: ensureNumberExpression(velocityOverLifetime.orbitalZ),
    forceTarget: velocityOverLifetime.forceTarget,
    target: velocityOverLifetime.target,
    forceCurve: ensureFixedNumber(velocityOverLifetime.forceCurve) as any,
  };
  deleteEmptyValue(ret.positionOverLifetime);
  const rotationOverLifetime = particle.rotationOverLifetime;

  if (rotationOverLifetime) {
    ret.rotationOverLifetime = {
      separateAxes: rotationOverLifetime.separateAxes,
      asRotation: rotationOverLifetime.asRotation,
      z: ensureNumberExpression(rotationOverLifetime.separateAxes ? rotationOverLifetime.z : rotationOverLifetime.angularVelocity),
    };
    if (rotationOverLifetime.separateAxes) {
      ret.rotationOverLifetime.y = ensureFixedNumber(rotationOverLifetime.y);
      ret.rotationOverLifetime.x = ensureFixedNumber(rotationOverLifetime.x);
    }
  }
  const colorOverLifetime = particle.colorOverLifetime;

  if (colorOverLifetime) {
    const col: ColorOverLifetime = ret.colorOverLifetime = {
      opacity: ensureFixedNumber(colorOverLifetime.opacity),
    };

    if (colorOverLifetime.color) {
      col.color = getGradientColor(colorOverLifetime.color);
    }
  }
  const textureSheetAnimation = particle.textureSheetAnimation;

  if (textureSheetAnimation) {
    // @ts-expect-error
    ret.textureSheetAnimation = {
      row: textureSheetAnimation.row,
      col: textureSheetAnimation.col,
      total: textureSheetAnimation.total,
      animate: textureSheetAnimation.animate,
      cycles: ensureFixedNumber(textureSheetAnimation.cycles)!,
      animationDelay: ensureFixedNumberWithRandom(textureSheetAnimation.animationDelay, 0),
      animationDuration: ensureFixedNumberWithRandom(textureSheetAnimation.animationDuration, 0)!,
    };
  }
  const trials = particle.trails;

  if (trials) {
    ret.trails = {
      lifetime: ensureNumberExpression(trials.lifetime)!,
      dieWithParticles: trials.dieWithParticles,
      maxPointPerTrail: trials.maxPointPerTrail,
      minimumVertexDistance: trials.minimumVertexDistance,
      widthOverTrail: ensureFixedNumber(trials.widthOverTrail)!,
      colorOverTrail: trials.colorOverTrail && getGradientColor(trials.colorOverTrail, false),
      blending: trials.blending,
      colorOverLifetime: trials.colorOverLifetime && getGradientColor(trials.colorOverLifetime, false),
      inheritParticleColor: trials.inheritParticleColor,
      occlusion: trials.occlusion,
      transparentOcclusion: trials.transparentOcclusion,
      orderOffset: trials.orderOffset,
      sizeAffectsLifetime: trials.sizeAffectsLifetime,
      sizeAffectsWidth: trials.sizeAffectsWidth,
      texture: trials.texture,
      parentAffectsPosition: trials.parentAffectsPosition,
      opacityOverLifetime: ensureNumberExpression(trials.opacityOverLifetime),
    };
  }
  ret.trails && deleteEmptyValue(ret.trails);
  const interaction = particle.interaction;

  if (interaction) {
    ret.interaction = {
      behavior: interaction.behavior,
      radius: interaction.radius,
      multiple: interaction.multiple,
    };
  }

  return ret;
}
