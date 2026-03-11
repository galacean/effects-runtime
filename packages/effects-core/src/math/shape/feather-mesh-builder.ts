/**
 * 羽化网格构建数据
 */
export interface FeatherMeshData {
  /** Indicator pass 使用的扇形网格顶点 (vec2) */
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

/**
 * 从形状路径的 2D 顶点数组构建羽化网格
 * @param pathVertices - 形状路径的 2D 坐标数组 [x0, y0, x1, y1, ...]，路径应已闭合（最后一个点等于第一个点）
 */
export function buildFeatherMeshData (pathVertices: number[]): FeatherMeshData {
  const numPathPts = pathVertices.length / 2;

  if (numPathPts < 3) {
    return {
      indicatorVertices: new Float32Array(0),
      indicatorIndices: new Uint16Array(0),
      scatterEdgeVertices: new Float32Array(0),
      scatterEdgeCount: 0,
      bbox: [0, 0, 0, 0],
    };
  }

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
  // 顶点: [center, v0, v1, ..., v(n-1)]
  const indicatorVertCount = 1 + numPathPts;
  const indicatorVertices = new Float32Array(indicatorVertCount * 2);

  indicatorVertices[0] = cx;
  indicatorVertices[1] = cy;
  for (let i = 0; i < numPathPts; i++) {
    indicatorVertices[(i + 1) * 2] = pathVertices[i * 2];
    indicatorVertices[(i + 1) * 2 + 1] = pathVertices[i * 2 + 1];
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
  const scatterEdgeVertices = new Float32Array(pathVertices);

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
    return {
      indicatorVertices: new Float32Array(0),
      indicatorIndices: new Uint16Array(0),
      scatterEdgeVertices: new Float32Array(0),
      scatterEdgeCount: 0,
      bbox: [0, 0, 0, 0],
    };
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

  return buildFeatherMeshData(outline);
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
