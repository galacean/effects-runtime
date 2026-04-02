precision highp float;
precision highp int;

uniform sampler2D uAtlasTex;
uniform vec2 uTextureSize;
uniform vec2 uAtlasSize;
uniform vec2 uTextureOffset;
uniform vec4 uColor;

uniform float uScreenRadius; // 屏幕上的卷积核尺寸。

varying vec2 vTexCoord;

// 估计图像中合理的最大梯度。
// 假设输入是随机{0，1}噪声，应用卷积核。最大梯度发生在一侧是0一侧是1的情况。
// 让千问AI计算得到最大梯度的估计：256/(35 * PI * R) = 2.33/R
// 考虑到降采样R/10，相邻像素的最大可能梯度为：0.233 (R>10)
// 不过，对于巨大半径，此时不存在一侧1一侧0的可能，看作在随机噪声纹理的卷积上求极值
// 此时最大梯度是一个期望，千问AI算出来是0.874/(R^2) * sqrt(2lnWH)，WH为图像尺寸
// 取W=H=1000,最大梯度期望为4.594 / (R^2)
// 在N倍降采样下，期望是0.874 / (R/N)^2 * sqrt(2ln(WH/N^2))  

// 看起来这个修复函数也不能完全解决问题。（就是那个亮斑问题）
vec4 fixGatherSave (vec4 gathered) {
  float downSample = floor(min(max(1.0, uScreenRadius / 10.0), 32.0)); 
  float downRadius = uScreenRadius / downSample;
  float varyingThres = min(2.33 / downRadius, 0.18);

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
  val.x += (mix(0.0, 1.0, float(val.x < 0.0)) - mix(0.0, 1.0, float(val.x > 1.0))) * float(abs(val.x - middle) >= 0.2);
  val.y += (mix(0.0, 1.0, float(val.y < 0.0)) - mix(0.0, 1.0, float(val.y > 1.0))) * float(abs(val.y - middle) >= 0.2);
  val.z += (mix(0.0, 1.0, float(val.z < 0.0)) - mix(0.0, 1.0, float(val.z > 1.0))) * float(abs(val.z - middle) >= 0.2);
  val.w += (mix(0.0, 1.0, float(val.w < 0.0)) - mix(0.0, 1.0, float(val.w > 1.0))) * float(abs(val.w - middle) >= 0.2);

  // 这个更新看起来很有道理，但是会导致小半径下自相交部分的错误。该死的自相交...为什么？？
  // sum = val.x + val.y + val.z + val.w;
  // maxVal = max(val.x, val.y);
  // maxVal = max(maxVal, val.z);
  // maxVal = max(maxVal, val.w);
  // minVal = min(val.x, val.y);
  // minVal = min(minVal, val.z);
  // minVal = min(minVal, val.w);
  // middle = (sum - minVal - maxVal) * 0.5;

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

vec4 softGather (sampler2D sampler, vec2 uv, vec2 texSize) {
  vec2 invTexSize = 1.0 / uAtlasSize;
  vec2 unnormalizedCoords = uv * texSize - 0.5 + uTextureOffset;
  vec2 iuv = floor(unnormalizedCoords);

  vec2 uv_bl = (iuv + vec2(0.5, 0.5)) * invTexSize;
  vec2 uv_br = (iuv + vec2(1.5, 0.5)) * invTexSize;
  vec2 uv_tl = (iuv + vec2(0.5, 1.5)) * invTexSize;
  vec2 uv_tr = (iuv + vec2(1.5, 1.5)) * invTexSize;

  float bl = texture2D(sampler, uv_bl).r;
  float br = texture2D(sampler, uv_br).r;
  float tl = texture2D(sampler, uv_tl).r;
  float tr = texture2D(sampler, uv_tr).r;

  return vec4(tl, tr, br, bl);
}

float sampleBilinearGather (vec2 uv, vec2 texSize) {
  vec2 pixel = uv * texSize - 0.5;
  vec2 f = fract(pixel);
  vec4 vals = fixGatherSave(softGather(uAtlasTex, uv, texSize));

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
