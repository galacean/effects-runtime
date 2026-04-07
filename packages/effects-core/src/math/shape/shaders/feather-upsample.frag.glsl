precision highp float;
precision highp int;

uniform sampler2D uAtlasTex;
uniform vec2 uTextureSize;
uniform vec2 uAtlasSize;
uniform vec2 uTextureOffset;
uniform vec4 uColor;

uniform float uScreenRadius; // 屏幕上的卷积核尺寸。

varying vec2 vTexCoord;

vec4 fixGatherSave (vec4 gathered) {
  float downSample = floor(min(max(1.0, uScreenRadius / 10.0), 9999.0)); 
  float downRadius = uScreenRadius / downSample;
  float varyingThres = min(1.0 / downRadius, 0.18);

  float sum = gathered.x + gathered.y + gathered.z + gathered.w;
  float maxVal = max(gathered.x, gathered.y);
  maxVal = max(maxVal, gathered.z);
  maxVal = max(maxVal, gathered.w);
  float minVal = min(gathered.x, gathered.y);
  minVal = min(minVal, gathered.z);
  minVal = min(minVal, gathered.w);
  // 找到中间值：通常，错误的亮斑/暗斑不会相邻。也即是4个相邻像素中最多两个错的。
  float middle = (sum - minVal - maxVal) * 0.5;
  vec4 val = gathered; 

  // 这里先处理以下大于1或小于0的明显异常 不使用if以避免发散
  // 使用fixSingleLayer时可以不用这一段。
  // val.x += (step(val.x, 0.0) - step(1.0, val.x)) * step(0.25, abs(val.x - middle));
  // val.y += (step(val.y, 0.0) - step(1.0, val.y)) * step(0.25, abs(val.y - middle));
  // val.z += (step(val.z, 0.0) - step(1.0, val.z)) * step(0.25, abs(val.z - middle));
  // val.w += (step(val.w, 0.0) - step(1.0, val.w)) * step(0.25, abs(val.w - middle));

  // 约束变化率
  // val.x -= floor((max(val.x - middle, 0.0) / varyingThres)) * varyingThres;
  // val.y -= floor((max(val.y - middle, 0.0) / varyingThres)) * varyingThres;
  // val.z -= floor((max(val.z - middle, 0.0) / varyingThres)) * varyingThres;
  // val.w -= floor((max(val.w - middle, 0.0) / varyingThres)) * varyingThres;

  // val.x += floor((abs(min(val.x - middle, 0.0)) / varyingThres)) * varyingThres;
  // val.y += floor((abs(min(val.y - middle, 0.0)) / varyingThres)) * varyingThres;
  // val.z += floor((abs(min(val.z - middle, 0.0)) / varyingThres)) * varyingThres;
  // val.w += floor((abs(min(val.w - middle, 0.0)) / varyingThres)) * varyingThres;

  // 这个版本给暗部更多关注，效果可能会好些。不过不要求严格gamma，用这个快速平方根会更快。
  vec4 valGamma = sqrt(val);  
  float middleGamma = sqrt(middle);
  valGamma.x -= floor((max(valGamma.x - middleGamma, 0.0) / varyingThres)) * varyingThres;
  valGamma.y -= floor((max(valGamma.y - middleGamma, 0.0) / varyingThres)) * varyingThres;
  valGamma.z -= floor((max(valGamma.z - middleGamma, 0.0) / varyingThres)) * varyingThres;
  valGamma.w -= floor((max(valGamma.w - middleGamma, 0.0) / varyingThres)) * varyingThres;

  valGamma.x += floor((abs(min(valGamma.x - middleGamma, 0.0)) / varyingThres)) * varyingThres;
  valGamma.y += floor((abs(min(valGamma.y - middleGamma, 0.0)) / varyingThres)) * varyingThres;
  valGamma.z += floor((abs(min(valGamma.z - middleGamma, 0.0)) / varyingThres)) * varyingThres;
  valGamma.w += floor((abs(min(valGamma.w - middleGamma, 0.0)) / varyingThres)) * varyingThres;
  val = valGamma * valGamma;

  return val;
}

mat4 softGather (sampler2D sampler, vec2 uv, vec2 texSize) {
  vec2 invTexSize = 1.0 / uAtlasSize;
  vec2 unnormalizedCoords = uv * texSize - 0.5 + uTextureOffset;
  vec2 iuv = floor(unnormalizedCoords);

  vec2 uv_bl = (iuv + vec2(0.5, 0.5)) * invTexSize;
  vec2 uv_br = (iuv + vec2(1.5, 0.5)) * invTexSize;
  vec2 uv_tl = (iuv + vec2(0.5, 1.5)) * invTexSize;
  vec2 uv_tr = (iuv + vec2(1.5, 1.5)) * invTexSize;

  vec4 bl = texture2D(sampler, uv_bl);
  vec4 br = texture2D(sampler, uv_br);
  vec4 tl = texture2D(sampler, uv_tl);
  vec4 tr = texture2D(sampler, uv_tr);

  return mat4(tl, tr, br, bl);
}

// 我们假设1.同一个轮廓不自交，2.有两个通道可用（目前纹理是RGBA，用了RG），则可以使用这个函数
// 如果不满足条件，则应该用32行注释掉的那段。
float fixSingleLayer(float indicator, float integration)
{
  return indicator + integration;
  // if (integration < -0.01) return 1.0 + integration;
  // else if (integration > 0.01) return integration;
  // else return indicator + integration;
  // 无发散版本
  return (1.0 + integration) * step(integration, -0.01) + 
  integration * step(0.01, integration) + 
  (indicator + integration) * step(-0.01, integration) * step(integration, 0.01);
}

float sampleBilinearGather (vec2 uv, vec2 texSize) {
  vec2 pixel = uv * texSize - 0.5;
  vec2 f = fract(pixel);

  // vec4 vals = fixGatherSave(softGather(uAtlasTex, uv, texSize));
  mat4 gathered = softGather(uAtlasTex, uv, texSize);
  vec4 indicators = vec4(gathered[0][0], gathered[1][0], gathered[2][0], gathered[3][0]);
  vec4 integs = vec4(gathered[0][1], gathered[1][1], gathered[2][1], gathered[3][1]);
  vec4 vals = vec4(
    fixSingleLayer(indicators.x, integs.x),
    fixSingleLayer(indicators.y, integs.y),
    fixSingleLayer(indicators.z, integs.z),
    fixSingleLayer(indicators.w, integs.w)
  );
  vals = fixGatherSave(vals);

  float bottom = mix(vals.w, vals.z, f.x);
  float top = mix(vals.x, vals.y, f.x);

  return mix(bottom, top, f.y);
}

float sampleAtlas(vec2 uv, vec2 texSize){
  vec2 invTexSize = 1.0 / uAtlasSize;
  vec2 atlasUV = (uv * texSize + uTextureOffset) * invTexSize;
  vec4 vals = texture2D(uAtlasTex, atlasUV);
  return fixSingleLayer(vals.x, vals.y);
}

void main() {
  vec2 texSize = uTextureSize;
  float opacity;
  float downSample = floor(min(max(1.0, uScreenRadius / 10.0), 9999.0));
  if (downSample < 2.0){
    opacity = sampleAtlas(vTexCoord, texSize);
  }else{
    opacity = sampleBilinearGather(vTexCoord, texSize);
  }
  
  opacity = clamp(opacity, 0.0, 1.0);
  gl_FragColor = vec4(uColor.rgb * uColor.a * opacity, uColor.a * opacity);
}
