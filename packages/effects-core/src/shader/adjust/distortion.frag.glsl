uniform vec4 uWaveParams;

#ifdef PATICLE_SHADER
in vec4 vWaveParams;
#else
uniform vec4 vWaveParams;
#endif

vec4 filterMain(vec2 texCoord, sampler2D tex) {
  vec2 vp = texCoord - uWaveParams.xy;
  float xx = dot(vp, uWaveParams.zw);
  float d = sin(vWaveParams.x * xx + vWaveParams.y) * vWaveParams.z;
  vec2 up = vec2(-uWaveParams.w, uWaveParams.z) * d;
  return texture2D(tex, clamp(texCoord + up, 0., 1.));
}
