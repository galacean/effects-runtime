precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform vec2 _TextureSize;

vec3 GaussV(sampler2D tex, vec2 uv) {
  vec3 color = vec3(0.0);
  float offsets[5];
  offsets[0] = -3.23076923;
  offsets[1] = -1.38461538;
  offsets[2] = 0.0;
  offsets[3] = 1.38461538;
  offsets[4] = 3.23076923;
  float weights[5];
  weights[0] = 0.07027027;
  weights[1] = 0.31621622;
  weights[2] = 0.22702703;
  weights[3] = 0.31621622;
  weights[4] = 0.07027027;

  for(int i = 0; i < 5; i++) {
    vec2 offset = vec2(0, offsets[i] * (1.0 / _TextureSize.y));
    color += texture2D(tex, uv + offset).rgb * weights[i];
  }
  return color;
}

void main() {
  vec3 color = GaussV(_MainTex, uv);
  gl_FragColor = vec4(color, 1.0);
}
