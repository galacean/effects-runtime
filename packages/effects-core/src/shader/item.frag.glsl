precision highp float;

varying vec4 vColor;
varying vec2 vTexCoord;//x y
varying vec3 vParams;//texIndex mulAplha transparentOcclusion

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
  #ifdef TRANSPARENT_VIDEO
    vec2 uv_rgb = vec2(vTexCoord.x * 0.5000, vTexCoord.y);
    vec2 uv_alpha = vec2(vTexCoord.x * 0.5000 + 0.5000, vTexCoord.y);
    vec3 rgb = texture2D(_MainTex, uv_rgb).rgb;
    float alpha = texture2D(_MainTex, uv_alpha).r;
    vec4 texColor = vec4(rgb / alpha, alpha);
  #else
    vec4 texColor = texture2D(_MainTex, vTexCoord.xy);
  #endif
  color = blendColor(texColor, vColor, floor(0.5 + vParams.y));

  #ifdef ALPHA_CLIP
  if(vParams.z == 0. && color.a < 0.04) { // 1/256 = 0.04
    discard;
  }
  #endif
  //color.rgb = pow(color.rgb, vec3(2.2));
  color.a = clamp(color.a, 0.0, 1.0);
  gl_FragColor = color;
}
