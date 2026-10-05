precision highp float;
precision highp int;

uniform sampler2D uAtlasTex;
uniform vec2 uTextureSize;
uniform vec2 uAtlasSize;
uniform vec2 uTextureOffset;
uniform vec4 uColor;

uniform float uScreenRadius; // 屏幕上的卷积核尺寸。

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

// 我们假设同一个轮廓不自交，则可以使用这个函数。
// 如果不满足条件，则应该用32行注释掉的那段。
// G/B/A 是基数 8 的三位，位权 1、8、64。
float decodeIntegration (vec4 texel) {
  return (texel.a * 64.0 + texel.b * 8.0 + texel.g) / INTEG_SCALE;
}

float fixSingleLayer(float indicator, float integration)
{
  return (1.0 + integration) * step(integration, -0.005) + 
  integration * step(0.005, integration) + 
  (indicator + integration) * step(-0.005, integration) * step(integration, 0.005);
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
  vec4 vals = vec4(
    fixSingleLayer(indicators.x, integs.x),
    fixSingleLayer(indicators.y, integs.y),
    fixSingleLayer(indicators.z, integs.z),
    fixSingleLayer(indicators.w, integs.w)
  );

  float bottom = mix(vals.w, vals.z, f.x);
  float top = mix(vals.x, vals.y, f.x);

  return mix(bottom, top, f.y);
}

void main() {
  vec2 texSize = uTextureSize;
  float opacity = sampleBilinearGather(vTexCoord, texSize);
  opacity = clamp(opacity, 0.0, 1.0);
  gl_FragColor = vec4(uColor.rgb * uColor.a * opacity, uColor.a * opacity);
}
