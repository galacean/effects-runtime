precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform vec2 _TextureSize;
uniform float _BlurRadius;

void main() {
  // 13-tap separable Gaussian (sigma=2.0, normalized so weights sum to 1.0)
  float weights[13];
  weights[0] = 0.002218;
  weights[1] = 0.008773;
  weights[2] = 0.027023;
  weights[3] = 0.064825;
  weights[4] = 0.121109;
  weights[5] = 0.176213;
  weights[6] = 0.199676;
  weights[7] = 0.176213;
  weights[8] = 0.121109;
  weights[9] = 0.064825;
  weights[10] = 0.027023;
  weights[11] = 0.008773;
  weights[12] = 0.002218;

  // Scale offsets so that the 13 taps span _BlurRadius pixels
  float scale = _BlurRadius / 6.0;
  float pixelSize = 1.0 / _TextureSize.x;

  vec4 color = vec4(0.0);
  for (int i = 0; i < 13; i++) {
    float offset = (float(i) - 6.0) * scale * pixelSize;
    color += texture2D(_MainTex, uv + vec2(offset, 0.0)) * weights[i];
  }

  gl_FragColor = color;
}
