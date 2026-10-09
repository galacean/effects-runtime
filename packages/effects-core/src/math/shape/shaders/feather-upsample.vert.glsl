precision highp float;

attribute vec2 aUV;

varying vec2 vTexCoord;

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;
uniform vec2 uExpandedMin;   // upsample 四边形在局部空间的最小点
uniform vec2 uExpandedSize;  // upsample 四边形的宽高

void main() {
  vTexCoord = aUV;
  vec2 localPos = uExpandedMin + aUV * uExpandedSize;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(localPos, 0.0, 1.0);
}
