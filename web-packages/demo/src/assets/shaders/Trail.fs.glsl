precision highp float;
varying vec2 uv;

uniform float _GlobalTime;
uniform vec4 _StartColor;
uniform vec4 _EndColor;
uniform sampler2D _MainTex;
uniform sampler2D _Tex2;
uniform sampler2D _Tex3;

void main() {
  vec2 uv0 = uv * vec2(1.0, 1.0) + vec2(-_GlobalTime, 0.0);

  vec3 startColor = _StartColor.rgb * 1.0;
  vec3 endColor = _EndColor.rgb * 1.0;
  vec3 gradientColor = startColor * (1.0 - uv.x) + endColor * uv.x;
  vec3 texColor = texture2D(_Tex2, uv0).rgb;
  vec3 color = gradientColor + texColor;

  float mask = texture2D(_MainTex, uv0).r + texture2D(_Tex3, uv0).r;
  mask = min(mask,1.0);

  float trailEnd = 0.8;
  if(uv.x>trailEnd){
    mask = (1.0 - (uv.x - trailEnd) / (1.0 - trailEnd)) * mask;
  }

  gl_FragColor = vec4(color * mask, mask);
}