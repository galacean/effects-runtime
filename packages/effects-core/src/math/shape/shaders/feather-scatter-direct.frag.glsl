precision highp float;

varying vec4 vEdge;

uniform vec2 uViewportOffset;  // 当前图形在 atlas 中的 viewport 起点（整数像素）
uniform vec2 uPixelOrigin;     // 像素中心换算到计算空间：P = uPixelOrigin + (pixel + 0.5) * uSpacePerPixel
uniform vec2 uSpacePerPixel;
uniform vec2 uMetric;          // 每个计算空间单位对应的局部空间长度 (x, y)
uniform float uRadius;         // 局部空间羽化半径
uniform float uIntegScale;     // 1.0: 直接输出 float；> 1.0: 输出 round(v * S)

const float PI = 3.14159265359;
const float PI_2 = 1.5707963268;
const float PI_4 = 0.7853981633;

// 像素与边的相对几何关系。b、y 在局部空间，b > 0 表示像素在边的左侧（CCW 轮廓的内侧）。
struct EdgeLocal {
  float b;
  float y1;
  float y2;
  bool onLine;    // 叉积 == 0
  bool atVertex1; // 像素中心与 p1 重合
  bool atVertex2;
  float side;     // 左右侧，永不为 0；叉积为 0 时按 SoS 扰动 p' = p + (eps, eps^2) 取符号
  vec2 e;         // 计算空间下的边向量
};

EdgeLocal computeEdgeLocal () {
  EdgeLocal edge;
  vec2 pixel = floor(gl_FragCoord.xy) - uViewportOffset;
  vec2 p = uPixelOrigin + (pixel + 0.5) * uSpacePerPixel;
  vec2 p1 = vEdge.xy;
  vec2 p2 = vEdge.zw;
  vec2 e = p2 - p1;
  vec2 d1 = p1 - p;
  vec2 d2 = p2 - p;
  float crossF = e.x * (p.y - p1.y) - e.y * (p.x - p1.x);
  vec2 eLocal = e * uMetric;
  float eLength = length(eLocal);
  vec2 eDir = eLocal / eLength;

  edge.e = e;
  if (crossF != 0.0) {
    edge.side = crossF > 0.0 ? 1.0 : -1.0;
  } else if (e.y != 0.0) {
    edge.side = e.y > 0.0 ? -1.0 : 1.0;
  } else {
    edge.side = e.x > 0.0 ? 1.0 : -1.0;
  }
  edge.onLine = crossF == 0.0;
  edge.atVertex1 = d1 == vec2(0.0);
  edge.atVertex2 = d2 == vec2(0.0);
  edge.b = crossF * uMetric.x * uMetric.y / eLength;
  edge.y1 = dot(d1 * uMetric, eDir);
  edge.y2 = dot(d2 * uMetric, eDir);

  return edge;
}

// atan(y / b)。b == 0 或像素与顶点重合时，按 SoS 扰动取极限：
// 顶点处 y / b -> (e.x * metric.x) / (e.y * metric.y)；若 e.y == 0 则 -> -inf。
float arcAngle (float y, EdgeLocal edge, bool atVertex) {
  if (atVertex) {
    if (edge.e.y != 0.0) {
      return atan(edge.e.x * uMetric.x / (edge.e.y * uMetric.y));
    }

    return -PI_2;
  }
  if (edge.onLine) {
    return edge.side * sign(y) * PI_2;
  }

  return atan(y / edge.b);
}

float feather (EdgeLocal edge) {
  float r2 = uRadius * uRadius;
  float b = edge.b;

  if (abs(b) >= uRadius) {
    return 0.0;
  }
  float span = sqrt(r2 - b * b);
  float y1 = clamp(edge.y1, -span, span);
  float y2 = clamp(edge.y2, -span, span);

  float b2 = b * b;
  float b4 = b2 * b2;
  float b6 = b4 * b2;
  float r4 = r2 * r2;
  float r6 = r4 * r2;
  float y1_2 = y1 * y1;
  float y2_2 = y2 * y2;
  float c1 = b * (0.5 - 0.75 * b2 / r2 + 0.5 * b4 / r4 - 0.125 * b6 / r6);
  float c2 = b * (-0.25 / r2 + 1.0 / 3.0 * b2 / r4 - 0.125 * b4 / r6);
  float c3 = b * (0.1 / r4 - 0.075 * b2 / r6);
  float c4 = b * (-1.0 / 56.0 / r6);
  float integ1 = (((c4 * y1_2 + c3) * y1_2 + c2) * y1_2 + c1) * y1;
  float integ2 = (((c4 * y2_2 + c3) * y2_2 + c2) * y2_2 + c1) * y2;
  float integArc = 0.5 * (arcAngle(y2, edge, edge.atVertex2) - arcAngle(y1, edge, edge.atVertex1)) / PI;

  return (integ2 - integ1) / (r2 * PI_4) - integArc;
}

void main() {
  float integration = feather(computeEdgeLocal()) * uIntegScale;

  if (uIntegScale > 1.0) {
    integration = floor(integration + 0.5);
  }
  gl_FragColor = vec4(0.0, integration, 0.0, 0.0);
}
