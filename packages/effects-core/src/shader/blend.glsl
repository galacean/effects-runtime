vec4 blendColor(vec4 color, vec4 vc, float mode) {
  vec4 ret = color * vc;
    #ifdef PRE_MULTIPLY_ALPHA
  float alpha = vc.a;
    #else
  float alpha = ret.a;
    #endif
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
