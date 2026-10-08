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

uniform float uScreenRadius; // 屏幕上的卷积核尺寸。
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

// 这个函数用于同步indicator和integration的内外判定。
// 0.005比1/256稍微大一点。
float fixSingleLayer(float indicator, float integration)
{
  return (1.0 + integration) * step(integration, -0.005) + 
  integration * step(0.005, integration) + 
  (indicator + integration) * step(-0.005, integration) * step(integration, 0.005);
}

// fixSingleLayer在羽化半径极大、数值极小的时候还是有概率会判定错。
// 这可能和我们scatter时fp16精度限制有关：半径巨大时有太多很微小的值叠加在一起。
// 加了这个函数专门针对这种情况干掉接近1的亮点。
// X Y
// W Z
vec4 supressLargeNoises(vec4 vals)
{
  vec4 outVals = max(vals, 0.0);
  float isXNormal = step(vals.x - vals.y, 0.9) * step(vals.x - vals.z, 0.9);
  float isYNormal = step(vals.y - vals.x, 0.9) * step(vals.y - vals.w, 0.9);
  float isZNormal = step(vals.z - vals.y, 0.9) * step(vals.z - vals.w, 0.9);
  float isWNormal = step(vals.w - vals.z, 0.9) * step(vals.w - vals.x, 0.9);
  vals.x = isXNormal * vals.x + (1.0 - isXNormal) * (vals.y + vals.z) * 0.5;
  vals.y = isYNormal * vals.y + (1.0 - isYNormal) * (vals.x + vals.w) * 0.5;
  vals.z = isZNormal * vals.z + (1.0 - isZNormal) * (vals.y + vals.w) * 0.5;
  vals.w = isWNormal * vals.w + (1.0 - isWNormal) * (vals.x + vals.z) * 0.5;
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
  if (uIndicatorSoS > 0.5) {
    vals = indicators + integs;
  } else {
    vals = vec4(
      fixSingleLayer(indicators.x, integs.x),
      fixSingleLayer(indicators.y, integs.y),
      fixSingleLayer(indicators.z, integs.z),
      fixSingleLayer(indicators.w, integs.w)
    );
    vals = supressLargeNoises(vals);
  }

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
