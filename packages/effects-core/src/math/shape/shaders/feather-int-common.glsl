// 整数羽化管线共用片段，由 TS 替换 `#pragma feather_int_common` 注入。
// 坐标单位：FBO 像素 / FEATHER_GRID_SUB，原点为当前图形 viewport 左下角。
#define FEATHER_GRID_SUB 16

uniform vec2 uViewportOffset;  // 当前图形在 atlas 中的 viewport 起点（整数像素）

ivec2 featherPixelCenterQ () {
  ivec2 pixel = ivec2(floor(gl_FragCoord.xy)) - ivec2(uViewportOffset);
  return pixel * FEATHER_GRID_SUB + FEATHER_GRID_SUB / 2;
}

// 所有点都在 [0, 2^15] 的网格内，三角形面积不超过网格面积的一半，因此结果不会溢出 int32。
int featherCross (ivec2 u, ivec2 v) {
  return u.x * v.y - u.y * v.x;
}

// p 位于有向边 a->b 的左侧返回 1，右侧返回 -1。要求 a != b。
// 叉积为 0 时按 SoS 扰动 p' = p + (eps, eps^2) 取符号：
// cross(e, p' - a) = cross0 - e.y * eps + e.x * eps^2，因此结果永不为 0，且对边方向反对称。
int featherSideSoS (ivec2 a, ivec2 b, ivec2 p) {
  ivec2 e = b - a;
  int c = featherCross(e, p - a);

  if (c != 0) {
    return c > 0 ? 1 : -1;
  }
  if (e.y != 0) {
    return e.y > 0 ? -1 : 1;
  }

  return e.x > 0 ? 1 : -1;
}
