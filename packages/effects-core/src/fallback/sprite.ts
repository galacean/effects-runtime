import type {
  BaseItemTransform, NullContent, PositionOverLifetime, RotationOverLifetime,
  ColorOverLifetime, SpriteContent,
} from '@galacean/effects-specification';
import {
  deleteEmptyValue, ensureFixedNumber, ensureFixedVec3, ensureRGBAValue, getGradientColor,
} from './utils';

export function getStandardNullContent (sprite: any, transform: BaseItemTransform): NullContent {
  const opt = sprite.options;
  const velocityOverLifetime = sprite.velocityOverLifetime || {};
  const positionOverLifetime: PositionOverLifetime = {
    path: ensureFixedVec3(sprite.transform?.path),
    gravity: opt.gravity,
    gravityOverLifetime: ensureFixedNumber(opt.gravityModifier),
    direction: opt.direction,
    startSpeed: opt.startSpeed,
    asMovement: velocityOverLifetime.asMovement,
    linearX: ensureFixedNumber(velocityOverLifetime.linearX),
    linearY: ensureFixedNumber(velocityOverLifetime.linearY),
    linearZ: ensureFixedNumber(velocityOverLifetime.linearZ),
    asRotation: velocityOverLifetime.asRotation,
    orbCenter: velocityOverLifetime.orbCenter,
    orbitalX: ensureFixedNumber(velocityOverLifetime.orbitalX),
    orbitalY: ensureFixedNumber(velocityOverLifetime.orbitalY),
    orbitalZ: ensureFixedNumber(velocityOverLifetime.orbitalZ),
    speedOverLifetime: ensureFixedNumber(velocityOverLifetime.speedOverLifetime),
  };

  deleteEmptyValue(positionOverLifetime);
  const ret: NullContent = {
    options: {
      startColor: ensureRGBAValue(opt.startColor),
    },
    positionOverLifetime,
  };

  if (opt.startSize) {
    transform.scale = [opt.startSize, opt.startSize / (opt.sizeAspect || 1), 1];
  }
  if (opt.startRotation) {
    if (!transform.rotation) {
      transform.rotation = [0, 0, opt.startRotation];
    } else {
      transform.rotation[2] += opt.startRotation;
    }
  }
  const rotationOverLifetime = sprite.rotationOverLifetime;

  if (rotationOverLifetime) {
    const rot: RotationOverLifetime = ret.rotationOverLifetime = {
      separateAxes: rotationOverLifetime.separateAxes,
      asRotation: rotationOverLifetime.asRotation,
    };

    if (rot.separateAxes) {
      rot.x = ensureFixedNumber(rotationOverLifetime.x);
      rot.y = ensureFixedNumber(rotationOverLifetime.y);
      rot.z = ensureFixedNumber(rotationOverLifetime.z);
    } else {
      rot.z = ensureFixedNumber(rotationOverLifetime.angularVelocity);
    }
  }

  const colorOverLifetime = sprite.colorOverLifetime;

  if (colorOverLifetime) {
    const col: ColorOverLifetime = ret.colorOverLifetime = {
      opacity: ensureFixedNumber(colorOverLifetime.opacity),
    };

    if (colorOverLifetime.color) {
      col.color = getGradientColor(colorOverLifetime.color);
    }
  }
  const sizeOverLifetime = sprite.sizeOverLifetime;

  if (sizeOverLifetime) {
    ret.sizeOverLifetime = {
      separateAxes: sizeOverLifetime.separateAxes,
      size: ensureFixedNumber(sizeOverLifetime.size),
      x: ensureFixedNumber(sizeOverLifetime.x),
      y: ensureFixedNumber(sizeOverLifetime.y),
      z: ensureFixedNumber(sizeOverLifetime.z),
    };
  }

  return ret;
}

export function getStandardSpriteContent (sprite: any, transform: BaseItemTransform): SpriteContent {
  const ret = getStandardNullContent(sprite, transform) as SpriteContent;
  const texAni = sprite.textureSheetAnimation;

  if (texAni) {
    ret.textureSheetAnimation = {
      row: texAni.row,
      col: texAni.col,
      total: texAni.total || undefined,
      animate: texAni.animate,
    };
  }
  ret.renderer = sprite.renderer;
  if (sprite.splits) {
    ret.splits = sprite.splits;
  }
  if (sprite.interaction) {
    ret.interaction = sprite.interaction;
  }

  return ret;
}
