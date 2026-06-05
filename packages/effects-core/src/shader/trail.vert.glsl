precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;
attribute vec4 aColor;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vLife;
varying float vSeed;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;

void main () {
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
  vTexCoord = aUV;
  vColor = aColor;
  vLife = 0.0;
  vSeed = 0.0;
}
