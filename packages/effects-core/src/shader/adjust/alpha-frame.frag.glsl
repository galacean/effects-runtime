uniform vec4 uTexRange;
uniform vec2 uFilterSourceSize;

#define INTERPOLATION 0

vec4 filterMain(vec2 texCoord, sampler2D source) {
  float x = uTexRange.x + texCoord.x * uTexRange.y;
    #if INTERPOLATION
  vec2 texInPixel = texCoord * uFilterSourceSize;
  vec2 coordMin = floor(texInPixel);
  vec2 pp = texInPixel - coordMin;
  vec4 fCoord = vec4(coordMin / uFilterSourceSize, (coordMin + vec2(1.)) / uFilterSourceSize);
  vec4 cLT = texture2D(uFilterSource, vec2(fCoord.x, fCoord.w));
  vec4 cLB = texture2D(uFilterSource, vec2(fCoord.x, fCoord.y));
  vec4 cRT = texture2D(uFilterSource, vec2(fCoord.z, fCoord.w));
  vec4 cRB = texture2D(uFilterSource, vec2(fCoord.z, fCoord.y));
  vec4 color = mix(mix(cLB, cRB, pp.x), mix(cLT, cRT, pp.x), pp.y);
    #else
  vec4 color = texture2D(source, vec2(x, texCoord.y));
    #endif
  x = uTexRange.z + texCoord.x * uTexRange.w;
  vec4 opacity = texture2D(source, vec2(x, texCoord.y));
  return vec4(color.rgb, opacity.r);
}
