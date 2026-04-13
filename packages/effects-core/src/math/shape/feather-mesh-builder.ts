import { split, union, unionContours, splitContours } from "./split-union";

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

  // 确保 CCW 方向 Union函数自带显式闭合
  const outerContours: number[][] = union(ensureCCW(closedVertices), true);
  
  let edgeCount = 0;
  let contourVertOffset = vertOffset;

  for (let c = 0; c < outerContours.length; c++){
    const outerContour: number[] = outerContours[c];
      edgeCount += buildFeatherMeshDataInternal(
      outerContour,
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

export function buildContoursFeatherMeshData (
  contours: number[][],
  outputVertices: number[],
  vertOffset: number,
  indices: number[],
  scatterEdgeVertices: number[],
  bbox: FeatherBBox,
): number{
  let edgeCount = 0;
  let contourVertOffset = vertOffset;

  // 这里保证了路径闭合和CCW
  const parsedContours = unionContours(contours, true);

  for (const contour of parsedContours) {
    edgeCount += buildFeatherMeshDataInternal(
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
