import { getObjectType } from './object-type';

export type AngleType = {
  alpha: number,
  beta: number,
  gamma: number,
};

type RangeType = {
  alpha: number[],
  beta: number[],
  gamma: number[],
};

/**
 * 角度限制
 * @internal
 * @param angleObj 角度数值对象
 * @param validRange 角度限制值
 */
export function angleLimit (angleObj: AngleType, validRange: RangeType) {
  let flagAlpha = true;
  let flagBeta = true;
  let flagGamma = true;

  if (getObjectType(validRange.alpha) === '[object Array]' && validRange.alpha.length >= 2) {
    let referAlphaA = angleObj.alpha + validRange.alpha[0];
    let referAlphaB = angleObj.alpha + validRange.alpha[1];

    referAlphaA = referAlphaA < 0 ? referAlphaA + 360 : referAlphaA;
    referAlphaB = referAlphaB > 360 ? referAlphaB - 360 : referAlphaB;
    if (referAlphaA < referAlphaB) {
      flagAlpha = angleObj.alpha > referAlphaA && angleObj.alpha < referAlphaB;
    } else {
      flagAlpha = angleObj.alpha > referAlphaA || angleObj.alpha < referAlphaB;
    }
  }
  if (getObjectType(validRange.beta) === '[object Array]' && validRange.beta.length >= 2) {
    flagBeta = angleObj.beta >= validRange.beta[0] && angleObj.beta <= validRange.beta[1];
  }
  if (getObjectType(validRange.gamma) === '[object Array]' && validRange.gamma.length >= 2) {
    flagGamma = angleObj.gamma >= validRange.gamma[0] && angleObj.gamma <= validRange.gamma[1];
  }

  return flagAlpha && flagBeta && flagGamma;
}
