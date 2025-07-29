// ----------------------------------------------------
// HELPER FUNCTIONS

import { ImGui } from '../../imgui';

type ImVec2 = ImGui.ImVec2;
type ImColor = ImGui.ImColor;
const ImVec2 = ImGui.ImVec2;
const ImColor = ImGui.ImColor;

// Helper functions for vector operations
export function add (p1: ImVec2, p2: ImVec2): ImVec2 {
  return new ImVec2(p1.x + p2.x, p1.y + p2.y);
}

export function addMultiple (...vecs: ImVec2[]): ImVec2 {
  return vecs.reduce((acc, vec) => add(acc, vec), new ImVec2());
}

export function subtract (p1: ImVec2, p2: ImVec2): ImVec2 {
  return new ImVec2(p1.x - p2.x, p1.y - p2.y);
}

export function multiplyScalar (p: ImVec2, scalar: number): ImVec2 {
  return new ImVec2(p.x * scalar, p.y * scalar);
}

export function div (p: ImVec2, scalar: number): ImVec2 {
  return new ImVec2(p.x / scalar, p.y / scalar);
}

export function dot (p1: ImVec2, p2: ImVec2): number {
  return p1.x * p2.x + p1.y * p2.y;
}

export function lengthSqr (p: ImVec2): number {
  return p.x * p.x + p.y * p.y;
}

export function length (p: ImVec2): number {
  return Math.sqrt(lengthSqr(p));
}

export function normalize (p: ImVec2): ImVec2 {
  return div(p, length(p));
}

export function lerp (from: ImVec2, to: ImVec2, t: number): ImVec2 {
  if (t < 0.0 || t > 1.0) {
    throw new Error('t must be between 0 and 1');
  }

  return new ImVec2(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
}

export function colorMultiplyScalar (p: ImColor, scalar: number): ImColor {
  const value = p.Value;

  return new ImColor(value.x * scalar, value.y * scalar, value.z * scalar, value.w);
}

export function fmodf (a: number, b: number): number { return a - (Math.floor(a / b) * b); }

/**
 * Draw a sensible bezier between two points
 * @param p1 Starting point
 * @param p2 Ending point
 * @param color Color of the curve
 * @param thickness Thickness of the curve
 */
export function smart_bezier (p1: ImGui.ImVec2, p2: ImGui.ImVec2, color: number, thickness: number): void {
  const drawList: ImGui.ImDrawList = ImGui.GetWindowDrawList();
  const distance = Math.sqrt(Math.pow((p2.x - p1.x), 2) + Math.pow((p2.y - p1.y), 2));
  let delta = distance * 0.45;

  if (p2.x < p1.x) {delta += 0.2 * (p1.x - p2.x);}
  // let vert = (p2.x < p1.x - 20.f) ? 0.062f * distance * (p2.y - p1.y) * 0.005f : 0.f;
  const vert = 0;
  const p22 = new ImGui.ImVec2(p2.x - delta, p2.y - vert);

  if (p2.x < p1.x - 50) {delta *= -1;}
  const p11 = new ImGui.ImVec2(p1.x + delta, p1.y + vert);

  drawList.AddBezierCubic(p1, p11, p22, p2, color, thickness);
}

/**
   * 判断点p是否在由p1和p2定义的Bezier曲线的碰撞区域内
   * @param p 点 to be tested
   * @param p1 Bezier曲线的起点
   * @param p2 Bezier曲线的终点
   * @param radius 碰撞半径
   * @returns 如果点p在碰撞区域内，返回true；否则返回false
   */
export function smart_bezier_collider (p: ImVec2, p1: ImVec2, p2: ImVec2, radius: number): boolean {
  // 计算p1到p2的距离
  const dist = distance(p1, p2);
  let delta = dist * 0.45;

  // 如果p2在p1的左侧，调整delta
  if (p2.x < p1.x) {
    delta += 0.2 * (p1.x - p2.x);
  }

  // 垂直偏移量，当前固定为0
  const vert = 0.0;

  // 计算控制点p11和p22
  const p22 = new ImVec2(p2.x - delta, p2.y - vert);

  // 如果p2.x差异较大，反转delta
  if (p2.x < p1.x - 50) {
    delta *= -1.0;
  }

  const p11 = new ImVec2(p1.x + delta, p1.y + vert);

  // 投影点p到Bezier曲线上，并获取距离
  const projection = ImProjectOnCubicBezier(p, p1, p11, p22, p2);

  // 判断距离是否小于碰撞半径
  return projection.Distance < radius;
}

export interface ImProjectResult {
  Point: ImVec2,
  Time: number,
  Distance: number,
}

/**
   * 计算两点之间的距离
   * @param p1 点1
   * @param p2 点2
   * @returns 距离
   */
export function distance (p1: ImVec2, p2: ImVec2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
   * 投影点到三次Bezier曲线上，并计算距离
   * @param point 点
   * @param p0 起点
   * @param p1 控制点1
   * @param p2 控制点2
   * @param p3 终点
   * @param subdivisions 分割步数
   * @returns 投影结果
   */
export function ImProjectOnCubicBezier (point: ImVec2, p0: ImVec2, p1: ImVec2, p2: ImVec2, p3: ImVec2, subdivisions = 100): ImProjectResult {
  const epsilon = 1e-5;
  const fixed_step = 1.0 / (subdivisions - 1);

  const result: ImProjectResult = {
    Point: point, // default
    Time: 0.0,
    Distance: Infinity,
  };

  // Step 1: Coarse check
  for (let i = 0; i < subdivisions; i++) {
    const t = i * fixed_step;
    const p = ImCubicBezier(p0, p1, p2, p3, t);
    const s = subtract(point, p);
    const d = dot(s, s);

    if (d < result.Distance) {
      result.Point = p;
      result.Time = t;
      result.Distance = d;
    }
  }

  if (result.Time === 0.0 || Math.abs(result.Time - 1.0) <= epsilon) {
    result.Distance = Math.sqrt(result.Distance);

    return result;
  }

  // Step 2: Fine check
  const left = result.Time - fixed_step;
  const right = result.Time + fixed_step;
  const step = fixed_step * 0.1;

  for (let t = left; t < right + step; t += step) {
    const p = ImCubicBezier(p0, p1, p2, p3, t);
    const s = subtract(point, p);
    const d = dot(s, s);

    if (d < result.Distance) {
      result.Point = p;
      result.Time = t;
      result.Distance = d;
    }
  }

  result.Distance = Math.sqrt(result.Distance);

  return result;
}

/**
   * 计算三次Bezier曲线上的点
   * @param p0 起点
   * @param p1 第一个控制点
   * @param p2 第二个控制点
   * @param p3 终点
   * @param t 参数 t [0,1]
   * @returns 三次Bezier曲线上的点
   */
export function ImCubicBezier (p0: ImVec2, p1: ImVec2, p2: ImVec2, p3: ImVec2, t: number): ImVec2 {
  const a = 1 - t;
  const b = a * a * a;
  const c = t * t * t;

  return add(
    add(
      add(
        multiplyScalar(p0, b),
        multiplyScalar(p1, 3 * t * a * a)
      ),
      multiplyScalar(p2, 3 * t * t * a)
    ),
    multiplyScalar(p3, c)
  );
}