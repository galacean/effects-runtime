import * as libtess from 'libtess';

const tessySplit = (function initSplitTesselator() {
  function vertexCallback(
    data: [number, number, number],
    output: number[][],
  ) {
    const current = output[output.length - 1];
    current[current.length] = data[0];
    current[current.length] = data[1];
  }

  function beginCallback(type: number, output: number[][]) {
    // BOUNDARY_ONLY 模式下固定输出 GL_LINE_LOOP，每次 begin 对应一个新轮廓
    output[output.length] = [];
  }

  function errorCallback(errno: number) {
    console.error('split error callback, error number: ' + errno);
  }

  function combineCallback(
    coords: [number, number, number],
    _data: number[][],
    _weight: number[],
  ) {
    return [coords[0], coords[1], coords[2]];
  }

  const tessy = new libtess.GluTesselator();

  // ← 关键：切换到轮廓输出模式，不做三角化
  tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_BOUNDARY_ONLY,
    true,
  );
  tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    libtess.windingRule.GLU_TESS_WINDING_ODD,
  );
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN_DATA, beginCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combineCallback);

  return tessy;
})();

const tessyUnion = (function initUnionTesselator() {
  function vertexCallback(
    data: [number, number, number],
    output: number[][],
  ) {
    const current = output[output.length - 1];
    current[current.length] = data[0];
    current[current.length] = data[1];
  }

  function beginCallback(type: number, output: number[][]) {
    output[output.length] = [];
  }

  function errorCallback(errno: number) {
    console.error('union error callback, error number: ' + errno);
  }

  function combineCallback(
    coords: [number, number, number],
    _data: number[][],
    _weight: number[],
  ) {
    return [coords[0], coords[1], coords[2]];
  }

  const tessy = new libtess.GluTesselator();

  tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_BOUNDARY_ONLY,
    true,
  );
  // NONZERO：只要被缠绕过，就算内部 → 所有子区域合并为一个整体
  tessy.gluTessProperty(
    libtess.gluEnum.GLU_TESS_WINDING_RULE,
    libtess.windingRule.GLU_TESS_WINDING_NONZERO,
  );
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN_DATA, beginCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorCallback);
  tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combineCallback);

  return tessy;
})();

function resolveContour(
  contour: number[],
  winding: 'ODD' | 'NONZERO' = 'NONZERO',
): number[][] {
  const tessy = winding === 'ODD' ? tessySplit : tessyUnion;

  tessy.gluTessNormal(0, 0, 1);
  const output: number[][] = [];

  tessy.gluTessBeginPolygon(output);
  tessy.gluTessBeginContour();

  const firstX = contour[0];
  const firstY = contour[1];
  const lastX = contour[contour.length - 2];
  const lastY = contour[contour.length - 1];
  const needsClose = firstX !== lastX || firstY !== lastY;

  for (let i = 0; i < contour.length; i += 2) {
    const coords = [contour[i], contour[i + 1], 0];
    tessy.gluTessVertex(coords, coords);
  }

  if (needsClose) {
      const closeCoords = [firstX, firstY, 0];
      tessy.gluTessVertex(closeCoords, closeCoords);
  }

  tessy.gluTessEndContour();
  tessy.gluTessEndPolygon();

  return output.filter(c => c.length >= 6);
}

/**
 * 处理多个轮廓的相交与合并。
 *
 * @param contours - 输入轮廓数组，每个轮廓是扁平化的 [x0, y0, x1, y1, ...] 坐标数组。
 *                   轮廓方向决定卷绕数贡献：逆时针（CCW）为正，顺时针（CW）为负。
 *                   轮廓可以是闭合的（首尾顶点相同）或非闭合的，函数会自动处理。
 * @returns 输出轮廓数组，表示卷绕数非零区域的边界（即所有输入轮廓的并集）。
 *          使用 NONZERO 缠绕规则：卷绕数 ≥ 1 的区域被视为内部，输出为单一轮廓。
 *
 * @example
 * // 两个相交的矩形（都是逆时针，正方向）
 * const rect1 = [0, 0, 10, 0, 10, 10, 0, 10];  // CCW
 * const rect2 = [5, 5, 15, 5, 15, 15, 5, 15];  // CCW
 * const result = unionContours([rect1, rect2]);
 * // result 将是合并后的外轮廓
 *
 * @example
 * // 一个矩形减去内部孔洞（外轮廓 CCW + 内轮廓 CW）
 * const outer = [0, 0, 10, 0, 10, 10, 0, 10];           // CCW, +1
 * const hole = [2, 2, 2, 8, 8, 8, 8, 2];                // CW, -1
 * const result = unionContours([outer, hole]);
 * // result 将是带孔洞的形状轮廓
 */
function resolveContours(
  contours: number[][],
  winding: 'ODD' | 'NONZERO' = 'NONZERO',
): number[][] {
  const tessy = winding === 'ODD' ? tessySplit : tessyUnion;

  tessy.gluTessNormal(0, 0, 1);
  const output: number[][] = [];

  tessy.gluTessBeginPolygon(output);

  for (const contour of contours) {
    if (contour.length < 6) {
      continue; // 至少需要3个点（6个坐标）
    }

    tessy.gluTessBeginContour();

    // 自动闭合：如果首尾顶点不同，额外添加首顶点作为尾顶点
    const firstX = contour[0];
    const firstY = contour[1];
    const lastX = contour[contour.length - 2];
    const lastY = contour[contour.length - 1];
    const needsClose = firstX !== lastX || firstY !== lastY;

    for (let i = 0; i < contour.length; i += 2) {
      const coords = [contour[i], contour[i + 1], 0];
      tessy.gluTessVertex(coords, coords);
    }

    // 如果轮廓未闭合，添加首顶点作为尾顶点
    if (needsClose) {
      const closeCoords = [firstX, firstY, 0];
      tessy.gluTessVertex(closeCoords, closeCoords);
    }

    tessy.gluTessEndContour();
  }

  tessy.gluTessEndPolygon();

  return output.filter(c => c.length >= 6);
}

/**
 * 确保轮廓显式闭合（如果未闭合，则添加首顶点作为尾顶点）。
 * libtess 的 BOUNDARY_ONLY 模式输出 GL_LINE_LOOP，但不会自动重复首顶点。
 */
function ensureExplicitlyClosed(contours: number[][]): number[][] {
  return contours.map(contour => {
    if (contour.length < 6) {
      return contour;
    }
    const firstX = contour[0];
    const firstY = contour[1];
    const lastX = contour[contour.length - 2];
    const lastY = contour[contour.length - 1];

    if (firstX === lastX && firstY === lastY) {
      return contour; // 已经闭合
    }
    return [...contour, firstX, firstY];
  });
}

// 拆分：自交区域分开
export function split(
  contour: number[],
  closeOutput: boolean = true
): number[][]{
  const result = resolveContour(contour, 'ODD');
  return closeOutput ? ensureExplicitlyClosed(result) : result;
}

// 并集：自交区域合并为整体外轮廓
// 如果有分离的部分，会输出多个
export function union(
  contour: number[],
  closeOutput: boolean = true
): number[][]{
  const result = resolveContour(contour, 'NONZERO');
  return closeOutput ? ensureExplicitlyClosed(result) : result;
}

/**
 * 多轮廓并集：计算多个轮廓的合并结果。
 *
 * @param contours - 输入轮廓数组，每个轮廓是扁平化的 [x0, y0, x1, y1, ...] 坐标数组。
 *                   轮廓方向决定卷绕数贡献：逆时针（CCW）为正，顺时针（CW）为负。
 * @param closeOutput - 是否确保输出轮廓显式闭合（首尾顶点相同）。默认为 true。
 * @returns 输出轮廓数组，表示卷绕数非零区域的边界。
 *          - 输入卷绕数为 0 的区域 → 不会出现在输出中
 *          - 输入卷绕数 ≥ 1 的区域 → 输出卷绕数为 1
 */
export function unionContours(
  contours: number[][],
  closeOutput: boolean = true,
): number[][] {
  const result = resolveContours(contours, 'NONZERO');
  return closeOutput ? ensureExplicitlyClosed(result) : result;
}

/**
 * 多轮廓拆分：计算多个轮廓的奇偶分割结果。
 *
 * @param contours - 输入轮廓数组，每个轮廓是扁平化的 [x0, y0, x1, y1, ...] 坐标数组。
 * @param closeOutput - 是否确保输出轮廓显式闭合（首尾顶点相同）。默认为 true。
 * @returns 输出轮廓数组，使用 ODD 缠绕规则。
 *          - 输入卷绕数为奇数的区域 → 输出卷绕数为 1
 *          - 输入卷绕数为偶数的区域 → 不会出现在输出中
 */
export function splitContours(
  contours: number[][],
  closeOutput: boolean = true,
): number[][] {
  const result = resolveContours(contours, 'ODD');
  return closeOutput ? ensureExplicitlyClosed(result) : result;
}
