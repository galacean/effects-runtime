#version 300 es
precision highp float;
#pragma "./compatible.frag.glsl";
#import "./blend.glsl";
#define SPRITE_SHADER 1
in vec4 vColor;
in vec4 vTexCoord;//x y
in highp vec3 vParams;//texIndex mulAplha transparentOcclusion

#ifdef ADJUST_LAYER
uniform sampler2D uSamplerPre;
vec4 filterMain(vec2 coord, sampler2D tex);
in vec2 vFeatherCoord;
uniform sampler2D uFeatherSampler;
#endif

uniform sampler2D uSampler0;
uniform sampler2D uSampler1;
uniform sampler2D uSampler2;
uniform sampler2D uSampler3;
uniform sampler2D uSampler4;
uniform sampler2D uSampler5;
uniform sampler2D uSampler6;
uniform sampler2D uSampler7;
#if MAX_FRAG_TEX == 16
uniform sampler2D uSampler8;
uniform sampler2D uSampler9;
uniform sampler2D uSampler10;
uniform sampler2D uSampler11;
uniform sampler2D uSampler12;
uniform sampler2D uSampler13;
uniform sampler2D uSampler14;
uniform sampler2D uSampler15;
#endif

vec4 texture2DbyIndex(float index, vec2 coord);

#pragma FILTER_FRAG

#ifndef WEBGL2
#define round(a) floor(0.5+a)
#endif

void main() {
  vec4 color = vec4(0.);
    #ifdef ADJUST_LAYER
  vec2 featherCoord = abs(vFeatherCoord - vec2(0.5)) / 0.5;
  float cc = sqrt(max(featherCoord.x, featherCoord.y));
  float blend = vColor.a * texture2D(uFeatherSampler, vec2(cc, 0.)).r;
  if(blend >= 1.) {
    color = filterMain(vTexCoord.xy, uSamplerPre);
  } else if(blend <= 0.) {
    color = texture2D(uSamplerPre, vTexCoord.zw);
  } else {
    color = mix(texture2D(uSamplerPre, vTexCoord.zw), filterMain(vTexCoord.xy, uSamplerPre), blend);
  }
         //color = vec4(blend,blend,blend,1.0);
    #else
  vec4 texColor = texture2DbyIndex(round(vParams.x), vTexCoord.xy);
  color = blendColor(texColor, vColor, round(vParams.y));
  if(vParams.z == 0. && color.a < 0.04) { // 1/256 = 0.04
    discard;
  }
    #endif
  //color.rgb = pow(color.rgb, vec3(2.2));
  color.a = clamp(color.a, 0.0, 1.0);
  fragColor = color;
}

vec4 texture2DbyIndex(float index, vec2 coord) {
    #ifndef ADJUST_LAYER
  if(index == 0.) {
    return texture2D(uSampler0, coord);
  }
  if(index == 1.) {
    return texture2D(uSampler1, coord);
  }
  if(index == 2.) {
    return texture2D(uSampler2, coord);
  }
  if(index == 3.) {
    return texture2D(uSampler3, coord);
  }
  if(index == 4.) {
    return texture2D(uSampler4, coord);
  }
  if(index == 5.) {
    return texture2D(uSampler5, coord);
  }
  if(index == 6.) {
    return texture2D(uSampler6, coord);
  }
  if(index == 7.) {
    return texture2D(uSampler7, coord);
  }
        #if MAX_FRAG_TEX == 16
  if(index == 8.) {
    return texture2D(uSampler8, coord);
  }
  if(index == 9.) {
    return texture2D(uSampler9, coord);
  }
  if(index == 10.) {
    return texture2D(uSampler10, coord);
  }
  if(index == 11.) {
    return texture2D(uSampler11, coord);
  }
  if(index == 12.) {
    return texture2D(uSampler12, coord);
  }
  if(index == 13.) {
    return texture2D(uSampler13, coord);
  }
  if(index == 14.) {
    return texture2D(uSampler14, coord);
  }
  if(index == 15.) {
    return texture2D(uSampler15, coord);
  }
        #endif
  return texture2D(uSampler0, coord);
    #else
  return vec4(0.);
    #endif
}
