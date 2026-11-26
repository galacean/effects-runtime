import { Matrix4 } from './core';

export function computeOrthographicOffCenter (
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
) {
  let a = 1.0 / (right - left);
  let b = 1.0 / (top - bottom);
  let c = 1.0 / (far - near);

  const tx = -(right + left) * a;
  const ty = -(top + bottom) * b;
  const tz = -(far + near) * c;

  a *= 2.0;
  b *= 2.0;
  c *= -2.0;

  return new Matrix4(
    a,
    0.0,
    0.0,
    0.0,
    //
    0.0,
    b,
    0.0,
    0.0,
    //
    0.0,
    0.0,
    c,
    0.0,
    //
    tx,
    ty,
    tz,
    1.0,
  );
}
