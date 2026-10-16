import { union, unionContours } from './split-union';

export type FeatherBBox = {
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
};

export type FeatherMeshData = {
  triangles: number[],
  edges: number[],
  bbox: FeatherBBox,
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
 * @param meshData - Indicator 三角形、Scatter 边数据和包围盒的输出对象
 */
export function buildFeatherMeshData (
  pathVertices: number[],
  meshData: FeatherMeshData,
): void {
  if (pathVertices.length < 6) {
    return;
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

  for (const outerContour of outerContours) {
    buildFeatherMeshDataInternal(outerContour, meshData);
  }
}

/**
 * 内部函数：假设路径已闭合且为 CCW，直接构建网格数据
 */
function buildFeatherMeshDataInternal (
  pathVertices: number[],
  meshData: FeatherMeshData,
): void {
  const { triangles, edges, bbox } = meshData;
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

  // 每条轮廓边对应一个 Indicator 扇形三角形和一个 Scatter 实例。
  for (let i = 0; i < numPathPts - 1; i++) {
    const x1 = pathVertices[i * 2];
    const y1 = pathVertices[i * 2 + 1];
    const x2 = pathVertices[(i + 1) * 2];
    const y2 = pathVertices[(i + 1) * 2 + 1];

    triangles.push(cx, cy, x1, y1, x2, y2);
    edges.push(x1, y1, x2, y2);
  }
  expandFeatherBBox(bbox, minX, minY, maxX, maxY);
}

export function buildContoursFeatherMeshData (
  contours: number[][],
  meshData: FeatherMeshData,
): void {
  // 这里保证了路径闭合和CCW
  const parsedContours = unionContours(contours, true);

  for (const contour of parsedContours) {
    buildFeatherMeshDataInternal(contour, meshData);
  }
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
