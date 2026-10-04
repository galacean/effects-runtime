#version 300 es
precision highp float;
precision highp int;

#pragma feather_int_common

#ifdef FEATHER_FLAT_EDGE
flat in vec4 vEdge;
#else
in vec4 vEdge;
#endif

uniform vec2 uCenterQ;
uniform int uRasterTriangle;

out vec4 fragColor;

void main () {
  if (uRasterTriangle != 0) {
    fragColor = vec4(gl_FrontFacing ? 1.0 : -1.0, 0.0, 0.0, 0.0);

    return;
  }
  // SoS 模式要求 quantize + integerCross，端点为整数；非 flat 插值的微小误差由四舍五入消除。
  ivec4 edgeQ = ivec4(floor(vEdge + 0.5));
  ivec2 p = featherPixelCenterQ();
  ivec2 c = ivec2(uCenterQ);
  ivec2 p1 = edgeQ.xy;
  ivec2 p2 = edgeQ.zw;
  int orientCross = featherCross(p1 - c, p2 - c);

  if (orientCross == 0) {
    discard;
  }
  int orient = orientCross > 0 ? 1 : -1;

  if (featherSideSoS(c, p1, p) != orient ||
    featherSideSoS(p1, p2, p) != orient ||
    featherSideSoS(p2, c, p) != orient) {
    discard;
  }

  fragColor = vec4(float(orient), 0.0, 0.0, 0.0);
}
