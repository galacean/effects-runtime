#version 300 es
precision highp float;
precision highp int;

#pragma feather_int_common

#ifdef FEATHER_FLAT_EDGE
flat in vec4 vEdge;
#else
in vec4 vEdge;
#endif

uniform vec2 uInvScale;     // 每个网格单位对应的局部空间长度 (x, y)
uniform float uRadius;      // 局部空间羽化半径
uniform float uIntegScale;  // 1.0: 直接输出 float；> 1.0: 输出 round(v * S)
uniform int uFixedPoint;    // 0: float 积分；1: Q15 定点积分

out vec4 fragColor;

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
  int side;       // SoS 判定的左右侧，永不为 0
  vec2 e;         // 网格坐标下的边向量
};

#ifdef FEATHER_INTEGER_CROSS
// 整数叉积：要求 quantize，端点为整数；非 flat 插值的微小误差由四舍五入消除。
EdgeLocal computeEdgeLocal () {
  EdgeLocal edge;
  ivec4 edgeQ = ivec4(floor(vEdge + 0.5));
  ivec2 p = featherPixelCenterQ();
  ivec2 p1 = edgeQ.xy;
  ivec2 p2 = edgeQ.zw;
  ivec2 e = p2 - p1;
  ivec2 d1 = p1 - p;
  ivec2 d2 = p2 - p;
  int crossI = featherCross(e, p - p1);
  vec2 eLocal = vec2(e) * uInvScale;
  float eLength = length(eLocal);
  vec2 eDir = eLocal / eLength;

  edge.e = vec2(e);
  edge.side = featherSideSoS(p1, p2, p);
  edge.onLine = crossI == 0;
  edge.atVertex1 = d1 == ivec2(0);
  edge.atVertex2 = d2 == ivec2(0);
  edge.b = float(crossI) * uInvScale.x * uInvScale.y / eLength;
  edge.y1 = dot(vec2(d1) * uInvScale, eDir);
  edge.y2 = dot(vec2(d2) * uInvScale, eDir);

  return edge;
}
#else
// float 叉积：端点直接使用 varying 的 float 值，平局规则与整数版本相同。
EdgeLocal computeEdgeLocal () {
  EdgeLocal edge;
  vec2 p = vec2(featherPixelCenterQ());
  vec2 p1 = vEdge.xy;
  vec2 p2 = vEdge.zw;
  vec2 e = p2 - p1;
  vec2 d1 = p1 - p;
  vec2 d2 = p2 - p;
  float crossF = e.x * (p.y - p1.y) - e.y * (p.x - p1.x);
  vec2 eLocal = e * uInvScale;
  float eLength = length(eLocal);
  vec2 eDir = eLocal / eLength;

  edge.e = e;
  if (crossF != 0.0) {
    edge.side = crossF > 0.0 ? 1 : -1;
  } else if (e.y != 0.0) {
    edge.side = e.y > 0.0 ? -1 : 1;
  } else {
    edge.side = e.x > 0.0 ? 1 : -1;
  }
  edge.onLine = crossF == 0.0;
  edge.atVertex1 = d1 == vec2(0.0);
  edge.atVertex2 = d2 == vec2(0.0);
  edge.b = crossF * uInvScale.x * uInvScale.y / eLength;
  edge.y1 = dot(d1 * uInvScale, eDir);
  edge.y2 = dot(d2 * uInvScale, eDir);

  return edge;
}
#endif

// ---------------- float 积分（geometry 档） ----------------

// atan(y / b)。b == 0 或像素与顶点重合时，按 SoS 扰动取极限：
// 顶点处 y / b -> (e.x * invScale.x) / (e.y * invScale.y)；若 e.y == 0 则 -> -inf。
float arcAngleFloat (float y, EdgeLocal edge, bool atVertex) {
  if (atVertex) {
    if (edge.e.y != 0.0) {
      return atan(edge.e.x * uInvScale.x / (edge.e.y * uInvScale.y));
    }

    return -PI_2;
  }
  if (edge.onLine) {
    return float(edge.side) * sign(y) * PI_2;
  }

  return atan(y / edge.b);
}

float featherFloat (EdgeLocal edge) {
  float r2 = uRadius * uRadius;
  float b = edge.b;

  if (abs(b) >= uRadius) {
    return 0.0;
  }
  float span = sqrt(r2 - b * b);
  float y1 = clamp(edge.y1, -span, span);
  float y2 = clamp(edge.y2, -span, span);
  bool vertex1 = edge.atVertex1;
  bool vertex2 = edge.atVertex2;

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
  float integArc = 0.5 * (arcAngleFloat(y2, edge, vertex2) - arcAngleFloat(y1, edge, vertex1)) / PI;

  return (integ2 - integ1) / (r2 * PI_4) - integArc;
}

// ---------------- Q15 定点积分（fixed 档） ----------------

const int Q15_ONE = 32768;
const int Q15_HALF_PI = 51472;            // pi / 2
const int Q15_FOUR_OVER_PI = 41722;       // 4 / pi
const int Q15_HALF_OVER_PI = 5215;        // 0.5 / pi
const int Q15_ONE_THIRD = 10923;
const int Q15_ONE_OVER_56 = 585;
const int Q15_0_075 = 2458;
const int Q15_0_1 = 3277;
const int CORDIC_ITERATIONS = 16;
const int CORDIC_ATAN_TABLE[16] = int[16](
  25736, 15193, 8027, 4075, 2045, 1024, 512, 256,
  128, 64, 32, 16, 8, 4, 2, 1
);

int mulQ15 (int a, int b) {
  return (a * b + 16384) >> 15;
}

int toQ15 (float v) {
  return int(floor(clamp(v, -2.0, 2.0) * float(Q15_ONE) + 0.5));
}

// sqrt(v)，v 为 Q30，结果为 Q15。逐位法，只用整数加减和移位。
int isqrtQ30 (int v) {
  int result = 0;
  int bit = 1 << 30;

  for (int i = 0; i < 16; ++i) {
    if (v >= result + bit) {
      v -= result + bit;
      result = (result >> 1) + bit;
    } else {
      result >>= 1;
    }
    bit >>= 2;
  }

  return result;
}

// atan2(y, x)，要求 x >= 0 且 (x, y) 不同时为 0，输入 Q15，输出 Q15 弧度。
int cordicAtan2Q15 (int x, int y) {
  int cx = x << 8;
  int cy = y << 8;
  int angle = 0;

  for (int i = 0; i < CORDIC_ITERATIONS; ++i) {
    int dx = cx >> i;
    int dy = cy >> i;

    if (cy > 0) {
      cx += dy;
      cy -= dx;
      angle += CORDIC_ATAN_TABLE[i];
    } else {
      cx -= dy;
      cy += dx;
      angle -= CORDIC_ATAN_TABLE[i];
    }
  }

  return angle;
}

// atan(t / u) = atan2(t * side, |u|)，side 为 b 的 SoS 符号。
int arcAngleQ15 (int u, int t, EdgeLocal edge, bool atVertex) {
  if (atVertex) {
    if (edge.e.y == 0.0) {
      return -Q15_HALF_PI;
    }
    vec2 ratio = edge.e * uInvScale;
    ratio /= max(abs(ratio.x), abs(ratio.y));
    int sy = ratio.y > 0.0 ? 1 : -1;

    return cordicAtan2Q15(abs(toQ15(ratio.y)), toQ15(ratio.x) * sy);
  }
  if (u == 0 && t == 0) {
    return 0;
  }

  return cordicAtan2Q15(abs(u), t * edge.side);
}

// G(t) = t * (P1 + P2 t^2 + P3 t^4 + P4 t^6)，系数为 u^2 的多项式。
int boundaryPolyQ15 (int t, int p1, int p2, int p3) {
  int t2 = mulQ15(t, t);
  int inner = mulQ15(t2, -Q15_ONE_OVER_56) + p3;

  inner = mulQ15(t2, inner) + p2;
  inner = mulQ15(t2, inner) + p1;

  return mulQ15(t, inner);
}

// 返回以 1/65536 为单位的整数。
int featherFixed (EdgeLocal edge) {
  int u = toQ15(edge.b / uRadius);

  if (abs(u) >= Q15_ONE) {
    return 0;
  }
  int span = isqrtQ30(Q15_ONE * Q15_ONE - u * u);
  int t1 = clamp(toQ15(edge.y1 / uRadius), -span, span);
  int t2 = clamp(toQ15(edge.y2 / uRadius), -span, span);

  int u2 = mulQ15(u, u);
  // P1 = 0.5 - 0.75 u^2 + 0.5 u^4 - 0.125 u^6
  int p1 = mulQ15(mulQ15(mulQ15(u2, -Q15_ONE / 8) + Q15_ONE / 2, u2) - Q15_ONE * 3 / 4, u2) + Q15_ONE / 2;
  // P2 = -0.25 + u^2 / 3 - 0.125 u^4
  int p2 = mulQ15(mulQ15(u2, -Q15_ONE / 8) + Q15_ONE_THIRD, u2) - Q15_ONE / 4;
  // P3 = 0.1 - 0.075 u^2
  int p3 = Q15_0_1 - mulQ15(u2, Q15_0_075);

  int poly = boundaryPolyQ15(t2, p1, p2, p3) - boundaryPolyQ15(t1, p1, p2, p3);
  int polyTerm = mulQ15(mulQ15(poly, u), Q15_FOUR_OVER_PI);
  int arcDelta = arcAngleQ15(u, t2, edge, edge.atVertex2) - arcAngleQ15(u, t1, edge, edge.atVertex1);
  int arcTerm = mulQ15(arcDelta, Q15_HALF_OVER_PI);

  return (polyTerm - arcTerm) * 2;
}

void main () {
  EdgeLocal edge = computeEdgeLocal();
  float feather;

  if (uFixedPoint != 0) {
    feather = float(featherFixed(edge)) * (uIntegScale / 65536.0);
  } else {
    feather = featherFloat(edge) * uIntegScale;
  }

  if (uIntegScale > 1.0) {
    feather = floor(feather + 0.5);
  }
  fragColor = vec4(0.0, feather, 0.0, 0.0);
}
