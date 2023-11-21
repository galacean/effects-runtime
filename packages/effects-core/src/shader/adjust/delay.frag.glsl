uniform sampler2D uLastSource;
uniform vec4 uParams;//enabled blending

vec4 filterMain(vec2 coord, sampler2D tex) {
  vec4 c1 = texture2D(tex, coord);
  if(uParams.x < 1.) {
    return c1;
  }
  vec4 c2 = texture2D(uLastSource, coord);
  return mix(c1, c2, uParams.y);
}
