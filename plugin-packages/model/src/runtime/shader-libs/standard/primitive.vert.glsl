precision highp float;

#define FEATURES

#include <animation.vert.glsl>

attribute vec4 aPos;
varying vec3 v_Position;

#ifdef HAS_NORMALS
attribute vec4 aNormal;
#endif

#ifdef HAS_TANGENTS
attribute vec4 aTangent;
#endif

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
varying mat3 v_TBN;
#else
varying vec3 v_Normal;
#endif
#endif

#ifdef HAS_UV_SET1
attribute vec2 aUV;
#endif

#ifdef HAS_UV_SET2
attribute vec2 aUV2;
#endif

varying vec2 v_UVCoord1;

#ifdef HAS_UV_SET2
varying vec2 v_UVCoord2;
#endif

#ifdef HAS_VERTEX_COLOR_VEC3
attribute vec3 aColor;
varying vec3 v_Color;
#endif

#ifdef HAS_VERTEX_COLOR_VEC4
attribute vec4 aColor;
varying vec4 v_Color;
#endif

uniform mat4 effects_MatrixVP;
uniform mat4 effects_ObjectToWorld;
uniform mat4 _NormalMatrix;

#ifdef EDITOR_TRANSFORM
uniform vec4 uEditorTransform;
#endif

#ifdef USE_SHADOW_MAPPING
uniform mat4 _LightViewProjectionMatrix;
uniform float _DeltaSceneSize;
varying vec4 v_PositionLightSpace;
varying vec4 v_dPositionLightSpace;
#endif

vec4 getPosition()
{
    vec4 pos = vec4(aPos.xyz, 1.0);

#ifdef USE_MORPHING
    pos += getTargetPosition();
#endif

#ifdef USE_SKINNING
    pos = getSkinningMatrix() * pos;
#endif

    return pos;
}

#ifdef HAS_NORMALS
vec4 getNormal()
{
    vec4 normal = aNormal;

#ifdef USE_MORPHING
    normal += getTargetNormal();
#endif

#ifdef USE_SKINNING
    normal = getSkinningNormalMatrix() * normal;
#endif

    return normalize(normal);
}
#endif

#ifdef HAS_TANGENTS
vec4 getTangent()
{
    vec4 tangent = aTangent;

#ifdef USE_MORPHING
    tangent += getTargetTangent();
#endif

#ifdef USE_SKINNING
    tangent = getSkinningMatrix() * tangent;
#endif

    return normalize(tangent);
}
#endif

void main()
{
    vec4 pos = effects_ObjectToWorld * getPosition();
    v_Position = vec3(pos.xyz) / pos.w;

    #ifdef HAS_NORMALS
    #ifdef HAS_TANGENTS
    vec4 tangent = getTangent();
    vec3 normalW = normalize(vec3(_NormalMatrix * vec4(getNormal().xyz, 0.0)));
    vec3 tangentW = normalize(vec3(effects_ObjectToWorld * vec4(tangent.xyz, 0.0)));
    vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
    v_TBN = mat3(tangentW, bitangentW, normalW);
    #else // !HAS_TANGENTS
    v_Normal = normalize(vec3(_NormalMatrix * vec4(getNormal().xyz, 0.0)));
    #endif
    #endif // !HAS_NORMALS

    v_UVCoord1 = vec2(0.0, 0.0);

    #ifdef HAS_UV_SET1
    v_UVCoord1 = aUV;
    #endif

    #ifdef HAS_UV_SET2
    v_UVCoord2 = aUV2;
    #endif

    #if defined(HAS_VERTEX_COLOR_VEC3) || defined(HAS_VERTEX_COLOR_VEC4)
    v_Color = aColor;
    #endif

    #ifdef USE_SHADOW_MAPPING
    v_PositionLightSpace = _LightViewProjectionMatrix * pos;
    vec3 dpos = vec3(_DeltaSceneSize);
    v_dPositionLightSpace = _LightViewProjectionMatrix * (pos + vec4(dpos, 0));
    #endif

    gl_Position = effects_MatrixVP * pos;

    #ifdef EDITOR_TRANSFORM
        gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
    #endif
}
