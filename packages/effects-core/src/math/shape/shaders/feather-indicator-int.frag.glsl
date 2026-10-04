#version 300 es
precision highp float;
precision highp int;

#pragma feather_int_common

flat in ivec4 vEdge;

uniform vec2 uCenterQ;

out vec4 fragColor;

void main () {
  ivec2 p = featherPixelCenterQ();
  ivec2 c = ivec2(uCenterQ);
  ivec2 p1 = vEdge.xy;
  ivec2 p2 = vEdge.zw;
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
