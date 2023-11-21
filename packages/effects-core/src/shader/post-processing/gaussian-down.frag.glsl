precision highp float;

varying vec2 uv;
uniform sampler2D _MainTex;
uniform vec2 _TextureSize;


float GaussWeight2D(float x, float y, float sigma)
{
  float PI = 3.14159265358;
  float E  = 2.71828182846;
  float sigma_2 = pow(sigma, 2.0);

  float a = -(x*x + y*y) / (2.0 * sigma_2);
  return pow(E, a) / (2.0 * PI * sigma_2);
}

vec3 GaussNxN(sampler2D tex, vec2 uv, vec2 stride, float sigma)
{
  vec3 color = vec3(0., 0., 0.);
  const int r = 5 / 2;
  float weight = 0.0;

  for(int i=-r; i<=r; i++)
  {
    for(int j=-r; j<=r; j++)
    {
      float w = GaussWeight2D(float(i), float(j), sigma);
      vec2 coord = uv + vec2(i, j) * stride;
      color += texture2D(tex, coord).rgb * w;
      weight += w;
    }
  }

  color /= weight;
  return color;
}

void main(){
  vec4 mainColor = texture2D(_MainTex, uv);
  vec3 color = mainColor.rgb;
  color = GaussNxN(_MainTex, uv, 1.0/_TextureSize, 1.0);
  gl_FragColor = vec4(color, 1.0);
}