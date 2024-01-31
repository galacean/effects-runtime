precision highp float;
varying vec2 uv;

uniform vec4 _MainColor;
uniform sampler2D _MainTex;
uniform sampler2D _Tex2;
uniform sampler2D _Tex3;

void main() {
  vec3 texColor = texture2D(_MainTex, uv).rgb;
  vec3 color = texColor * _MainColor.rgb;
  gl_FragColor = vec4(color, 1.0);
}
