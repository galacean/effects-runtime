import { Float16ArrayWrapper } from '../float16array-wrapper';
const MAX_SCATTER_EDGES = 512; // 低于 shader 中 MAX_LOAD_EDGES_PER_MESH 的一个安全余量
const GAP_EPSILON = 1e-4;

interface Point {
  x: number,
  y: number,
}

function fromHalf (h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7C00) >> 10;
  const m = h & 0x03FF;

  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (m / 1024);
  } else if (e === 0x1F) {
    return m ? NaN : (s ? -Infinity : Infinity);
  }

  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + m / 1024);
}


export function removeShortEdgesFloat (floatData: number[]): Float32Array{
  const halfData: Uint16Array = new Float16ArrayWrapper(floatData).data;
  const n = halfData.length / 4;
  const out: number[] = [];

  for (let i = 0; i < n; i++) {
    const x1 = fromHalf(halfData[i * 4]);
    const y1 = fromHalf(halfData[i * 4 + 1]);
    const x2 = fromHalf(halfData[i * 4 + 2]);
    const y2 = fromHalf(halfData[i * 4 + 3]);

    if (x1 !== x2 || y1 !== y2) {
      out.push(x1, y1, x2, y2);
    }
  }

  return new Float32Array(out);
} 

/**
 * 移除 fp16 量化后长度为零的边，避免 shader 中因精度问题导致计算发散。
 * @param halfData - 以 fp16（Uint16Array）编码的边数据，每 4 个元素构成一条边 (rgba = x1, y1, x2, y2)
 * @returns 过滤后的 Uint16Array
 */
export function removeShortEdges (halfData: Uint16Array): Uint16Array {
  const n = halfData.length / 4;
  const out: number[] = [];

  for (let i = 0; i < n; i++) {
    const x1 = fromHalf(halfData[i * 4]);
    const y1 = fromHalf(halfData[i * 4 + 1]);
    const x2 = fromHalf(halfData[i * 4 + 2]);
    const y2 = fromHalf(halfData[i * 4 + 3]);

    if (x1 !== x2 || y1 !== y2) {
      out.push(halfData[i * 4], halfData[i * 4 + 1], halfData[i * 4 + 2], halfData[i * 4 + 3]);
    }
  }

  return new Uint16Array(out);
}

/**
 * 简化 scatter 边数组，使其边数低于 shader 循环上限。
 * 假设所有轮廓都是显式闭合的（最后一条边的尾顶点等于第一条边的首顶点）。
 * 优先融并偏差小、转角小、边长短的顶点。
 */
export function simplifyScatterEdges (scatterEdgeVertices: number[]): number[] {
  const numEdges = scatterEdgeVertices.length / 4;

  if (numEdges <= MAX_SCATTER_EDGES) {
    return scatterEdgeVertices;
  }

  // 解析边
  const edges: { x1: number, y1: number, x2: number, y2: number }[] = [];

  for (let i = 0; i < scatterEdgeVertices.length; i += 4) {
    edges.push({
      x1: scatterEdgeVertices[i],
      y1: scatterEdgeVertices[i + 1],
      x2: scatterEdgeVertices[i + 2],
      y2: scatterEdgeVertices[i + 3],
    });
  }

  // 按首尾相连关系分组为闭合轮廓
  // 我们的输入轮廓确保是 显式闭合 且 无自相交 的。
  const contours: number[][] = [];
  let currentContour: number[] = [];

  for (let i = 0; i < edges.length; i++) {
    if (currentContour.length === 0) {
      currentContour.push(i);
    } else {
      const firstEdge = edges[currentContour[0]];
      const currEdge = edges[i];
      const gap = Math.hypot(currEdge.x2 - firstEdge.x1, currEdge.y2 - firstEdge.y1);

      if (gap < GAP_EPSILON) {   // 遇到首顶点了，即结束轮廓。（如果有自相交就不能这么做）
        currentContour.push(i);  // 插入最后一个边
        contours.push(currentContour);  // 结算当前contour
        currentContour = [];     // 新的contour的起始
      } else {
        currentContour.push(i);
      }
    }
  }
  if (currentContour.length > 0) {
    contours.push(currentContour);
  }
  
  // 将每个轮廓解析为闭合点序列（去除末尾重复的首顶点）
  const contourPoints: Point[][] = [];
  let totalOriginalEdges = 0;

  for (const edgeIndices of contours) {
    const pts: Point[] = [];

    for (let i = 0; i < edgeIndices.length; i++) {
      const e = edges[edgeIndices[i]];
      pts.push({ x: e.x1, y: e.y1 });   // 在显式闭合的条件下，只放首顶点就行。
    }

    contourPoints.push(pts);
    totalOriginalEdges += pts.length;
  }

  const result: number[] = [];
  let totalSimplifiedEdges = 0;

  for (let c = 0; c < contourPoints.length; c++) {
    const pts = contourPoints[c];
    const originalEdges = pts.length;

    if (originalEdges <= 0) {
      continue;
    }

    // 按原始边数比例分配预算，同时保证剩余轮廓有最小边数（三角形）
    const minTarget = 3;
    let target = Math.max(minTarget, Math.floor(originalEdges * MAX_SCATTER_EDGES / totalOriginalEdges));

    const remainingBudget = MAX_SCATTER_EDGES - totalSimplifiedEdges;
    const remainingContours = contourPoints.length - c;

    target = Math.max(minTarget, Math.min(target, remainingBudget - (remainingContours - 1) * minTarget));

    const simplified = simplifyClosedContour(pts, target);

    totalSimplifiedEdges += simplified.length / 4;
    if (totalSimplifiedEdges > MAX_SCATTER_EDGES){ // 如果是非常极端的情况（比如内部有数百个三角形孔），我们无法简化，只能抛弃一部分孔。
      break;
    }

    for (let i = 0; i < simplified.length; i++) {
      result.push(simplified[i]);
    }
  }

  return result;
}

function simplifyClosedContour (points: Point[], targetEdges: number): number[] {
  const n = points.length;

  if (n <= targetEdges || n < 3) {
    const result: number[] = [];

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      result.push(points[i].x, points[i].y, points[j].x, points[j].y);
    }

    return result;
  }

  const prev = new Int32Array(n);
  const next = new Int32Array(n);
  const removed = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    prev[i] = (i - 1 + n) % n;
    next[i] = (i + 1) % n;
  }

  let currentEdges = n;

  targetEdges = Math.max(3, targetEdges);

  while (currentEdges > targetEdges) {
    let bestIdx = -1;
    let bestCost = Infinity;

    for (let i = 0; i < n; i++) {
      if (removed[i]) {
        continue;
      }

      const p0 = points[prev[i]];
      const p1 = points[i];
      const p2 = points[next[i]];

      const dx1 = p1.x - p0.x;
      const dy1 = p1.y - p0.y;
      const dx2 = p2.x - p1.x;
      const dy2 = p2.y - p1.y;
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);

      const dx = p2.x - p0.x;
      const dy = p2.y - p0.y;
      const baseLen = Math.hypot(dx, dy);

      let deviation = 0;

      if (baseLen < 1e-8) {
        deviation = len1 + len2;
      } else {
        const cross = Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx);
        deviation = cross / baseLen;
      }

      const dot = dx1 * dx2 + dy1 * dy2;
      const cross2 = dx1 * dy2 - dy1 * dx2;
      const angle = Math.atan2(Math.abs(cross2), dot);

      // 融并代价：偏差大、角度大、边长总和大的顶点代价高
      const cost = deviation + angle * (len1 + len2) * 0.5;

      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }

    if (bestIdx < 0 || bestCost === Infinity) {
      break;
    }

    removed[bestIdx] = 1;
    const p = prev[bestIdx];
    const q = next[bestIdx];

    next[p] = q;
    prev[q] = p;
    currentEdges--;
  }

  // 重建闭合边数组
  const result: number[] = [];
  let start = 0;

  while (start < n && removed[start]) {
    start++;
  }
  if (start >= n) {
    return result;
  }

  let curr = start;

  do {
    const nxt = next[curr];
    result.push(points[curr].x, points[curr].y, points[nxt].x, points[nxt].y);
    curr = nxt;
  } while (curr !== start && curr >= 0 && curr < n);
  
  return result;
}
