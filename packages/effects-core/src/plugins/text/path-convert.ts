import * as spec from '@galacean/effects-specification';
import { GraphicsPath } from '../shape/graphics-path';

/**
 * CustomShapeData（钢笔曲线数据）→ GraphicsPath（引擎路径）。
 * 照 shape-component.ts buildPath Custom 分支逻辑：
 * 控制点 easingIn/easingOut 是相对锚点的偏移，拼接时 + 锚点坐标。
 * 多 shape → 多 subpath（每条 moveTo 开始）。
 */
export function customShapeToGraphicsPath (data: spec.CustomShapeData): GraphicsPath {
  const { points, easingIns, easingOuts, shapes } = data;
  const path = new GraphicsPath();

  for (const shape of shapes) {
    const indices = shape.indexes;

    if (indices.length === 0) { continue; }

    const start = points[indices[0].point];

    path.moveTo(start.x, start.y);

    for (let i = 1; i < indices.length; i++) {
      const curIdx = indices[i];
      const lastIdx = indices[i - 1];
      const last = points[lastIdx.point];
      const cur = points[curIdx.point];
      const c1 = easingOuts[lastIdx.easingOut];   // 控制1 = 上一锚点 + 出射偏移
      const c2 = easingIns[curIdx.easingIn];       // 控制2 = 当前锚点 + 入射偏移

      path.bezierCurveTo(c1.x + last.x, c1.y + last.y, c2.x + cur.x, c2.y + cur.y, cur.x, cur.y);
    }

    if (shape.close) {
      const firstIdx = indices[0];
      const lastIdx = indices[indices.length - 1];
      const last = points[lastIdx.point];
      const first = points[firstIdx.point];
      const c1 = easingOuts[lastIdx.easingOut];
      const c2 = easingIns[firstIdx.easingIn];

      path.bezierCurveTo(c1.x + last.x, c1.y + last.y, c2.x + first.x, c2.y + first.y, first.x, first.y);
      path.closePath();
    }
  }

  return path;
}

/**
 * GraphicsPath（引擎路径）→ CustomShapeData（钢笔曲线数据）。
 * 反方向：editor 钢笔加载路径文本的曲线时用。
 * 每个 subpath（moveTo 开始）→ 一条 CustomShape。
 * 控制点转回相对偏移（c1 - lastPoint, c2 - curPoint）。
 */
export function graphicsPathToCustomShape (path: GraphicsPath): spec.CustomShapeData {
  const points: spec.Vector2Data[] = [];
  const easingIns: spec.Vector2Data[] = [];
  const easingOuts: spec.Vector2Data[] = [];
  const shapes: spec.CustomShape[] = [];

  // 每个 subpath 的锚点索引（point/easingIn/easingOut 三套索引递增分配）
  let ptIdx = 0;        // points 数组当前长度（下一个 point 的索引）
  let easeIdx = 0;      // easingIns/easingOuts 数组当前长度

  // 当前 subpath 状态
  let curShapeIdx: spec.CustomShapePoint[] = [];
  let curClosed = false;
  let lastPoint: { x: number, y: number } | null = null;
  let lastEaseOutIdx: number | null = null;
  let hasStarted = false;

  const instructions = (path as unknown as { instructions: Array<{ action: string, data: number[] }> }).instructions;

  for (const ins of instructions) {
    switch (ins.action) {
      case 'moveTo': {
        // 新 subpath 开始：先保存上一个（如果有）
        if (hasStarted && curShapeIdx.length > 0) {
          shapes.push({ indexes: curShapeIdx, close: curClosed });
        }
        curShapeIdx = [];
        curClosed = false;
        lastPoint = null;
        lastEaseOutIdx = null;

        const x = ins.data[0];
        const y = ins.data[1];

        points.push({ x, y });
        // 对应的 easingIn/easingOut 占位（(0,0) 偏移，moveTo 无控制点）
        easingIns.push({ x: 0, y: 0 });
        easingOuts.push({ x: 0, y: 0 });
        curShapeIdx.push({ point: ptIdx, easingIn: easeIdx, easingOut: easeIdx });
        ptIdx++;
        easeIdx++;
        lastPoint = { x, y };
        lastEaseOutIdx = easeIdx - 1;
        hasStarted = true;

        break;
      }
      case 'lineTo': {
        if (!lastPoint) { break; }
        const x = ins.data[0];
        const y = ins.data[1];

        points.push({ x, y });
        easingIns.push({ x: 0, y: 0 });
        easingOuts.push({ x: 0, y: 0 });
        const curPtIdx = ptIdx;
        const curEaseIdx = easeIdx;

        curShapeIdx.push({ point: curPtIdx, easingIn: curEaseIdx, easingOut: curEaseIdx });
        ptIdx++;
        easeIdx++;
        lastPoint = { x, y };
        lastEaseOutIdx = curEaseIdx;

        break;
      }
      case 'bezierCurveTo': {
        // data: [cp1x, cp1y, cp2x, cp2y, x, y]
        if (!lastPoint || lastEaseOutIdx === null) { break; }
        const cp1x = ins.data[0];
        const cp1y = ins.data[1];
        const cp2x = ins.data[2];
        const cp2y = ins.data[3];
        const x = ins.data[4];
        const y = ins.data[5];

        // cp1 是绝对坐标 → 转回相对 lastPoint 的偏移
        easingOuts[lastEaseOutIdx] = { x: cp1x - lastPoint.x, y: cp1y - lastPoint.y };

        // cp2 是绝对坐标 → 转回相对 curPoint 的偏移
        points.push({ x, y });
        const curPtIdx = ptIdx;
        const curEaseIdx = easeIdx;

        easingIns.push({ x: cp2x - x, y: cp2y - y });
        easingOuts.push({ x: 0, y: 0 });  // 当前点的出射先占位，下一段会更新
        curShapeIdx.push({ point: curPtIdx, easingIn: curEaseIdx, easingOut: curEaseIdx });
        ptIdx++;
        easeIdx++;
        lastPoint = { x, y };
        lastEaseOutIdx = curEaseIdx;

        break;
      }
      case 'closePath': {
        curClosed = true;

        break;
      }
    }
  }

  // 保存最后一个 subpath
  if (hasStarted && curShapeIdx.length > 0) {
    shapes.push({ indexes: curShapeIdx, close: curClosed });
  }

  return {
    type: spec.ShapePrimitiveType.Custom,
    points,
    easingIns,
    easingOuts,
    shapes,
    strokes: [],
    fills: [],
  } as unknown as spec.CustomShapeData;
}
