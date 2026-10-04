precision highp float;

attribute vec2 aTemplate;
attribute vec2 aStart;
attribute vec2 aEnd;

uniform mat4 uProjection;
uniform float uCoverRadius;  // 局部空间：羽化半径 + 1px，只用于保证覆盖
uniform vec2 uEdgeOrigin;    // 端点换算到计算空间：q = (p - uEdgeOrigin) * uEdgeScale
uniform vec2 uEdgeScale;

varying vec4 vEdge;  // 计算空间下的端点 (p1, p2)，同一实例的各顶点取值相同

void main() {
  vec2 midPoint = (aStart + aEnd) / 2.0;
  vec2 frontOffset = midPoint - aStart;
  vec2 frontDir = normalize(frontOffset);
  vec2 outDir = vec2(-frontDir.y, frontDir.x);

  gl_Position = uProjection * vec4(
    midPoint + frontOffset * aTemplate.x + frontDir * uCoverRadius * aTemplate.x + outDir * uCoverRadius * aTemplate.y,
    0.0, 1.0
  );

  vEdge = vec4((aStart - uEdgeOrigin) * uEdgeScale, (aEnd - uEdgeOrigin) * uEdgeScale);
}
