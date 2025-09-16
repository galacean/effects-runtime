precision highp float;

attribute vec3 aPos;//x y
attribute vec2 aUV;//x y

varying vec2 uv0;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;

void main() {
  vec4 pos = vec4(aPos.xyz, 1.0);
  uv0 = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * pos;
}