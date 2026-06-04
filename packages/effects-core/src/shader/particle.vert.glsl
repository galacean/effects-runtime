#version 100
precision mediump float;
#define SHADER_VERTEX 1
#define PATICLE_SHADER 1

attribute float aSeed;
varying float vSeed;

attribute vec3 aPos;
attribute vec4 aOffset;//texcoord.xy time:start duration
attribute vec4 aColor;
attribute vec3 aDirX;
attribute vec3 aDirY;

attribute vec3 aTranslation;
attribute vec3 aRotation0;
attribute vec3 aRotation1;
attribute vec3 aRotation2;
attribute vec2 aSize;
attribute vec4 aColorScale;

#ifdef USE_SPRITE
attribute vec3 aSprite;//start duration cycles
uniform vec4 uSprite;//col row totalFrame blend
struct UVDetail {
  vec2 uv0;
  vec3 uv1;
};
UVDetail getSpriteUV(vec2 uv, float lifeTime);
varying vec4 vTexCoordBlend;
#endif

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixV;
uniform mat4 effects_MatrixVP;

uniform vec4 uParams;//time duration endBehavior

varying float vLife;
varying vec4 vColor;
varying vec2 vTexCoord;

    #ifdef USE_SPRITE

UVDetail getSpriteUV(vec2 uv, float lifeTime) {
  float t = fract(clamp((lifeTime - aSprite.x) / aSprite.y, 0.0, 1.) * aSprite.z);
  float frame = uSprite.z * t;
  float frameIndex = max(ceil(frame) - 1., 0.);
  float row = floor((frameIndex + 0.1) / uSprite.x);
  float col = frameIndex - row * uSprite.x;

  vec2 retUV = (vec2(col, row) + uv) / uSprite.xy;
  UVDetail ret;
  if(uSprite.w > 0.) {
    float blend = frame - frameIndex;
    float frameIndex1 = min(ceil(frame), uSprite.z - 1.);
    float row1 = floor((frameIndex1 + 0.1) / uSprite.x);
    float col1 = frameIndex1 - row1 * uSprite.x;
    vec2 coord = (vec2(col1, row1) + uv) / uSprite.xy - retUV;
    ret.uv1 = vec3(coord.x, 1. - coord.y, blend);
  }
  ret.uv0 = vec2(retUV.x, 1. - retUV.y);
  return ret;
}
    #endif

void main() {
  float time = aOffset.z;
  float dur = aOffset.w;
  if(time < 0. || time > dur) {
    gl_Position = vec4(-3., -3., -3., 1.);
  } else {
    float life = clamp(time / dur, 0.0, 1.0);
    vLife = life;

        #ifdef USE_SPRITE
    UVDetail uvD = getSpriteUV(aOffset.xy, time);
    vTexCoord = uvD.uv0;
    vTexCoordBlend = vec4(uvD.uv1, uSprite.w);
        #else
    vTexCoord = aOffset.xy;
        #endif

    vColor = aColor * aColorScale;

    mat3 aRotation = mat3(aRotation0, aRotation1, aRotation2);
    vec3 point = aRotation * (aDirX * aSize.x + aDirY * aSize.y);
    vec4 pos = vec4(aPos + aTranslation, 1.0);

        #if RENDER_MODE == 1
    pos.xyz += point;
    pos = effects_ObjectToWorld * pos;
        #elif RENDER_MODE == 3
    pos = effects_ObjectToWorld * pos;
    pos.xyz += effects_MatrixV[0].xyz * point.x + effects_MatrixV[2].xyz * point.y;
        #elif RENDER_MODE == 2
    pos = effects_ObjectToWorld * pos;
    pos.xy += point.xy;
        #elif RENDER_MODE == 0
    pos = effects_ObjectToWorld * pos;
    pos.xyz += effects_MatrixV[0].xyz * point.x + effects_MatrixV[1].xyz * point.y;
        #endif
    gl_Position = effects_MatrixVP * pos;
    vSeed = aSeed;

    gl_PointSize = 6.0;
  }
}
