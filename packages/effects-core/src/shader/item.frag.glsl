precision highp float;

varying vec4 vColor;
varying vec2 vTexCoord;//x y
varying vec3 vParams;//maskMode mulAplha transparentOcclusion

uniform sampler2D _MainTex;

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

void main() {
  vec4 color = vec4(0.);
  vec4 texColor = texture2D(_MainTex, vTexCoord.xy);
  color = blend Color(texColor, vColor, floor(0.5 + vParams.y));

// 如果是蒙版且透明度小于阈值 舍弃像素
  if (vParams.x == 1. && color.a < 0.04) {
    discard;
  }

  #ifdef ALPHA_CLIP
  if(vParams.z == 0. && color.a < 0.04) { // 1/256 = 0.04
    discard;
  }
  #endif

  color.a = clamp(color.a, 0.0, 1.0);
  gl_FragColor = color;
}
