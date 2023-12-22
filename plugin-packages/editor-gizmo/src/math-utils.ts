import { math } from '@galacean/effects';

type Vector2 = math.Vector2;
type Vector3 = math.Vector3;

const { Matrix4, Vector2 } = math;

export function distanceOfPointAndLine (point: Vector2, line: [Vector2, Vector2]): { distance: number, isInLine: boolean } {
  //三角形三个边长
  const AC = new Vector2();
  const BC = new Vector2();
  const AB = new Vector2();

  AC.subtractVectors(point, line[0]);
  BC.subtractVectors(point, line[1]);
  AB.subtractVectors(line[1], line[0]);
  const lengthAC = AC.length();
  const lengthBC = BC.length();
  const lengthAB = AB.length();

  //利用海伦公式计算三角形面积
  //周长的一半
  const P = (lengthAC + lengthBC + lengthAB) / 2;
  const allArea = Math.abs(Math.sqrt(P * (P - lengthAC) * (P - lengthBC) * (P - lengthAB)));
  //普通公式计算三角形面积反推点到线的垂直距离
  const distance = (2 * allArea) / lengthAB;
  const l1 = Math.sqrt(Math.pow(lengthAC, 2) - Math.pow(distance, 2));
  const l2 = Math.sqrt(Math.pow(lengthBC, 2) - Math.pow(distance, 2));
  let isInLine = false;

  if (l1 <= lengthAB && l2 <= lengthAB) {
    isInLine = true;
  }

  return {
    distance,
    isInLine,
  };
}

export function projectionOfPointAndLine (point: Vector2, line: [Vector3, Vector3]): Vector3 {
  const AC = new Vector2();
  const BC = new Vector2();
  const AB = new Vector2();
  const line0 = line[0].toVector2();
  const line1 = line[1].toVector2();

  AC.subtractVectors(point, line0);
  BC.subtractVectors(point, line1);
  AB.subtractVectors(line1, line0);
  const lengthAC = AC.length();
  const lengthBC = BC.length();
  const lengthAB = AB.length();

  //利用海伦公式计算三角形面积
  //周长的一半
  const P = (lengthAC + lengthBC + lengthAB) / 2;
  const allArea = Math.abs(Math.sqrt(P * (P - lengthAC) * (P - lengthBC) * (P - lengthAB)));
  //普通公式计算三角形面积反推点到线的垂直距离
  const distance = (2 * allArea) / lengthAB;
  const l1 = Math.sqrt(Math.pow(lengthAC, 2) - Math.pow(distance, 2));
  const l2 = Math.sqrt(Math.pow(lengthBC, 2) - Math.pow(distance, 2));

  const worldAB = line[1].clone().subtract(line[0]);

  const worldAP = worldAB.clone().multiply(l1 / (l1 + l2));

  const worldP = line[0].clone().add(worldAP);

  return worldP;
}

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
