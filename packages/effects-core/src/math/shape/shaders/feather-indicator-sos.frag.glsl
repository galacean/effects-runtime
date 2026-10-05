precision highp float;

varying vec2 vP0;
varying vec2 vP1;
varying vec2 vP2;

uniform vec2 uViewportOffset;
uniform vec2 uPixelOrigin;
uniform vec2 uSpacePerPixel;

// 与 feather-scatter.frag.glsl 的 computeEdgeLocal 逐式相同，不要改写。
float edgeSide (vec2 p1, vec2 p2, vec2 p) {
  vec2 e = p2 - p1;
  float crossF = e.x * (p.y - p1.y) - e.y * (p.x - p1.x);

  if (crossF != 0.0) {
    return crossF > 0.0 ? 1.0 : -1.0;
  } else if (e.y != 0.0) {
    return e.y > 0.0 ? -1.0 : 1.0;
  } else {
    return e.x > 0.0 ? 1.0 : -1.0;
  }
}

void main() {
  vec2 pixel = floor(gl_FragCoord.xy) - uViewportOffset;
  vec2 p = uPixelOrigin + (pixel + 0.5) * uSpacePerPixel;
  vec2 e01 = vP1 - vP0;
  float orientCross = e01.x * (vP2.y - vP0.y) - e01.y * (vP2.x - vP0.x);

  if (orientCross == 0.0) {
    discard;
  }
  float orient = orientCross > 0.0 ? 1.0 : -1.0;

  if (edgeSide(vP0, vP1, p) != orient ||
    edgeSide(vP1, vP2, p) != orient ||
    edgeSide(vP2, vP0, p) != orient) {
    discard;
  }

  gl_FragColor = vec4(orient, 0.0, 0.0, 0.0);
}
