uniform vec2 uMoveTexSize;
uniform sampler2D uFilterSource;
#define INTERPOLATION 1
vec4 filterMain(vec2 texCoord, sampler2D tex) {
    #ifdef INTERPOLATION
  vec2 texInPixel = texCoord * uMoveTexSize;
  vec2 coordMin = floor(texInPixel);
  vec2 pp = texInPixel - coordMin;
  vec4 fCoord = vec4(coordMin / uMoveTexSize, (coordMin + vec2(1.)) / uMoveTexSize);
  vec4 cLT = texture2D(uFilterSource, vec2(fCoord.x, fCoord.w));
  vec4 cLB = texture2D(uFilterSource, vec2(fCoord.x, fCoord.y));
  vec4 cRT = texture2D(uFilterSource, vec2(fCoord.z, fCoord.w));
  vec4 cRB = texture2D(uFilterSource, vec2(fCoord.z, fCoord.y));
  vec4 cB = mix(cLB, cRB, pp.x);
  vec4 cT = mix(cLT, cRT, pp.x);
  return mix(cB, cT, pp.y);
    #else
  return texture2D(uFilterSource, texCoord);
    #endif
}
