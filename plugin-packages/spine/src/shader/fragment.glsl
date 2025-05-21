precision mediump float;
varying mediump vec4 vLight;
varying mediump vec4 vDark;
varying vec2 vTexCoords;
uniform sampler2D uTexture;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoords);
  gl_FragColor.a = texColor.a * vLight.a;
  gl_FragColor.rgb = ((texColor.a - 1.0) * vDark.a + 1.0 - texColor.rgb) * vDark.rgb + texColor.rgb * vLight.rgb;
  gl_FragColor.rgb *= gl_FragColor.a;
}
