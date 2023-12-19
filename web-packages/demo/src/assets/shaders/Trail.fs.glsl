precision highp float;
varying vec2 uv;

uniform float _GlobalTime;
uniform sampler2D _MainTex;

void main() {
  vec2 uv0 = uv + vec2(-_GlobalTime, 0.0);

  vec3 startColor = vec3(1.0,1.0,0.2)*2.0;
  vec3 endColor = vec3(1.0,0.2,0.2)*1.5;

  vec3 color = startColor * (1.0 - uv.x) + endColor * uv.x;
  vec3 opacity = texture2D(_MainTex,uv0).rgb * 1.0;

  gl_FragColor = vec4(color*opacity,1.0);
}