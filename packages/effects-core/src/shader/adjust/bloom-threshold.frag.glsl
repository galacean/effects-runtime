uniform vec4 uColorThreshold;//rgb weights

vec4 filterMain(vec2 coord, sampler2D tex) {
  vec4 c1 = texture2D(tex, coord);
  vec3 color = c1.rgb * c1.a;
  vec3 s = step(uColorThreshold.xyz, color);
  float m = min(s.r + s.g + s.b, 1.);
  return c1 * m;
}
