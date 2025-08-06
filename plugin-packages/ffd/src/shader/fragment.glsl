precision highp float;

varying vec2 vTexCoord;

uniform sampler2D _MainTex;

void main() {
  vec3 color = texture2D(_MainTex, vTexCoord).rgb;
  gl_FragColor = vec4(color, 1.0);
}