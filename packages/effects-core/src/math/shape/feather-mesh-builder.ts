/**
 * 羽化网格构建数据
 */
export interface FeatherMeshData {
  /** Indicator pass 使用的扇形网格顶点 (vec3, z=0) */
  indicatorVertices: Float32Array,
  /** Indicator pass 索引 */
  indicatorIndices: Uint16Array,

  /**
   * Scatter pass 边顶点数据 (vec2 per vertex)。
   * 连续顶点对 (v[i], v[i+1]) 构成 edge[i]。
   * 用于实例化渲染: aStart 从 offset 0 读取, aEnd 从 offset 8 读取, instanceDivisor=1。
   */
  scatterEdgeVertices: Float32Array,
  /** Scatter pass 边数量 (实例数量) */
  scatterEdgeCount: number,

  /** 包围盒 [minX, minY, width, height] */
  bbox: [number, number, number, number],
}

const emptyFeatherMeshData: FeatherMeshData = {
  indicatorVertices: new Float32Array(0),
  indicatorIndices: new Uint16Array(0),
  scatterEdgeVertices: new Float32Array(0),
  scatterEdgeCount: 0,
  bbox: [0, 0, 0, 0],
};

/**
 * 合并多个 FeatherMeshData 为一个
 */
export function mergeFeatherMeshData (meshDataList: FeatherMeshData[]): FeatherMeshData {
  if (meshDataList.length === 0) {
    return emptyFeatherMeshData;
  }

  if (meshDataList.length === 1) {
    return meshDataList[0];
  }

  // 计算总顶点数、索引数、边数
  let totalIndicatorVerts = 0;
  let totalIndicatorIndices = 0;
  let totalScatterEdges = 0;
  let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
  let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE;

  for (const data of meshDataList) {
    totalIndicatorVerts += data.indicatorVertices.length / 3;
    totalIndicatorIndices += data.indicatorIndices.length;
    totalScatterEdges += data.scatterEdgeCount;
    if (data.bbox[2] > 0 && data.bbox[3] > 0) {
      minX = Math.min(minX, data.bbox[0]);
      minY = Math.min(minY, data.bbox[1]);
      maxX = Math.max(maxX, data.bbox[0] + data.bbox[2]);
      maxY = Math.max(maxY, data.bbox[1] + data.bbox[3]);
    }
  }

  const indicatorVertices = new Float32Array(totalIndicatorVerts * 3);
  const indicatorIndices = new Uint16Array(totalIndicatorIndices);
  const scatterEdgeVertices = new Float32Array(totalScatterEdges * 2 * 2); // 每条边2个顶点

  let vertOffset = 0;
  let indexOffset = 0;
  let scatterOffset = 0;
  let indexVertexOffset = 0;

  for (const data of meshDataList) {
    // 复制 indicator 顶点 (vec3)
    indicatorVertices.set(data.indicatorVertices, vertOffset * 3);
    vertOffset += data.indicatorVertices.length / 3;

    // 复制并偏移索引
    for (let i = 0; i < data.indicatorIndices.length; i++) {
      indicatorIndices[indexOffset + i] = data.indicatorIndices[i] + indexVertexOffset;
    }
    indexOffset += data.indicatorIndices.length;
    indexVertexOffset += data.indicatorVertices.length / 3;

    // 复制 scatter 边数据
    scatterEdgeVertices.set(data.scatterEdgeVertices, scatterOffset * 4);
    scatterOffset += data.scatterEdgeCount;
  }

  return {
    indicatorVertices,
    indicatorIndices,
    scatterEdgeVertices,
    scatterEdgeCount: totalScatterEdges,
    bbox: minX < Number.MAX_VALUE ? [minX, minY, maxX - minX, maxY - minY] : [0, 0, 0, 0],
  };
}

/**
 * 从形状路径的 2D 顶点数组构建羽化网格
 * 自动处理路径闭合和CCW方向
 * @param pathVertices - 形状路径的 2D 坐标数组 [x0, y0, x1, y1, ...]
 */
export function buildFeatherMeshData (pathVertices: number[]): FeatherMeshData {
  if (pathVertices.length < 6) {
    return emptyFeatherMeshData;
  }

  // 确保路径闭合（首尾相同）
  const firstX = pathVertices[0];
  const firstY = pathVertices[1];
  const lastX = pathVertices[pathVertices.length - 2];
  const lastY = pathVertices[pathVertices.length - 1];

  let vertices = pathVertices;

  if (firstX !== lastX || firstY !== lastY) {
    vertices = [...pathVertices, firstX, firstY];
  }

  // 确保 CCW 方向
  vertices = ensureCCW(vertices);

  return buildFeatherMeshDataInternal(vertices);
}

/**
 * 内部函数：假设路径已闭合且为 CCW，直接构建网格数据
 */
function buildFeatherMeshDataInternal (vertices: number[]): FeatherMeshData {
  const numPathPts = vertices.length / 2;

  // 计算几何中心和包围盒
  let cx = 0, cy = 0;
  let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
  let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE;

  for (let i = 0; i < numPathPts; i++) {
    const x = vertices[i * 2];
    const y = vertices[i * 2 + 1];

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
  // 顶点: [center, v0, v1, ..., v(n-1)]，vec3 格式 (z=0)
  const indicatorVertCount = 1 + numPathPts;
  const indicatorVertices = new Float32Array(indicatorVertCount * 3);

  // center
  indicatorVertices[0] = cx;
  indicatorVertices[1] = cy;
  indicatorVertices[2] = 0;
  // 路径顶点
  for (let i = 0; i < numPathPts; i++) {
    const dstIdx = (i + 1) * 3;

    indicatorVertices[dstIdx] = vertices[i * 2];
    indicatorVertices[dstIdx + 1] = vertices[i * 2 + 1];
    indicatorVertices[dstIdx + 2] = 0;
  }

  // 索引: 三角扇 [center, vi, vi+1]
  const numTriangles = numPathPts - 1;
  const indicatorIndices = new Uint16Array(numTriangles * 3);

  for (let i = 0; i < numTriangles; i++) {
    indicatorIndices[i * 3] = 0;       // center
    indicatorIndices[i * 3 + 1] = i + 1;
    indicatorIndices[i * 3 + 2] = i + 2;
  }

  // --- Scatter 边顶点数据 (用于实例化渲染) ---
  // 路径已闭合，edge[i] = v[i] → v[i+1]
  // 直接使用路径顶点数组: aStart 从 offset 0 读取, aEnd 从 offset 8 读取
  const numEdges = numPathPts - 1;
  const scatterEdgeVertices = new Float32Array(vertices);

  return {
    indicatorVertices,
    indicatorIndices,
    scatterEdgeVertices,
    scatterEdgeCount: numEdges,
    bbox: [minX, minY, maxX - minX, maxY - minY],
  };
}

/**
 * 从 stroke 路径构建羽化网格数据。
 * 将路径沿法线方向偏移 ±strokeWidth/2 得到外圈和内圈，
 * 拼合成一个闭合轮廓多边形后复用 buildFeatherMeshData 的 fan+scatter 方案。
 * 对于闭合路径，使用 bridge 边连接外圈和内圈形成环形多边形，
 * winding number 会自动抵消内部区域。
 * @param pathVertices - 形状路径的 2D 坐标数组 [x0, y0, x1, y1, ...]
 * @param strokeWidth - 描边宽度
 * @param closed - 路径是否闭合
 */
export function buildStrokeFeatherMeshData (
  pathVertices: number[],
  strokeWidth: number,
  closed: boolean,
): FeatherMeshData {
  let pts = pathVertices;
  let n = pts.length / 2;

  if (n < 2) {
    return emptyFeatherMeshData;
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

  // 拼合为单一闭合轮廓多边形 (首点 = 尾点)
  const outline: number[] = [];

  if (closed) {
    // 环形轮廓: 外圈 CCW → bridge → 内圈 CW(反向) → bridge 回到起点
    for (let i = 0; i < n; i++) {
      outline.push(outer[i * 2], outer[i * 2 + 1]);
    }
    outline.push(outer[0], outer[1]); // 闭合外圈
    outline.push(inner[0], inner[1]); // bridge: outer[0] → inner[0]
    for (let i = n - 1; i >= 1; i--) {
      outline.push(inner[i * 2], inner[i * 2 + 1]);
    }
    outline.push(inner[0], inner[1]); // 闭合内圈
    outline.push(outer[0], outer[1]); // bridge 回到起点 (首尾相同)
  } else {
    // 开放路径: outer 正向 → inner 反向 → 首尾相连
    for (let i = 0; i < n; i++) {
      outline.push(outer[i * 2], outer[i * 2 + 1]);
    }
    for (let i = n - 1; i >= 0; i--) {
      outline.push(inner[i * 2], inner[i * 2 + 1]);
    }
    outline.push(outer[0], outer[1]); // 闭合路径
  }

  // outline 已闭合且绕序正确，直接使用 unchecked 版本避免重复处理
  return buildFeatherMeshDataInternal(outline);
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
