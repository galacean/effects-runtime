precision highp float;

varying vec2 vTexCoord;

uniform sampler2D _MainTex;

void main() {
  vec4 texColor = texture2D(_MainTex, vTexCoord.xy);
  if( texColor.a < 0.04) { // 1/256 = 0.04
    discard;
  }
  gl_FragColor =texColor;
}