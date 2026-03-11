precision highp float;

attribute vec2 aTemplate;
attribute vec2 aStart;
attribute vec2 aEnd;

varying float vHalfLength;
varying vec2 vLocal;

uniform float uRadius;
uniform mat4 uProjection;

void main() {
  vec2 midPoint = (aStart + aEnd) / 2.0;
  vec2 frontOffset = midPoint - aStart;
  vec2 frontDir = normalize(frontOffset);
  vec2 outDir = vec2(-frontDir.y, frontDir.x);

  gl_Position = uProjection * vec4(
    midPoint + frontOffset * aTemplate.x + frontDir * uRadius * aTemplate.x + outDir * uRadius * aTemplate.y,
    0.0, 1.0
  );

  vHalfLength = 0.5 * length(aStart - aEnd);
  vLocal = vec2((length(frontOffset) + uRadius) * aTemplate.x, uRadius * aTemplate.y);
}
