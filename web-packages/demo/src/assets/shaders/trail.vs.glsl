precision highp float;
attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 uv;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixInvV;
uniform mat4 effects_MatrixVP;
uniform vec4 uEditorTransform;

void main() {
  uv = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos*2.0,1.0);
}