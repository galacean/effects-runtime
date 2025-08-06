precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 vTexCoord;

#define MAX_BLOCK_NUM 10
#define EPSILON 1e-6

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;
uniform vec3 _ControlPoints[MAX_BLOCK_NUM * MAX_BLOCK_NUM];
uniform vec3 _BoundMin;
uniform vec3 _BoundMax;
uniform int _ColNum;   // 列数量（行控制点数）
uniform int _RowNum;   // 行数量（列控制点数）

// 计算二项式系数 C(n, k)
float binomialCoefficient(int n, int k) {
  // 减少循环次数：C(n, k) == C(n, n-k)
  if(k > n - k)
    k = n - k;

  float result = 1.0;
  for(int i = 1; i <= k; ++i) {
    result *= float(n - i + 1) / float(i);
  }
  return result;
}

// 计算 n 阶第 k 项的基函数值 Bernstein(n, k, t)
float bernstein(int n, int k, float t) {
  // t 在 [0, 1] 范围外直接返回 0
  if(t < 0.0 || t > 1.0)
    return 0.0;

  // 端点精度处理
  if(abs(t) < EPSILON && k == 0)
    return 1.0;
  else if(abs(t - 1.0) < EPSILON && k == n)
    return 1.0;

  // 计算公式：C(n, k) * t^k * (1-t)^(n-k)
  float coeff = binomialCoefficient(n, k);
  float tk = (k == 0) ? 1.0 : pow(t, float(k));
  float tnk = ((n - k) == 0) ? 1.0 : pow(1.0 - t, float(n - k));
  return coeff * tk * tnk;
}

vec3 bezierSurface(vec3 originalPos) {
  // 判断点是否在包围盒内，不在则直接返回原始位置
  bool isInBoundingBox =
    originalPos.x >= _BoundMin.x - EPSILON && originalPos.x <= _BoundMax.x + EPSILON &&
    originalPos.y >= _BoundMin.y - EPSILON && originalPos.y <= _BoundMax.y + EPSILON &&
    originalPos.z >= _BoundMin.z - EPSILON && originalPos.z <= _BoundMax.z + EPSILON;

  if(!isInBoundingBox) {
    return originalPos;
  }

  float u = (originalPos.x - _BoundMin.x) / (_BoundMax.x - _BoundMin.x);
  float v = (originalPos.y - _BoundMin.y) / (_BoundMax.y - _BoundMin.y);

  vec3 newPos = vec3(0.0);

  for(int row = 0; row < MAX_BLOCK_NUM; ++row) {
    if(row >= _RowNum)
      break;
    float bv = bernstein(_RowNum - 1, row, v);
    for(int col = 0; col < MAX_BLOCK_NUM; ++col) {
      if(col >= _ColNum)
        break;
      float bu = bernstein(_ColNum - 1, col, u);
      int idx = row * _ColNum + col;
      newPos += _ControlPoints[idx] * bu * bv;
    }
  }
  return newPos;
}

void main() {
  vTexCoord = aUV;
  vec3 newPos = bezierSurface(aPos);
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(newPos, 1.0);
}