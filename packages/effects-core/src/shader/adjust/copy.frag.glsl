uniform vec2 uFilterSourceSize;
uniform sampler2D uFilterSource;

#define INTERPOLATION 1

vec4 filterMain(vec2 texCoord, sampler2D tex) {
    #ifdef INTERPOLATION
  vec2 texInPixel = texCoord * uFilterSourceSize;
  vec2 coordMin = floor(texInPixel);
  vec2 pp = texInPixel - coordMin;
  vec4 fCoord = vec4(coordMin / uFilterSourceSize, (coordMin + vec2(1.)) / uFilterSourceSize);
  vec4 cLT = texture2D(uFilterSource, vec2(fCoord.x, fCoord.w));
  vec4 cLB = texture2D(uFilterSource, vec2(fCoord.x, fCoord.y));
  vec4 cRT = texture2D(uFilterSource, vec2(fCoord.z, fCoord.w));
  vec4 cRB = texture2D(uFilterSource, vec2(fCoord.z, fCoord.y));
  return mix(mix(cLB, cRB, pp.x), mix(cLT, cRT, pp.x), pp.y);
    #else
  return texture2D(uFilterSource, texCoord);
    #endif
}
