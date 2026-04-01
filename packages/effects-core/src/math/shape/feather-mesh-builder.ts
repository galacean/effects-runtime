import { unionMax } from "./split-union";

export type FeatherBBox = {
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
};

function expandFeatherBBox (
  bbox: FeatherBBox,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  bbox.minX = Math.min(bbox.minX, minX);
  bbox.minY = Math.min(bbox.minY, minY);
  bbox.maxX = Math.max(bbox.maxX, maxX);
  bbox.maxY = Math.max(bbox.maxY, maxY);
}

/**
 * 从形状路径的 2D 顶点数组构建羽化网格
 * 自动处理路径闭合和CCW方向
 * @param pathVertices - 形状路径的 2D 坐标数组 [x0, y0, x1, y1, ...]
 * @param vertices - Indicator pass 使用的顶点输出数组 (vec2)
 * @param vertOffset - Indicator 顶点起始偏移（以顶点数计）
 * @param indices - Indicator pass 索引输出数组
 * @param scatterEdgeVertices - Scatter pass 边数据输出数组
 * @param bbox - 羽化包围盒输出对象
 */
export function buildFeatherMeshData (
  pathVertices: number[],
  outputVertices: number[],
  vertOffset: number,
  indices: number[],
  scatterEdgeVertices: number[],
  bbox: FeatherBBox,
): number {
  if (pathVertices.length < 6) {
    return 0;
  }

  // 确保路径闭合（首尾相同）
  const firstX = pathVertices[0];
  const firstY = pathVertices[1];
  const lastX = pathVertices[pathVertices.length - 2];
  const lastY = pathVertices[pathVertices.length - 1];

  let closedVertices = pathVertices;

  if (firstX !== lastX || firstY !== lastY) {
    closedVertices = [...pathVertices, firstX, firstY];
  }

  // 确保 CCW 方向
  closedVertices = ensureCCW(closedVertices);

  return buildFeatherMeshDataInternal(
    closedVertices,
    outputVertices,
    vertOffset,
    indices,
    scatterEdgeVertices,
    bbox,
  );
}

/**
 * 内部函数：假设路径已闭合且为 CCW，直接构建网格数据
 */
function buildFeatherMeshDataInternal (
  pathVertices: number[],
  outputVertices: number[],
  vertOffset: number,
  indices: number[],
  scatterEdgeVertices: number[],
  bbox: FeatherBBox,
): number {
  const numPathPts = pathVertices.length / 2;

  // 计算几何中心和包围盒
  let cx = 0, cy = 0;
  let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
  let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE;

  for (let i = 0; i < numPathPts; i++) {
    const x = pathVertices[i * 2];
    const y = pathVertices[i * 2 + 1];

    cx += x;
    cy += y;
    if (x < minX) { minX = x; }
    if (y < minY) { minY = y; }
    if (x > maxX) { maxX = x; }
    if (y > maxY) { maxY = y; }
  }
  cx /= numPathPts;
  cy /= numPathPts;

  // --- Indicator 扇形网格 ---
  // 顶点: [center, v0, v1, ..., v(n-1)]，vec2 格式
  outputVertices.push(cx, cy);
  for (let i = 0; i < numPathPts; i++) {
    outputVertices.push(pathVertices[i * 2], pathVertices[i * 2 + 1]);
  }

  // 索引: 三角扇 [center, vi, vi+1]
  const numTriangles = numPathPts - 1;

  for (let i = 0; i < numTriangles; i++) {
    indices.push(
      vertOffset,
      vertOffset + i + 1,
      vertOffset + i + 2,
    );
  }

  // --- Scatter 边顶点数据 (用于实例化渲染) ---
  // 显式写入每条边的起点和终点，避免多 contour 串接时产生伪边
  const numEdges = numPathPts - 1;

  for (let i = 0; i < numEdges; i++) {
    scatterEdgeVertices.push(
      pathVertices[i * 2],
      pathVertices[i * 2 + 1],
      pathVertices[(i + 1) * 2],
      pathVertices[(i + 1) * 2 + 1],
    );
  }
  expandFeatherBBox(bbox, minX, minY, maxX, maxY);

  return numEdges;
}

function appendContourFeatherMeshData (
  pathVertices: number[],
  outputVertices: number[],
  vertOffset: number,
  indices: number[],
  scatterEdgeVertices: number[],
  bbox: FeatherBBox,
): number {
  if (pathVertices.length < 6) {
    return 0;
  }

  const firstX = pathVertices[0];
  const firstY = pathVertices[1];
  const lastX = pathVertices[pathVertices.length - 2];
  const lastY = pathVertices[pathVertices.length - 1];
  const closedVertices = firstX === lastX && firstY === lastY
    ? pathVertices
    : [...pathVertices, firstX, firstY];

  return buildFeatherMeshDataInternal(
    closedVertices,
    outputVertices,
    vertOffset,
    indices,
    scatterEdgeVertices,
    bbox,
  );
}

/**
 * 从 stroke 路径构建羽化网格数据。
 * 将路径沿法线方向偏移 ±strokeWidth/2 得到外圈和内圈，
 * 对于闭合路径，外圈和内圈分别作为独立 contour 提交，
 * 依靠 indicator pass 的前后面符号相加抵消内部区域，避免 seam 处 bridge 三角形重叠。
 * @param pathVertices - 形状路径的 2D 坐标数组 [x0, y0, x1, y1, ...]
 * @param strokeWidth - 描边宽度
 * @param closed - 路径是否闭合
 */
export function buildStrokeFeatherMeshData (
  pathVertices: number[],
  outputVertices: number[],
  vertOffset: number,
  indices: number[],
  scatterEdgeVertices: number[],
  bbox: FeatherBBox,
  strokeWidth: number,
  closed: boolean,
): number {
  let pts = pathVertices;
  let n = pts.length / 2;

  if (n < 2) {
    return 0;
  }

  // 对闭合路径确保 CCW 方向，使法线一致指向外侧
  if (closed) {
    pts = ensureCCW(pts);
    // 去除末尾与首点重复的点
    if (n >= 2 &&
      Math.abs(pts[0] - pts[(n - 1) * 2]) < 1e-6 &&
      Math.abs(pts[1] - pts[(n - 1) * 2 + 1]) < 1e-6) {
      n -= 1;
    }
  }

  const halfW = strokeWidth / 2;
  const outer: number[] = [];
  const inner: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    let nx = 0, ny = 0;

    // 前一条边的外法线 (dy, -dx) / len
    if (i > 0 || closed) {
      const pi = ((i - 1) + n) % n;
      const dx = x - pts[pi * 2];
      const dy = y - pts[pi * 2 + 1];
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 1e-8) {
        nx += dy / len;
        ny += -dx / len;
      }
    }

    // 后一条边的外法线
    if (i < n - 1 || closed) {
      const ni = (i + 1) % n;
      const dx = pts[ni * 2] - x;
      const dy = pts[ni * 2 + 1] - y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 1e-8) {
        nx += dy / len;
        ny += -dx / len;
      }
    }

    const nLen = Math.sqrt(nx * nx + ny * ny);

    if (nLen > 1e-8) {
      nx /= nLen;
      ny /= nLen;
    }

    outer.push(x + nx * halfW, y + ny * halfW);
    inner.push(x - nx * halfW, y - ny * halfW);
  }

  const contours: number[][] = [];

  if (closed) {
    const outerContour = ensureCCW(unionMax([...outer, outer[0], outer[1]]));
    const innerContour = ensureCCW(unionMax([...inner, inner[0], inner[1]]));

    const innerReversed: number[] = [];
    for (let i = innerContour.length / 2 - 1; i >= 0; i--) {
      innerReversed.push(innerContour[i * 2], innerContour[i * 2 + 1]);
    } //debugger;
    if(innerReversed[0] != innerReversed[innerReversed.length - 2] || innerReversed[1] != innerReversed[innerReversed.length - 1] ){
      innerReversed.push(innerReversed[0], innerReversed[1]);
    } 
    if (outerContour[0] != outerContour[outerContour.length - 2] || outerContour[1] != outerContour[outerContour.length - 1]){
      outerContour.push(outerContour[0], outerContour[1]);
    }
    
    contours.push(outerContour, innerReversed);
  } else {
    // 拼合为单一闭合轮廓多边形 (首点 = 尾点)
    const outline: number[] = [];

    // 开放路径: outer 正向 → inner 反向 → 首尾相连
    for (let i = 0; i < n; i++) {
      outline.push(outer[i * 2], outer[i * 2 + 1]);
    }
    for (let i = n - 1; i >= 0; i--) {
      outline.push(inner[i * 2], inner[i * 2 + 1]);
    }
    outline.push(outer[0], outer[1]);
    contours.push(outline);
  }

  let edgeCount = 0;
  let contourVertOffset = vertOffset;

  for (const contour of contours) {
    edgeCount += appendContourFeatherMeshData(
      contour,
      outputVertices,
      contourVertOffset,
      indices,
      scatterEdgeVertices,
      bbox,
    );
    contourVertOffset = outputVertices.length / 2;
  }

  return edgeCount;
}

/**
 * 确保路径顶点是逆时针方向（CCW）
 * @param pathVertices - 形状路径的 2D 坐标数组
 * @returns 逆时针方向的路径顶点
 */
export function ensureCCW (pathVertices: number[]): number[] {
  const n = pathVertices.length / 2;
  let area = 0;

  for (let i = 0; i < n; i++) {
    const x1 = pathVertices[i * 2];
    const y1 = pathVertices[i * 2 + 1];
    const nextIdx = ((i + 1) % n);
    const x2 = pathVertices[nextIdx * 2];
    const y2 = pathVertices[nextIdx * 2 + 1];

    area += x1 * y2 - x2 * y1;
  }

  // 有向面积为正则为 CCW
  if (area >= 0) {
    return pathVertices;
  }

  // 翻转顶点顺序
  const flipped: number[] = [];

  for (let i = n - 1; i >= 0; i--) {
    flipped.push(pathVertices[i * 2], pathVertices[i * 2 + 1]);
  }

  return flipped;
}
