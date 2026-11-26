import { Vector2, type Vector3 } from './core';

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
