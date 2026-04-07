// Based on:
// https://github.com/pixijs/pixijs/blob/dev/src/scene/graphics/shared/buildCommands/buildLine.ts

import { NumberEpsilon } from '@galacean/effects-math/es/core/utils';
import * as spec from '@galacean/effects-specification';
import { Point } from './point';

export const closePointEps = 1e-4;
export const curveEps = 0.0001;

/**
 * Buffers vertices to draw a square cap.
 *
 * @internal
 * @private
 * @param x - X-coord of end point
 * @param y - Y-coord of end point
 * @param nx - X-coord of line normal pointing inside
 * @param ny - Y-coord of line normal pointing inside
 * @param innerWeight - Weight of inner points
 * @param outerWeight - Weight of outer points
 * @param clockwise - Whether the cap is drawn clockwise
 * @param verts - vertex buffer
 * @returns - no. of vertices pushed
 */
function square (
  x: number,
  y: number,
  nx: number,
  ny: number,
  innerWeight: number,
  outerWeight: number,
  clockwise: boolean, /* rotation for square (true at left end, false at right end) */
  verts: Array<number>
): number {
  const ix = x - (nx * innerWeight);
  const iy = y - (ny * innerWeight);
  const ox = x + (nx * outerWeight);
  const oy = y + (ny * outerWeight);

  /* Rotate nx,ny for extension vector */
  let exx;
  let eyy;

  if (clockwise) {
    exx = ny;
    eyy = -nx;
  } else {
    exx = -ny;
    eyy = nx;
  }

  /* [i|0]x,y extended at cap */
  const eix = ix + exx;
  const eiy = iy + eyy;
  const eox = ox + exx;
  const eoy = oy + eyy;

  /* Square itself must be inserted clockwise*/
  verts.push(eix, eiy);
  verts.push(eox, eoy);

  return 2;
}

/**
 * Buffers vertices to draw an arc at the line joint or cap.
 *
 * @internal
 * @private
 * @param cx - X-coord of center
 * @param cy - Y-coord of center
 * @param sx - X-coord of arc start
 * @param sy - Y-coord of arc start
 * @param ex - X-coord of arc end
 * @param ey - Y-coord of arc end
 * @param verts - buffer of vertices
 * @param clockwise - orientation of vertices
 * @returns - no. of vertices pushed
 */
function round (
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  verts: number[],
  clockwise: boolean, /* if not cap, then clockwise is turn of joint, otherwise rotation from angle0 to angle1 */
): number {
  const cx2p0x = sx - cx;
  const cy2p0y = sy - cy;

  let angle0 = Math.atan2(cx2p0x, cy2p0y);
  let angle1 = Math.atan2(ex - cx, ey - cy);

  if (clockwise && angle0 < angle1) {
    angle0 += Math.PI * 2;
  } else if (!clockwise && angle0 > angle1) {
    angle1 += Math.PI * 2;
  }

  let startAngle = angle0;
  const angleDiff = angle1 - angle0;
  const absAngleDiff = Math.abs(angleDiff);

  const radius = Math.sqrt((cx2p0x * cx2p0x) + (cy2p0y * cy2p0y));
  const segCount = ((15 * absAngleDiff * Math.sqrt(radius) / Math.PI) >> 0) + 1;
  const angleInc = angleDiff / segCount;

  startAngle += angleInc;

  if (clockwise) {
    verts.push(cx, cy);
    verts.push(sx, sy);

    for (let i = 1, angle = startAngle; i < segCount; i++, angle += angleInc) {
      verts.push(cx, cy);
      verts.push(cx + ((Math.sin(angle) * radius)),
        cy + ((Math.cos(angle) * radius)));
    }

    verts.push(cx, cy);
    verts.push(ex, ey);
  } else {
    verts.push(sx, sy);
    verts.push(cx, cy);

    for (let i = 1, angle = startAngle; i < segCount; i++, angle += angleInc) {
      verts.push(cx + ((Math.sin(angle) * radius)),
        cy + ((Math.cos(angle) * radius)));
      verts.push(cx, cy);
    }

    verts.push(ex, ey);
    verts.push(cx, cy);
  }

  return segCount * 2;
}

function getOrientationOfPoints (points: number[]): number {
  const m = points.length;

  if (m < 6) {
    return 1;
  }

  let area = 0;

  for (let i = 0, x1 = points[m - 2], y1 = points[m - 1]; i < m; i += 2) {
    const x2 = points[i];
    const y2 = points[i + 1];

    area += (x2 - x1) * (y2 + y1);

    x1 = x2;
    y1 = y2;
  }

  if (area < 0) {
    return -1;
  }

  return 1;
}

/**
 * A stroke attribute object, used to define properties for a stroke.
 */
export interface StrokeAttributes {
  /** The width of the stroke. */
  width: number,
  /** The alignment of the stroke. */
  alignment: number,
  /** The line cap style to use. */
  cap: spec.LineCap,
  /** The line join style to use. */
  join: spec.LineJoin,
  /** The miter limit to use. */
  miterLimit: number,
  /** Stroke color */
}

/**
 * Builds a line to draw using the polygon method.
 * @param points
 * @param lineStyle
 * @param flipAlignment
 * @param closed
 * @param vertices
 * @param _verticesStride
 * @param _verticesOffset
 * @param indices
 * @param _indicesOffset
 */
export function buildLine (
  points: number[],
  lineStyle: StrokeAttributes,
  flipAlignment: boolean,
  closed: boolean,
  // alignment:number,

  vertices: number[],
  _verticesStride: number,
  _verticesOffset: number,

  indices: number[],
  _indicesOffset: number,
): void {
  // const shape = graphicsData.shape as Polygon;
  // let points = graphicsData.points || shape.points.slice();
  const eps = closePointEps;

  if (points.length === 0) {
    return;
  }

  const style = lineStyle;

  let alignment = style.alignment;

  if (lineStyle.alignment !== 0.5) {
    // rotate the points!
    let orientation = getOrientationOfPoints(points);

    if (flipAlignment) { orientation *= -1; }

    alignment = ((alignment - 0.5) * orientation) + 0.5;
  }

  // get first and last point.. figure out the middle!
  const firstPoint = new Point(points[0], points[1]);
  const lastPoint = new Point(points[points.length - 2], points[points.length - 1]);
  const closedShape = closed;
  const closedPath = Math.abs(firstPoint.x - lastPoint.x) < eps
    && Math.abs(firstPoint.y - lastPoint.y) < eps;

  // if the first point is the last point - gonna have issues :)
  if (closedShape) {
    // need to clone as we are going to slightly modify the shape..
    points = points.slice();

    if (closedPath) {
      points.pop();
      points.pop();
      lastPoint.set(points[points.length - 2], points[points.length - 1]);
    }

    const midPointX = (firstPoint.x + lastPoint.x) * 0.5;
    const midPointY = (lastPoint.y + firstPoint.y) * 0.5;

    points.unshift(midPointX, midPointY);
    points.push(midPointX, midPointY);
  }

  const verts = vertices;

  const length = points.length / 2;
  let indexCount = points.length;
  const indexStart = verts.length / 2;

  // Max. inner and outer width
  const width = style.width / 2;
  const widthSquared = width * width;
  const miterLimitSquared = style.miterLimit * style.miterLimit;

  /* Line segments of interest where (x1,y1) forms the corner. */
  let x0 = points[0];
  let y0 = points[1];
  let x1 = points[2];
  let y1 = points[3];
  let x2 = 0;
  let y2 = 0;

  /* perp[?](x|y) = the line normal with magnitude lineWidth. */
  let perpX = -(y0 - y1);
  let perpY = x0 - x1;
  let perp1x = 0;
  let perp1y = 0;

  // 计算向量长度并添加极小值 NumberEpsilon 以避免除以零的情况。
  let dist = Math.sqrt((perpX * perpX) + (perpY * perpY)) + NumberEpsilon;

  perpX /= dist;
  perpY /= dist;
  perpX *= width;
  perpY *= width;

  const ratio = alignment;// 0.5;
  const innerWeight = (1 - ratio) * 2;
  const outerWeight = ratio * 2;

  if (!closedShape) {
    if (style.cap === spec.LineCap.Round) {
      indexCount += round(
        x0 - (perpX * (innerWeight - outerWeight) * 0.5),
        y0 - (perpY * (innerWeight - outerWeight) * 0.5),
        x0 - (perpX * innerWeight),
        y0 - (perpY * innerWeight),
        x0 + (perpX * outerWeight),
        y0 + (perpY * outerWeight),
        verts,
        true,
      ) + 2;
    } else if (style.cap === spec.LineCap.Square) {
      indexCount += square(x0, y0, perpX, perpY, innerWeight, outerWeight, true, verts);
    }
  }

  // Push first point (below & above vertices)
  verts.push(
    x0 - (perpX * innerWeight),
    y0 - (perpY * innerWeight));
  verts.push(
    x0 + (perpX * outerWeight),
    y0 + (perpY * outerWeight));

  for (let i = 1; i < length - 1; ++i) {
    x0 = points[(i - 1) * 2];
    y0 = points[((i - 1) * 2) + 1];

    x1 = points[i * 2];
    y1 = points[(i * 2) + 1];

    x2 = points[(i + 1) * 2];
    y2 = points[((i + 1) * 2) + 1];

    perpX = -(y0 - y1);
    perpY = x0 - x1;

    dist = Math.sqrt((perpX * perpX) + (perpY * perpY)) + NumberEpsilon;
    perpX /= dist;
    perpY /= dist;
    perpX *= width;
    perpY *= width;

    perp1x = -(y1 - y2);
    perp1y = x1 - x2;

    dist = Math.sqrt((perp1x * perp1x) + (perp1y * perp1y)) + NumberEpsilon;
    perp1x /= dist;
    perp1y /= dist;
    perp1x *= width;
    perp1y *= width;

    /* d[x|y](0|1) = the component displacement between points p(0,1|1,2) */
    const dx0 = x1 - x0;
    const dy0 = y0 - y1;
    const dx1 = x1 - x2;
    const dy1 = y2 - y1;

    /* +ve if internal angle < 90 degree, -ve if internal angle > 90 degree. */
    const dot = (dx0 * dx1) + (dy0 * dy1);
    /* +ve if internal angle counterclockwise, -ve if internal angle clockwise. */
    const cross = (dy0 * dx1) - (dy1 * dx0);
    const clockwise = (cross < 0);

    /* Going nearly parallel? */
    /* atan(0.001) ~= 0.001 rad ~= 0.057 degree */
    if (Math.abs(cross) < 0.001 * Math.abs(dot)) {
      verts.push(
        x1 - (perpX * innerWeight),
        y1 - (perpY * innerWeight));
      verts.push(
        x1 + (perpX * outerWeight),
        y1 + (perpY * outerWeight));

      /* 180 degree corner? */
      if (dot >= 0) {
        if (style.join === spec.LineJoin.Round) {
          indexCount += round(
            x1, y1,
            x1 - (perpX * innerWeight), y1 - (perpY * innerWeight),
            x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight),
            verts, false) + 4;
        } else {
          indexCount += 2;
        }

        verts.push(
          x1 - (perp1x * outerWeight),
          y1 - (perp1y * outerWeight));
        verts.push(
          x1 + (perp1x * innerWeight),
          y1 + (perp1y * innerWeight));
      }

      continue;
    }

    /* p[x|y] is the miter point. pDist is the distance between miter point and p1. */
    const c1 = ((-perpX + x0) * (-perpY + y1)) - ((-perpX + x1) * (-perpY + y0));
    const c2 = ((-perp1x + x2) * (-perp1y + y1)) - ((-perp1x + x1) * (-perp1y + y2));
    const px = ((dx0 * c2) - (dx1 * c1)) / cross;
    const py = ((dy1 * c1) - (dy0 * c2)) / cross;
    const pDist = ((px - x1) * (px - x1)) + ((py - y1) * (py - y1));

    /* Inner miter point */
    const imx = x1 + ((px - x1) * innerWeight);
    const imy = y1 + ((py - y1) * innerWeight);
    /* Outer miter point */
    const omx = x1 - ((px - x1) * outerWeight);
    const omy = y1 - ((py - y1) * outerWeight);

    /* Is the inside miter point too far away, creating a spike? */
    const smallerInsideSegmentSq = Math.min((dx0 * dx0) + (dy0 * dy0), (dx1 * dx1) + (dy1 * dy1));
    const insideWeight = clockwise ? innerWeight : outerWeight;
    const smallerInsideDiagonalSq = smallerInsideSegmentSq + (insideWeight * insideWeight * widthSquared);
    const insideMiterOk = pDist <= smallerInsideDiagonalSq;

    if (insideMiterOk) {
      if (style.join === spec.LineJoin.Bevel || pDist / widthSquared > miterLimitSquared) {
        if (clockwise) /* rotating at inner angle */ {
          verts.push(imx, imy); // inner miter point
          verts.push(x1 + (perpX * outerWeight), y1 + (perpY * outerWeight)); // first segment's outer vertex
          verts.push(imx, imy); // inner miter point
          verts.push(x1 + (perp1x * outerWeight), y1 + (perp1y * outerWeight)); // second segment's outer vertex
        } else /* rotating at outer angle */ {
          verts.push(x1 - (perpX * innerWeight), y1 - (perpY * innerWeight)); // first segment's inner vertex
          verts.push(omx, omy); // outer miter point
          verts.push(x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight)); // second segment's outer vertex
          verts.push(omx, omy); // outer miter point
        }

        indexCount += 2;
      } else if (style.join === spec.LineJoin.Round) {
        if (clockwise) /* arc is outside */ {
          verts.push(imx, imy);
          verts.push(x1 + (perpX * outerWeight), y1 + (perpY * outerWeight));

          indexCount += round(
            x1, y1,
            x1 + (perpX * outerWeight), y1 + (perpY * outerWeight),
            x1 + (perp1x * outerWeight), y1 + (perp1y * outerWeight),
            verts, true
          ) + 4;

          verts.push(imx, imy);
          verts.push(x1 + (perp1x * outerWeight), y1 + (perp1y * outerWeight));
        } else /* arc is inside */ {
          verts.push(x1 - (perpX * innerWeight), y1 - (perpY * innerWeight));
          verts.push(omx, omy);

          indexCount += round(
            x1, y1,
            x1 - (perpX * innerWeight), y1 - (perpY * innerWeight),
            x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight),
            verts, false
          ) + 4;

          verts.push(x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight));
          verts.push(omx, omy);
        }
      } else {
        verts.push(imx, imy);
        verts.push(omx, omy);
      }
    } else {
      verts.push(x1 - (perpX * innerWeight), y1 - (perpY * innerWeight)); // first segment's inner vertex
      verts.push(x1 + (perpX * outerWeight), y1 + (perpY * outerWeight)); // first segment's outer vertex
      if (style.join === spec.LineJoin.Round) {
        if (clockwise) /* arc is outside */ {
          indexCount += round(
            x1, y1,
            x1 + (perpX * outerWeight), y1 + (perpY * outerWeight),
            x1 + (perp1x * outerWeight), y1 + (perp1y * outerWeight),
            verts, true
          ) + 2;
        } else /* arc is inside */ {
          indexCount += round(
            x1, y1,
            x1 - (perpX * innerWeight), y1 - (perpY * innerWeight),
            x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight),
            verts, false
          ) + 2;
        }
      } else if (style.join === spec.LineJoin.Miter && pDist / widthSquared <= miterLimitSquared) {
        if (clockwise) {
          verts.push(omx, omy); // inner miter point
          verts.push(omx, omy); // inner miter point
        } else {
          verts.push(imx, imy); // outer miter point
          verts.push(imx, imy); // outer miter point
        }
        indexCount += 2;
      }
      verts.push(x1 - (perp1x * innerWeight), y1 - (perp1y * innerWeight)); // second segment's inner vertex
      verts.push(x1 + (perp1x * outerWeight), y1 + (perp1y * outerWeight)); // second segment's outer vertex
      indexCount += 2;
    }
  }

  x0 = points[(length - 2) * 2];
  y0 = points[((length - 2) * 2) + 1];

  x1 = points[(length - 1) * 2];
  y1 = points[((length - 1) * 2) + 1];

  perpX = -(y0 - y1);
  perpY = x0 - x1;

  dist = Math.sqrt((perpX * perpX) + (perpY * perpY)) + NumberEpsilon;
  perpX /= dist;
  perpY /= dist;
  perpX *= width;
  perpY *= width;

  verts.push(x1 - (perpX * innerWeight), y1 - (perpY * innerWeight));
  verts.push(x1 + (perpX * outerWeight), y1 + (perpY * outerWeight));

  if (!closedShape) {
    if (style.cap === spec.LineCap.Round) {
      indexCount += round(
        x1 - (perpX * (innerWeight - outerWeight) * 0.5),
        y1 - (perpY * (innerWeight - outerWeight) * 0.5),
        x1 - (perpX * innerWeight),
        y1 - (perpY * innerWeight),
        x1 + (perpX * outerWeight),
        y1 + (perpY * outerWeight),
        verts,
        false
      ) + 2;
    } else if (style.cap === spec.LineCap.Square) {
      indexCount += square(x1, y1, perpX, perpY, innerWeight, outerWeight, false, verts);
    }
  }

  // const indices = graphicsGeometry.indices;
  const eps2 = curveEps * curveEps;

  // indices.push(indexStart);
  for (let i = indexStart; i < indexCount + indexStart - 2; ++i) {
    x0 = verts[(i * 2)];
    y0 = verts[(i * 2) + 1];

    x1 = verts[(i + 1) * 2];
    y1 = verts[((i + 1) * 2) + 1];

    x2 = verts[(i + 2) * 2];
    y2 = verts[((i + 2) * 2) + 1];

    /* Skip zero area triangles */
    if (Math.abs((x0 * (y1 - y2)) + (x1 * (y2 - y0)) + (x2 * (y0 - y1))) < eps2) {
      continue;
    }

    indices.push(i, i + 1, i + 2);
  }
}

/**
 * 创建Feather Stroke所需的mesh
 * @param points 
 * @param lineStyle 
 * @param flipAlignment 
 * @param closed 
 * @returns 
 */
export function buildLineContour(
  points: number[],
  lineStyle: StrokeAttributes,
  flipAlignment: boolean,
  closed: boolean,
): number[][] {
  const eps = closePointEps;

  if (points.length === 0) return [];

  const style = lineStyle;
  let alignment = style.alignment;

  if (lineStyle.alignment !== 0.5) {
    let orientation = getOrientationOfPoints(points);

    if (flipAlignment) { orientation *= -1; }
    alignment = ((alignment - 0.5) * orientation) + 0.5;
  }

  const firstPoint = new Point(points[0], points[1]);
  const lastPoint = new Point(points[points.length - 2], points[points.length - 1]);
  const closedShape = closed;
  const closedPath = Math.abs(firstPoint.x - lastPoint.x) < eps
    && Math.abs(firstPoint.y - lastPoint.y) < eps;

  if (closedShape) {
    points = points.slice();
    if (closedPath) {
      points.pop();
      points.pop();
      lastPoint.set(points[points.length - 2], points[points.length - 1]);
    }
    const midPointX = (firstPoint.x + lastPoint.x) * 0.5;
    const midPointY = (lastPoint.y + firstPoint.y) * 0.5;

    points.unshift(midPointX, midPointY);
    points.push(midPointX, midPointY);
  }

  const length = points.length / 2;
  const width = style.width / 2;
  const widthSquared = width * width;
  const miterLimitSquared = style.miterLimit * style.miterLimit;



  // ── 核心变化：用两个独立数组收集内外轮廓顶点 ──────────────
  // 原 buildLine 每次 verts.push(inner, outer)，
  // 这里拆分为分别 push 到 innerVerts / outerVerts
  const innerVerts: number[] = [];
  const outerVerts: number[] = [];

  // cap/join 产生的额外顶点（圆形cap、round join 的扇形）
  // 这些顶点属于外侧或内侧的"装饰"，单独收集后插入对应序列
  // 用一个辅助函数代替原来直接 push 到 verts

  // round cap/join 的扇形顶点收集器
  // clockwise=true 时扇形在 outer 侧，false 时在 inner 侧
  function pushRoundFan(
    cx: number, cy: number,
    sx: number, sy: number,
    ex: number, ey: number,
    clockwise: boolean,
  ): void {
    const cx2p0x = sx - cx;
    const cy2p0y = sy - cy;
    let angle0 = Math.atan2(cx2p0x, cy2p0y);
    let angle1 = Math.atan2(ex - cx, ey - cy);

    if (clockwise && angle0 < angle1) angle0 += Math.PI * 2;
    else if (!clockwise && angle0 > angle1) angle1 += Math.PI * 2;

    const angleDiff = angle1 - angle0;
    const radius = Math.sqrt(cx2p0x * cx2p0x + cy2p0y * cy2p0y);
    const segCount = ((15 * Math.abs(angleDiff) * Math.sqrt(radius) / Math.PI) >> 0) + 1;
    const angleInc = angleDiff / segCount;
    const target = clockwise ? outerVerts : innerVerts;

    // 起点已由调用方 push，这里只 push 中间点和终点
    for (let i = 1, angle = angle0 + angleInc; i <= segCount; i++, angle += angleInc) {
      target.push(
        cx + Math.sin(angle) * radius,
        cy + Math.cos(angle) * radius,
      );
    }
  }

  let x0 = points[0]; 
  let y0 = points[1];
  let x1 = points[2]; 
  let y1 = points[3];
  let x2 = 0;
  let y2 = 0;

  let perpX = -(y0 - y1);
  let perpY = x0 - x1;
  let perp1x = 0;
  let perp1y = 0;

  let dist = Math.sqrt(perpX * perpX + perpY * perpY) + NumberEpsilon;

  perpX = perpX / dist * width;
  perpY = perpY / dist * width;

  const ratio = alignment;
  const innerWeight = (1 - ratio) * 2;
  const outerWeight = ratio * 2;

  // ── 起始 cap ──────────────────────────────────────────────
  if (!closedShape) {
    if (style.cap === spec.LineCap.Round) {
      // 圆形 cap：从 outer 到 inner 的半圆，顶点都属于"端部轮廓"
      // 对于起始端，这段弧连接 outer 起点和 inner 起点
      // 暂存，等主体顶点确定后再处理；这里先收集到 capStart
      const capCx = x0 - perpX * (innerWeight - outerWeight) * 0.5;
      const capCy = y0 - perpY * (innerWeight - outerWeight) * 0.5;
      const capStartX = x0 - perpX * innerWeight;
      const capStartY = y0 - perpY * innerWeight;
      const capEndX = x0 + perpX * outerWeight;
      const capEndY = y0 + perpY * outerWeight;

      // 起始 round cap 的弧从 inner 侧扫到 outer 侧（逆时针看是反向）
      // 收集弧上的点，之后 unshift 到 innerVerts 前面作为连接段
      const capArc: number[] = [capStartX, capStartY];
      const cx2p0x = capStartX - capCx;
      const cy2p0y = capStartY - capCy;
      let angle0 = Math.atan2(cx2p0x, cy2p0y);
      let angle1 = Math.atan2(capEndX - capCx, capEndY - capCy);
      if (angle0 < angle1) angle0 += Math.PI * 2;
      const angleDiff = angle1 - angle0;
      const radius = Math.sqrt(cx2p0x * cx2p0x + cy2p0y * cy2p0y);
      const segCount = ((15 * Math.abs(angleDiff) * Math.sqrt(radius) / Math.PI) >> 0) + 1;
      const angleInc = angleDiff / segCount;

      for (let i = 1, angle = angle0 + angleInc; i <= segCount; i++, angle += angleInc) {
        capArc.push(
          capCx + Math.sin(angle) * radius,
          capCy + Math.cos(angle) * radius,
        );
      }
      // capArc 最后一点是 capEndX/Y，即 outer 起点
      // 将整段弧 unshift 到 innerVerts 头部（反向插入，使其成为从 outer→inner 的过渡）
      // 实际处理：先正向存，最后组装时再处理顺序
      // 简化处理：直接把 cap 弧作为 outerVerts 的前置（因为非封闭时内外共用端点）
      outerVerts.push(...capArc.reverse()); // outer 侧先到弧顶再到 outer 起点
    } else if (style.cap === spec.LineCap.Square) {
      // square cap 直接在 inner/outer 各加一个延伸点
      const exx = perpY / width * width; // 方向向量
      const eyy = -perpX / width * width;
      innerVerts.push(
        x0 - perpX * innerWeight + exx,
        y0 - perpY * innerWeight + eyy,
      );
      outerVerts.push(
        x0 + perpX * outerWeight + exx,
        y0 + perpY * outerWeight + eyy,
      );
    }
  }

  // ── 主体第一个点 ───────────────────────────────────────────
  innerVerts.push(
    x0 - perpX * innerWeight, 
    y0 - perpY * innerWeight);
  outerVerts.push(
    x0 + perpX * outerWeight, 
    y0 + perpY * outerWeight);

  // ── 中间顶点（与原 buildLine 逻辑完全对应） ────────────────
  for (let i = 1; i < length - 1; ++i) {
    x0 = points[(i - 1) * 2];     
    y0 = points[(i - 1) * 2 + 1];

    x1 = points[i * 2];           
    y1 = points[i * 2 + 1];

    x2 = points[(i + 1) * 2];     
    y2 = points[(i + 1) * 2 + 1];

    perpX = -(y0 - y1); 
    perpY = x0 - x1;

    dist = Math.sqrt(perpX * perpX + perpY * perpY) + NumberEpsilon;
    perpX = perpX / dist * width; 
    perpY = perpY / dist * width;

    dist = Math.sqrt(perp1x * perp1x + perp1y * perp1y) + NumberEpsilon;
    perp1x = -(y1 - y2); 
    perp1y = x1 - x2;
    perp1x = perp1x / dist * width; 
    perp1y = perp1y / dist * width;

    const dx0 = x1 - x0; 
    const dy0 = y0 - y1;
    const dx1 = x1 - x2;
    const dy1 = y2 - y1;
    const dot = dx0 * dx1 + dy0 * dy1;
    const cross = dy0 * dx1 - dy1 * dx0;
    const clockwise = cross < 0;

    if (Math.abs(cross) < 0.001 * Math.abs(dot)) {
      innerVerts.push(
        x1 - perpX * innerWeight, 
        y1 - perpY * innerWeight);
      outerVerts.push(
        x1 + perpX * outerWeight, 
        y1 + perpY * outerWeight);

      if (dot >= 0) {
        if (style.join === spec.LineJoin.Round) {
          if (clockwise) {
            outerVerts.push(
              x1 + perpX * outerWeight, 
              y1 + perpY * outerWeight);
            pushRoundFan(x1, y1,
              x1 + perpX * outerWeight, y1 + perpY * outerWeight,
              x1 + perp1x * outerWeight, y1 + perp1y * outerWeight,
              true);
          } else {
            innerVerts.push(
              x1 - perpX * innerWeight, 
              y1 - perpY * innerWeight);
            pushRoundFan(x1, y1,
              x1 - perpX * innerWeight, y1 - perpY * innerWeight,
              x1 - perp1x * innerWeight, y1 - perp1y * innerWeight,
              false);
          }
        }
        innerVerts.push(
          x1 - perp1x * outerWeight, 
          y1 - perp1y * outerWeight);
        outerVerts.push(
          x1 + perp1x * innerWeight, 
          y1 + perp1y * innerWeight);
      }
      continue;
    }

    const c1 = ((-perpX + x0) * (-perpY + y1)) - ((-perpX + x1) * (-perpY + y0));
    const c2 = ((-perp1x + x2) * (-perp1y + y1)) - ((-perp1x + x1) * (-perp1y + y2));
    const px = (dx0 * c2 - dx1 * c1) / cross;
    const py = (dy1 * c1 - dy0 * c2) / cross;
    const pDist = (px - x1) * (px - x1) + (py - y1) * (py - y1);

    const imx = x1 + (px - x1) * innerWeight;
    const imy = y1 + (py - y1) * innerWeight;
    const omx = x1 - (px - x1) * outerWeight;
    const omy = y1 - (py - y1) * outerWeight;

    const smallerInsideSegmentSq = Math.min(dx0 * dx0 + dy0 * dy0, dx1 * dx1 + dy1 * dy1);
    const insideWeight = clockwise ? innerWeight : outerWeight;
    const smallerInsideDiagonalSq = smallerInsideSegmentSq + insideWeight * insideWeight * widthSquared;
    const insideMiterOk = pDist <= smallerInsideDiagonalSq;

    if (insideMiterOk) {
      if (style.join === spec.LineJoin.Bevel || pDist / widthSquared > miterLimitSquared) {
        if (clockwise) {
          innerVerts.push(imx, imy);
          outerVerts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
          innerVerts.push(imx, imy);  // FixMe: 重复顶点在这里有必要吗？
          outerVerts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
        } else {
          innerVerts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
          outerVerts.push(omx, omy);  // FixMe: 重复顶点在这里有必要吗？
          innerVerts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
          outerVerts.push(omx, omy);
        }
      } else if (style.join === spec.LineJoin.Round) {
        if (clockwise) {
          innerVerts.push(imx, imy);
          outerVerts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);
          pushRoundFan(
            x1, y1,
            x1 + perpX * outerWeight, y1 + perpY * outerWeight,
            x1 + perp1x * outerWeight, y1 + perp1y * outerWeight,
            true);
          innerVerts.push(imx, imy);  // FixMe: 重复顶点在这里有必要吗？
          outerVerts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
        } else {
          innerVerts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
          outerVerts.push(omx, omy);
          pushRoundFan(
            x1, y1,
            x1 - perpX * innerWeight, y1 - perpY * innerWeight,
            x1 - perp1x * innerWeight, y1 - perp1y * innerWeight,
            false);
          innerVerts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
          outerVerts.push(omx, omy);  // FixMe: 重复顶点在这里有必要吗？
        }
      } else {
        // Miter
        innerVerts.push(imx, imy);
        outerVerts.push(omx, omy);
      }
    } else {
      innerVerts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
      outerVerts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);

      if (style.join === spec.LineJoin.Round) {
        if (clockwise) {
          pushRoundFan(x1, y1,
            x1 + perpX * outerWeight, y1 + perpY * outerWeight,
            x1 + perp1x * outerWeight, y1 + perp1y * outerWeight,
            true);
        } else {
          pushRoundFan(x1, y1,
            x1 - perpX * innerWeight, y1 - perpY * innerWeight,
            x1 - perp1x * innerWeight, y1 - perp1y * innerWeight,
            false);
        }
      } else if (style.join === spec.LineJoin.Miter && pDist / widthSquared <= miterLimitSquared) {
        if (clockwise) {
          outerVerts.push(omx, omy);
        } else {
          innerVerts.push(imx, imy);
        }
      }

      innerVerts.push(x1 - perp1x * innerWeight, y1 - perp1y * innerWeight);
      outerVerts.push(x1 + perp1x * outerWeight, y1 + perp1y * outerWeight);
    }
  }

  // ── 最后一个主体点 ─────────────────────────────────────────
  x0 = points[(length - 2) * 2];     
  y0 = points[(length - 2) * 2 + 1];
  x1 = points[(length - 1) * 2];    
  y1 = points[(length - 1) * 2 + 1];

  perpX = -(y0 - y1); 
  perpY = x0 - x1;
  dist = Math.sqrt(perpX * perpX + perpY * perpY) + NumberEpsilon;
  perpX = perpX / dist * width; 
  perpY = perpY / dist * width;

  innerVerts.push(x1 - perpX * innerWeight, y1 - perpY * innerWeight);
  outerVerts.push(x1 + perpX * outerWeight, y1 + perpY * outerWeight);

  // ── 末尾 cap ──────────────────────────────────────────────
  if (!closedShape) {
    if (style.cap === spec.LineCap.Square) {
      innerVerts.push(
        x1 - perpX * innerWeight - perpY / width * width,
        y1 - perpY * innerWeight + perpX / width * width,
      );
      outerVerts.push(
        x1 + perpX * outerWeight - perpY / width * width,
        y1 + perpY * outerWeight + perpX / width * width,
      );
    }
  }

  // ── 组装输出轮廓 ───────────────────────────────────────────
  if (closedShape) {
    // 封闭：外轮廓 + 内轮廓（内轮廓反向，形成孔）
    const innerReversed: number[] = [];
    for (let i = innerVerts.length - 2; i >= 0; i -= 2) {
      innerReversed.push(innerVerts[i], innerVerts[i + 1]);
    }
    return [outerVerts, innerReversed];
  } else {
    // 非封闭：outer 正向 + inner 反向 = 单一封闭轮廓
    const contour = [...outerVerts];
    for (let i = innerVerts.length - 2; i >= 0; i -= 2) {
      contour.push(innerVerts[i], innerVerts[i + 1]);
    }

    // round cap 末尾
    if (style.cap === spec.LineCap.Round) {
      const capCx = x1 - perpX * (innerWeight - outerWeight) * 0.5;
      const capCy = y1 - perpY * (innerWeight - outerWeight) * 0.5;
      const capStartX = x1 - perpX * innerWeight;
      const capStartY = y1 - perpY * innerWeight;
      const capEndX = x1 + perpX * outerWeight;
      const capEndY = y1 + perpY * outerWeight;

      const cx2p0x = capEndX - capCx;
      const cy2p0y = capEndY - capCy;
      let angle0 = Math.atan2(cx2p0x, cy2p0y);
      let angle1 = Math.atan2(capStartX - capCx, capStartY - capCy);
      if (angle0 < angle1) angle0 += Math.PI * 2;
      const angleDiff = angle1 - angle0;
      const radius = Math.sqrt(cx2p0x * cx2p0x + cy2p0y * cy2p0y);
      const segCount = ((15 * Math.abs(angleDiff) * Math.sqrt(radius) / Math.PI) >> 0) + 1;
      const angleInc = angleDiff / segCount;

      for (let i = 1, angle = angle0 + angleInc; i <= segCount; i++, angle += angleInc) {
        contour.push(
          capCx + Math.sin(angle) * radius,
          capCy + Math.cos(angle) * radius,
        );
      }
    }

    return [contour];
  }
}