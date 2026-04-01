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

  for (let i = 0; i < contour.length; i += 2) {
    const coords = [contour[i], contour[i + 1], 0];
    tessy.gluTessVertex(coords, coords);
  }

  tessy.gluTessEndContour();
  tessy.gluTessEndPolygon();

  return output.filter(c => c.length >= 6);
}

// 拆分：自交区域分开
export const split = (c: number[]) => resolveContour(c, 'ODD');

// 并集：自交区域合并为整体外轮廓
// 如果有分离的部分，会输出多个
export const union = (c: number[]) => resolveContour(c, 'NONZERO');

// 最大几何区域：自交拆分后最大的一块
export function splitMax(contour: number[]): number[]
{
    const output: number[][] = resolveContour(contour, 'ODD');

    return output.reduce((best, cur) =>
        Math.abs(signedArea(cur)) > Math.abs(signedArea(best)) ? cur : best
    );
}

// 最大并集：并集后最大的一块
export function unionMax(contour: number[]): number[] 
{
    const output: number[][] = resolveContour(contour, 'NONZERO');

    return output.reduce((best, cur) =>
        Math.abs(signedArea(cur)) > Math.abs(signedArea(best)) ? cur : best
    );
}

function signedArea(contour: number[]): number {
  let area = 0;
  for (let i = 0; i < contour.length; i += 2) {
    const x1 = contour[i],     y1 = contour[i + 1];
    const x2 = contour[(i + 2) % contour.length];
    const y2 = contour[(i + 3) % contour.length];
    area += (x1 * y2 - x2 * y1);
  }
  return area / 2;
}