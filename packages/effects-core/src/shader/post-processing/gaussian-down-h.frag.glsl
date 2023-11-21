precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform vec2 _TextureSize;

vec3 GaussH(sampler2D tex, vec2 uv) {
  vec3 color = vec3(0.0);
  float offsets[9];
  offsets[0] = -4.0;
  offsets[1] = -3.0;
  offsets[2] = -2.0;
  offsets[3] = -1.0;
  offsets[4] = 0.0;
  offsets[5] = 1.0;
  offsets[6] = 2.0;
  offsets[7] = 3.0;
  offsets[8] = 4.0;
  float weights[9];
  weights[0] = 0.01621622;
  weights[1] = 0.05405405;
  weights[2] = 0.12162162;
  weights[3] = 0.19459459;
  weights[4] = 0.22702703;
  weights[5] = 0.19459459;
  weights[6] = 0.12162162;
  weights[7] = 0.05405405;
  weights[8] = 0.01621622;
  for(int i = 0; i < 9; i++) {
    vec2 offset = vec2(offsets[i] * 2.0 * (1.0 / _TextureSize.x), 0);
    color += texture2D(tex, uv + offset).rgb * weights[i];
  }
  return color;
}

void main() {
  vec3 color = GaussH(_MainTex, uv);
  gl_FragColor = vec4(color, 1.0);
}
