precision highp float;

varying vec2 vP0;
varying vec2 vP1;
varying vec2 vP2;

uniform vec2 uViewportOffset;
uniform vec2 uPixelOrigin;
uniform vec2 uSpacePerPixel;

// 与 feather-scatter.frag.glsl 的 computeEdgeLocal 逐式相同，不要改写。
float edgeSide (vec2 p1, vec2 p2, vec2 p) {
  bool flip = (p2.x < p1.x) || (p2.x == p1.x && p2.y < p1.y);
  vec2 a = flip ? p2 : p1;
  vec2 b = flip ? p1 : p2;
  vec2 e = b - a;
  float crossF = e.x * (p.y - a.y) - e.y * (p.x - a.x);
  float side;
  if (crossF != 0.0) {
    side = crossF > 0.0 ? 1.0 : -1.0;
  } else if (e.y != 0.0) {
    side = e.y > 0.0 ? -1.0 : 1.0;
  } else {
    side = e.x > 0.0 ? 1.0 : -1.0;
  }
  return flip ? -side : side;
}

void main() {
  vec2 pixel = floor(gl_FragCoord.xy) - uViewportOffset;
  vec2 p = uPixelOrigin + (pixel + 0.5) * uSpacePerPixel;
  vec2 e01 = vP1 - vP0;
  float orientCross = e01.x * (vP2.y - vP0.y) - e01.y * (vP2.x - vP0.x);

  if (orientCross == 0.0) {
    gl_FragColor = vec4(0.0);  // 这里不能用discard，某些手机不支持。
    return;
  }
  float orient = orientCross > 0.0 ? 1.0 : -1.0;

  if (edgeSide(vP0, vP1, p) != orient ||
    edgeSide(vP1, vP2, p) != orient ||
    edgeSide(vP2, vP0, p) != orient) {
    gl_FragColor = vec4(0.0);
    return;
  }

  gl_FragColor = vec4(orient, 0.0, 0.0, 0.0);
}
