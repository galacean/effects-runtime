precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform sampler2D _GaussianDownTex;
uniform vec2 _GaussianDownTextureSize;

float GaussWeight2D(float x, float y, float sigma) {
  float PI = 3.14159265358;
  float E = 2.71828182846;
  float sigma_2 = pow(sigma, 2.0);

  float a = -(x * x + y * y) / (2.0 * sigma_2);
  return pow(E, a) / (2.0 * PI * sigma_2);
}

vec3 GaussNxN(sampler2D tex, vec2 uv, vec2 stride, float sigma) {
  vec3 color = vec3(0., 0., 0.);
  const int r = 1;
  float weight = 0.0;

  for(int i = -r; i <= r; i++) {
    for(int j = -r; j <= r; j++) {
      float w = GaussWeight2D(float(i), float(j), sigma);
      vec2 coord = uv + vec2(i, j) * stride;
      color += texture2D(tex, coord).rgb * w;
      weight += w;
    }
  }

  color /= weight;
  return color;
}

void main() {
  vec3 lowResColor = GaussNxN(_MainTex, uv, 0.5 / _GaussianDownTextureSize, 1.0);
  vec3 highResColor = GaussNxN(_GaussianDownTex, uv, 1.0 / _GaussianDownTextureSize, 1.0);
  vec3 color = mix(highResColor, lowResColor, 0.7);
  gl_FragColor = vec4(color, 1.0);
}
