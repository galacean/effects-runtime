import type { CameraContent, CameraPositionOverLifetime, RotationOverLifetime } from '@galacean/effects-specification';
import { deleteEmptyValue, ensureFixedNumber, ensureFixedVec3 } from './utils';

export function getStandardCameraContent (model: any): CameraContent {
  const opt = model.options;
  const ret: CameraContent = {
    options: {
      fov: opt.fov!,
      far: opt.far!,
      near: opt.near!,
      clipMode: opt.clipMode,
    },
  };

  const velocityOverLifetime = model.velocityOverLifetime;

  if (velocityOverLifetime || model.transform?.path) {
    const positionOverLifetime: CameraPositionOverLifetime = {
      path: ensureFixedVec3(model.transform?.path),
      linearX: ensureFixedNumber(velocityOverLifetime?.translateX),
      linearY: ensureFixedNumber(velocityOverLifetime?.translateY),
      linearZ: ensureFixedNumber(velocityOverLifetime?.translateZ),
    };

    deleteEmptyValue(positionOverLifetime);
    ret.positionOverLifetime = positionOverLifetime;
  }

  const rol = model.rotationOverLifetime;

  if (rol) {
    const rotationOverLifetime: RotationOverLifetime = {
      separateAxes: rol.separateAxes,
      x: ensureFixedNumber(rol?.rotateX),
      y: ensureFixedNumber(rol?.rotateY),
      z: rol.separateAxes ? ensureFixedNumber(rol?.rotateZ) : ensureFixedNumber(rol.rotation),
    };

    deleteEmptyValue(rotationOverLifetime);
    ret.rotationOverLifetime = rotationOverLifetime;
  }

  return ret;
}
