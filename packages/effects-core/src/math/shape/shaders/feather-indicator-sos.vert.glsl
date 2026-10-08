precision highp float;

attribute vec2 aTemplate;
attribute vec2 aP0;
attribute vec2 aP1;
attribute vec2 aP2;

uniform mat4 uProjection;
uniform vec2 uSpacePerPixel;

varying vec2 vP0;
varying vec2 vP1;
varying vec2 vP2;

void main() {
  vec2 mn = min(aP0, min(aP1, aP2));
  vec2 mx = max(aP0, max(aP1, aP2));

  mn -= uSpacePerPixel;
  mx += uSpacePerPixel;

  vec2 pos = mix(mn, mx, aTemplate * 0.5 + 0.5);

  gl_Position = uProjection * vec4(pos, 0.0, 1.0);
  vP0 = aP0;
  vP1 = aP1;
  vP2 = aP2;
}
