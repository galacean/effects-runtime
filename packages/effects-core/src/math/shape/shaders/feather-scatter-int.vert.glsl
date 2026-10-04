#version 300 es
precision highp float;
precision highp int;

in vec2 aTemplate;
in vec2 aStartQ;  // 整数网格坐标（以 float 上传，数值为精确整数）
in vec2 aEndQ;

uniform vec2 uFboSize;
uniform float uRadiusPx;  // 像素空间下卷积核的最大半径 + 1px，只用于保证覆盖

flat out ivec4 vEdge;

const float GRID_SUB = 16.0;

void main () {
  vec2 p1 = aStartQ / GRID_SUB;
  vec2 p2 = aEndQ / GRID_SUB;
  vec2 midPoint = 0.5 * (p1 + p2);
  vec2 halfSegment = 0.5 * (p2 - p1);
  vec2 frontDir = normalize(halfSegment);
  vec2 outDir = vec2(-frontDir.y, frontDir.x);
  vec2 px = midPoint
    + (halfSegment + frontDir * uRadiusPx) * aTemplate.x
    + outDir * uRadiusPx * aTemplate.y;

  gl_Position = vec4(px / uFboSize * 2.0 - 1.0, 0.0, 1.0);
  vEdge = ivec4(aStartQ, aEndQ);
}
