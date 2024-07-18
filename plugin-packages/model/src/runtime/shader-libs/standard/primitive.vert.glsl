precision highp float;

#define FEATURES

#include <webgl-compatibility.glsl>
#include <animation.vert.glsl>

vsIn vec4 aPos;
vsOut vec3 v_Position;

#ifdef HAS_NORMALS
vsIn vec4 aNormal;
#endif

#ifdef HAS_TANGENTS
vsIn vec4 aTangent;
#endif

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
vsOut mat3 v_TBN;
#else
vsOut vec3 v_Normal;
#endif
#endif

#ifdef HAS_UV_SET1
vsIn vec2 aUV;
#endif

#ifdef HAS_UV_SET2
vsIn vec2 aUV2;
#endif

vsOut vec2 v_UVCoord1;

#ifdef HAS_UV_SET2
vsOut vec2 v_UVCoord2;
#endif

#ifdef HAS_VERTEX_COLOR_VEC3
vsIn vec3 aColor;
vsOut vec3 v_Color;
#endif

#ifdef HAS_VERTEX_COLOR_VEC4
vsIn vec4 aColor;
vsOut vec4 v_Color;
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
vsOut vec4 v_PositionLightSpace;
vsOut vec4 v_dPositionLightSpace;
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
