#version 300 es
precision mediump float;
#define SHADER_VERTEX 1
#import "./compatible.vert.glsl";
#import "./value.glsl";
in vec4 aPos;
in vec3 aDir;
in vec3 aInfo;//lifetime section side
in vec4 aColor;
in float aTime;

#ifdef ATTR_TRAIL_START
in float aTrailStart;
#else
uniform float uTrailStart[64];
in float aTrailStartIndex;
#endif

uniform mat4 effects_MatrixInvV;
uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;
uniform vec4 uTextureMap;

uniform float uTime;
uniform vec4 uParams;//??? sectionCount
uniform vec4 uColorParams;//mask opacityOverLifetime
uniform vec4 uOpacityOverLifetimeValue;

uniform vec4 uWidthOverTrail;
#ifdef COLOR_OVER_TRAIL
uniform sampler2D uColorOverTrail;
#endif

#ifdef COLOR_OVER_LIFETIME
uniform sampler2D uColorOverLifetime;
#endif
out float vLife;
out vec2 vTexCoord;
out vec4 vColor;

#ifdef ENV_EDITOR
uniform vec4 uEditorTransform;
#endif

void main() {
  vec4 _pa = effects_MatrixVP * vec4(aPos.xyz, 1.);
  vec4 _pb = effects_MatrixVP * vec4(aPos.xyz + aDir, 1.);
  vec2 dir = normalize(_pb.xy / _pb.w - _pa.xy / _pa.w);
  vec2 screen_xy = vec2(-dir.y, dir.x);
  vec4 pos = effects_ObjectToWorld * vec4(aPos.xyz, 1.);

    #ifdef ATTR_TRAIL_START
  float ts = aTrailStart;
    #else
  float ts = uTrailStart[int(aTrailStartIndex)];
    #endif

  float trail = (ts - aInfo.y) / uParams.y;

  float width = aPos.w * getValueFromTime(trail, uWidthOverTrail) / max(abs(screen_xy.x), abs(screen_xy.y));
  pos.xyz += (effects_MatrixInvV[0].xyz * screen_xy.x + effects_MatrixInvV[1].xyz * screen_xy.y) * width;

  float time = min((uTime - aTime) / aInfo.x, 1.0);

  gl_Position = effects_MatrixVP * pos;

  vColor = aColor;

    #ifdef COLOR_OVER_LIFETIME
    #ifdef ENABLE_VERTEX_TEXTURE
  vColor *= texture2D(uColorOverLifetime, vec2(time, 0.));
    #endif
    #endif

    #ifdef COLOR_OVER_TRAIL
  vColor *= texture2D(uColorOverTrail, vec2(trail, 0.));
    #endif

  vColor.a *= clamp(getValueFromTime(time, uOpacityOverLifetimeValue), 0., 1.);

  vLife = time;
  vTexCoord = uTextureMap.xy + vec2(trail, aInfo.z) * uTextureMap.zw;
  vSeed = aSeed;

    #ifdef ENV_EDITOR
  gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
    #endif
}
