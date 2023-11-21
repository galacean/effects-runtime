uniform sampler2D uAlphaXSample;
uniform sampler2D uAlphaYSample;

vec4 filterMain(vec2 texCoord, sampler2D source) {
  vec4 color = texture2D(source, texCoord);
  float x = texture2D(uAlphaXSample, vec2(vFeatherCoord.x, 0.)).r;
  float y = texture2D(uAlphaYSample, vec2(vFeatherCoord.y, 0.)).r;
  return vec4(color.rgb, color.a * min(x, y));
}
