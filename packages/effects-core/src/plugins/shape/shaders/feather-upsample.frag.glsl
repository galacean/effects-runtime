precision highp float;
precision highp int;

#include "./gradient.glsl"

uniform sampler2D uAtlasTex;
uniform vec2 uTextureSize;
uniform vec2 uAtlasSize;
uniform vec2 uTextureOffset;
uniform vec2 uExpandedMin;   // upsample 四边形在局部空间的最小点
uniform vec2 uExpandedSize;  // upsample 四边形的宽高
uniform vec2 uGradientMin;   // 紧包围盒最小点，渐变 UV 的原点
uniform vec2 uGradientSize;  // 紧包围盒宽高

uniform float uIndicatorSoS;  // 1：indicator 与积分一致，直接相加；0：用 fixSingleLayer 消除不一致

varying vec2 vTexCoord;

const float INTEG_SCALE = 32768.0;

mat4 softGather (sampler2D sampler, vec2 uv, vec2 texSize) {
  vec2 invTexSize = 1.0 / uAtlasSize;
  vec2 unnormalizedCoords = uv * texSize - 0.5 + uTextureOffset;
  vec2 iuv = floor(unnormalizedCoords);

  vec2 uv_bl = (iuv + vec2(0.5, 0.5)) * invTexSize;
  vec2 uv_br = (iuv + vec2(1.5, 0.5)) * invTexSize;
  vec2 uv_tl = (iuv + vec2(0.5, 1.5)) * invTexSize;
  vec2 uv_tr = (iuv + vec2(1.5, 1.5)) * invTexSize;

// 这里有个非常大的bug：
// 这是我们希望实现的，texelFetch读取一个像素
  // vec4 bl = texelFetch(sampler, ivec2(iuv), 0);
  // vec4 br = texelFetch(sampler, ivec2(iuv) + ivec2(1, 0), 0);
  // vec4 tl = texelFetch(sampler, ivec2(iuv) + ivec2(0, 1), 0);
  // vec4 tr = texelFetch(sampler, ivec2(iuv) + ivec2(1, 1), 0);
// 这是之前使用的，基于texture2D兼容webgl1的实现。
// 然而，这个函数模拟fetch时必须关闭各向异性过滤才能得到正确的结果！目前已在cpu端关闭。
  vec4 bl = texture2D(sampler, uv_bl);
  vec4 br = texture2D(sampler, uv_br);
  vec4 tl = texture2D(sampler, uv_tl);
  vec4 tr = texture2D(sampler, uv_tr);

  return mat4(tl, tr, br, bl);
}

// G/B/A 是基数 8 的三位，位权 1、8、64。
float decodeIntegration (vec4 texel) {
  return (texel.a * 64.0 + texel.b * 8.0 + texel.g) / INTEG_SCALE;
}

// 这个函数用于同步indicator和integration的内外判定。只适用于单层图形。
// 以integration的判定为准，integration为0时再考虑indicator判定。
// 0.005比1/256稍微大一点。
float fixSingleLayer(float indicator, float integration)
{
  return (1.0 + integration) * step(integration, -0.005) +
  integration * step(0.005, integration) +
  (indicator + integration) * step(-0.005, integration) * step(integration, 0.005);
}

// 在不使用整数几何（它做起来有点麻烦，在有-无feather切换几何时可能引入微小的不对齐，并且对webgl1支持不佳）的情况下
// 我们无法保证indicator和integration的内外判定完全一致（因为浮点误差）
// 可能会相差整数值（最常见的是边界/接缝处相差正负1）
// 这个函数用于修正这种情况：检查偏差，如果偏差接近或大于1，则减去“偏差取整”。
// X Y
// W Z
vec4 supressLargeNoises(vec4 vals)
{
  float xDiff = (vals.x - vals.y + vals.x - vals.z) * 0.5;
  float yDiff = (vals.y - vals.x + vals.y - vals.w) * 0.5;
  float zDiff = (vals.z - vals.y + vals.z - vals.w) * 0.5;
  float wDiff = (vals.w - vals.z + vals.w - vals.x) * 0.5;
  // WebGL1 不支持 round，使用 floor(x + 0.5) 取整。
  vals.x -= floor(xDiff + 0.5) * step(0.9, abs(xDiff));
  vals.y -= floor(yDiff + 0.5) * step(0.9, abs(yDiff));
  vals.z -= floor(zDiff + 0.5) * step(0.9, abs(zDiff));
  vals.w -= floor(wDiff + 0.5) * step(0.9, abs(wDiff));
  return vals;
}

float sampleBilinearGather (vec2 uv, vec2 texSize) {
  vec2 pixel = uv * texSize - 0.5;
  vec2 f = fract(pixel);
  mat4 gathered = softGather(uAtlasTex, uv, texSize);
  vec4 indicators = vec4(gathered[0][0], gathered[1][0], gathered[2][0], gathered[3][0]);
  vec4 integs = vec4(
    decodeIntegration(gathered[0]),
    decodeIntegration(gathered[1]),
    decodeIntegration(gathered[2]),
    decodeIntegration(gathered[3])
  );
  vec4 vals;
  // indicatorSoS是一种特殊的内外判定方式，可以最大程度对齐indicator和integration的内外判定。
  // 相比关闭时使用gl_frontfacing判断并使用fixSingleLayer修正的方案，它可以支持自相交图形（即同一个位置有>1层图形）。
  // 代价是三角形接缝处有极小概率因浮点误差而出错（如果使用整数几何，可以完全避免）。因此也需要supressLargeNoises修正。
  if (uIndicatorSoS > 0.5) {
    vals = indicators + integs;
  } else {
    vals = vec4(
      fixSingleLayer(indicators.x, integs.x),
      fixSingleLayer(indicators.y, integs.y),
      fixSingleLayer(indicators.z, integs.z),
      fixSingleLayer(indicators.w, integs.w)
    );
  }
  vals = supressLargeNoises(vals);

  float bottom = mix(vals.w, vals.z, f.x);
  float top = mix(vals.x, vals.y, f.x);

  return mix(bottom, top, f.y);
}

void main() {
  vec2 texSize = uTextureSize;
  float opacity = sampleBilinearGather(vTexCoord, texSize);
  opacity = clamp(opacity, 0.0, 1.0);

  vec2 localPos = uExpandedMin + vTexCoord * uExpandedSize;
  vec2 gradientUV = (localPos - uGradientMin) / max(uGradientSize, vec2(1e-6));
  vec4 color = evalGradient(gradientUV);

  gl_FragColor = vec4(color.rgb * color.a * opacity, color.a * opacity);
}
