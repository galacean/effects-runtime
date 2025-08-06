precision highp float;

varying vec2 uv0;

uniform sampler2D _MainTex;

void main() {
  vec2 uvMain = uv0;
  vec3 color = texture2D(_MainTex, uv0).rgb;
  gl_FragColor = vec4(color, 1.0);
}
