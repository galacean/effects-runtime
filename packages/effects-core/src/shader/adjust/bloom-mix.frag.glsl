uniform sampler2D uBloomBlur;
uniform vec4 uBloomParams;//blurColorMul colorMul threshold

vec4 filterMain(vec2 coord, sampler2D tex) {
  const vec3 gamma = vec3(1. / 2.2);
  vec4 c1 = texture2D(tex, coord);
  vec4 bloomColor = texture2D(uBloomBlur, coord);
  float alpha = max(c1.a, bloomColor.a);
  vec3 color = max(c1.rgb * c1.a, bloomColor.rgb * bloomColor.a) / alpha * uBloomParams.y + bloomColor.rgb * uBloomParams.x;
  return vec4(color, alpha);
    //return bloomColor;
}
