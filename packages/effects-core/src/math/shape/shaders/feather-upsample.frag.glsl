precision highp float;

uniform sampler2D uAtlasTex;
uniform vec2 uTextureSize;
uniform vec2 uAtlasSize;
uniform vec2 uTextureOffset;
uniform vec4 uColor;

varying vec2 vTexCoord;

const float cUpBound = 1.05;
const float cLowBound = -0.1;

vec4 fixGatherSave (vec4 gathered) {
  float maxVal = max(gathered.x, gathered.y);
  maxVal = max(maxVal, gathered.z);
  maxVal = max(maxVal, gathered.w);
  float minVal = min(gathered.x, gathered.y);
  minVal = min(minVal, gathered.z);
  minVal = min(minVal, gathered.w);
  if (abs(maxVal - minVal) >= 0.5) {
    return vec4(
      gathered.x + mix(0.0, 1.0, float(gathered.x < 0.0)) - mix(0.0, 1.0, float(gathered.x > 1.0)),
      gathered.y + mix(0.0, 1.0, float(gathered.y < 0.0)) - mix(0.0, 1.0, float(gathered.y > 1.0)),
      gathered.z + mix(0.0, 1.0, float(gathered.z < 0.0)) - mix(0.0, 1.0, float(gathered.z > 1.0)),
      gathered.w + mix(0.0, 1.0, float(gathered.w < 0.0)) - mix(0.0, 1.0, float(gathered.w > 1.0))
    );
  } else {
    return gathered;
  }
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
