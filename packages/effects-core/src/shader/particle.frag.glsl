#version 300 es
precision mediump float;
#pragma "./compatible.frag.glsl";
#import "./blend.glsl";
#define PATICLE_SHADER 1
in float vLife;
in vec2 vTexCoord;
in vec4 vColor;

uniform vec3 emissionColor;
uniform float emissionIntensity;

uniform sampler2D uMaskTex;
uniform vec4 uColorParams;//mask preMulAlpha xxx alpha_cutout
uniform vec2 uTexOffset;
#ifdef COLOR_OVER_LIFETIME
uniform sampler2D uColorOverLifetime;
#endif

#ifdef USE_SPRITE
in vec4 vTexCoordBlend;
#ifdef USE_FILTER
uniform vec4 uFSprite;
#endif
#endif
in float vSeed;

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

#ifdef PREVIEW_BORDER
void main() {
  fragColor = uPreviewColor;
}
#else
#pragma FILTER_FRAG
void main() {
  vec4 color = vec4(1.0);
  vec4 tempColor = vColor;
  vec2 texOffset = uTexOffset;
  if(vLife < 0.) {
    discard;
  }
    #ifdef USE_FILTER
        #ifdef USE_SPRITE
  texOffset = uTexOffset / uFSprite.xy;
        #endif
  color = filterMain(vTexCoord, uMaskTex);
    #else
  if(uColorParams.x > 0.0) {
    color = getTextureColor(uMaskTex, vTexCoord);
  }
        #endif

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
  color = vec4(pow(pow(color.rgb, vec3(2.2)) + emission, vec3(1.0/2.2)), color.a);
  fragColor = color;
}
#endif
