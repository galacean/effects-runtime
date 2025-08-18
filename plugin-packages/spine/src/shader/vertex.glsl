attribute vec2 aPosition;
attribute vec4 aColor;
attribute vec4 aColor2;
attribute vec2 aTexCoords;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;
uniform vec2 _Size;

varying vec4 vLight;
varying vec4 vDark;
varying vec2 vTexCoords;

void main() {
  vLight = aColor;
  vDark = aColor2;
  vTexCoords = aTexCoords;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPosition * _Size, 0.0, 1.0);
}
