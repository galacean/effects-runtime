precision highp float;
varying vec2 uv;

uniform float _GlobalTime;
uniform vec4 _StartColor;
uniform vec4 _EndColor;
uniform sampler2D _MainTex;
uniform sampler2D _MainTex2;

void main() {
  vec2 uv0 = uv * vec2(1.0, 1.0) + vec2(-_GlobalTime, 0.0);
  vec3 startColor = _StartColor.rgb * 1.0;
  vec3 endColor = _EndColor.rgb * 1.0;
  vec3 color = startColor * (1.0 - uv.x) + endColor * uv.x;

  vec3 texColor = texture2D(_MainTex2, uv0).rgb;
  color += texColor;
  vec3 opacity = texture2D(_MainTex, uv0).rgb;

  gl_FragColor = vec4(color * opacity.r, opacity.r);
}