#version 100
precision mediump float;

#define PATICLE_SHADER 1
varying float vLife;
varying vec2 vTexCoord;
varying vec4 vColor;

uniform vec3 emissionColor;
uniform float emissionIntensity;

uniform sampler2D uMaskTex;
uniform vec4 uColorParams;//mask preMulAlpha xxx alpha_cutout
uniform vec2 uTexOffset;
#ifdef COLOR_OVER_LIFETIME
uniform sampler2D uColorOverLifetime;
#endif

#ifdef USE_SPRITE
varying vec4 vTexCoordBlend;
#endif
varying float vSeed;

#ifdef PREVIEW_BORDER
uniform vec4 uPreviewColor;
#endif

#ifdef USE_SPRITE
vec4 getTextureColor(sampler2D tex, vec2 texCoord) {
  if(vTexCoordBlend.w > 0.) {
    return mix(texture2D(tex, texCoord), texture2D(tex, vTexCoordBlend.xy + texCoord), vTexCoordBlend.z);
  }
  return texture2D(tex, texCoord);
}
#else
#define getTextureColor texture2D
#endif

#ifndef WEBGL2
#define round(a) floor(0.5+a)
#endif

vec4 blendColor(vec4 color, vec4 vc, float mode) {
  vec4 ret = color * vc;
  float alpha = ret.a;

  if(mode == 1.) {
    ret.rgb *= alpha;
  } else if(mode == 2.) {
    ret.rgb *= alpha;
    ret.a = dot(ret.rgb, vec3(0.33333333));
  } else if(mode == 3.) {
    alpha = color.r * alpha;
    ret = vec4(vc.rgb * alpha, alpha);
  }
  return ret;
}

#ifdef PREVIEW_BORDER
void main() {
  gl_FragColor = uPreviewColor;
}
#else
void main() {
  vec4 color = vec4(1.0);
  vec4 tempColor = vColor;
  vec2 texOffset = uTexOffset;
  if(vLife < 0.) {
    discard;
  }
  if(uColorParams.x > 0.0) {
    color = getTextureColor(uMaskTex, vTexCoord);
  }
  #ifdef COLOR_OVER_LIFETIME
      #ifndef ENABLE_VERTEX_TEXTURE
        tempColor *= texture2D(uColorOverLifetime, vec2(vLife, 0.));
      #endif
  #endif
  color = blendColor(color, tempColor, round(uColorParams.y));
  if(color.a <= 0.01 && uColorParams.w > 0.) {
    float _at = texture2D(uMaskTex, vTexCoord + texOffset).a + texture2D(uMaskTex, vTexCoord + texOffset * -1.).a;
    if(_at <= 0.02) {
      discard;
    }
  }

  // 先对自发光做gamma0.45，后续统一shader着色在线性空间中可去除。
  vec3 emission = emissionColor * pow(2.0, emissionIntensity);
  color = vec4(pow(pow(color.rgb, vec3(2.2)) + emission, vec3(1.0 / 2.2)), color.a);
  gl_FragColor = color;
}

#endif
