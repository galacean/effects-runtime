precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 vTexCoord;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;

void main() {
  vTexCoord = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
