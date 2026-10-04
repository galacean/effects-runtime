#version 300 es
precision highp float;
precision highp int;

in vec2 aTemplate;
in vec2 aStartQ;  // 整数网格坐标（以 float 上传，数值为精确整数）
in vec2 aEndQ;

uniform vec2 uCenterQ;
uniform vec2 uFboSize;
uniform int uRasterTriangle;  // 0: 包围盒 + 片元 SoS 测试；1: 直接光栅化三角形 (c, p1, p2)

flat out ivec4 vEdge;

const float GRID_SUB = 16.0;

void main () {
  vec2 px;

  if (uRasterTriangle != 0) {
    // triangle strip 的 4 个顶点依次为 c, p1, p2, p2：第一个三角形即 (c, p1, p2)，第二个退化。
    vec2 q = aTemplate.y < 0.0 ? (aTemplate.x < 0.0 ? uCenterQ : aStartQ) : aEndQ;

    px = q / GRID_SUB;
  } else {
    // 扇形三角形 (c, p1, p2) 的包围盒外扩 1px，只负责覆盖；是否在内部由片元着色器精确判定。
    vec2 minQ = min(uCenterQ, min(aStartQ, aEndQ));
    vec2 maxQ = max(uCenterQ, max(aStartQ, aEndQ));
    vec2 minPx = minQ / GRID_SUB - 1.0;
    vec2 maxPx = maxQ / GRID_SUB + 1.0;

    px = mix(minPx, maxPx, aTemplate * 0.5 + 0.5);
  }

  gl_Position = vec4(px / uFboSize * 2.0 - 1.0, 0.0, 1.0);
  vEdge = ivec4(aStartQ, aEndQ);
}
