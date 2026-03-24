precision highp float;

attribute vec2 aPos;
varying vec2 uv;
uniform vec4 _ScreenRect; // (x, y, w, h) in NDC space

void main() {
  // aPos is in [0, 1] range, map to _ScreenRect in NDC
  vec2 ndcPos = _ScreenRect.xy + aPos * _ScreenRect.zw;
  gl_Position = vec4(ndcPos, 0.0, 1.0);
  uv = aPos;
}
