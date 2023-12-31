precision highp float;

#define FEATURES

#include <webglCompatibility.glsl>
#include <animation.vert.glsl>

vsIn vec4 a_Position;
vsOut vec3 v_Position;

#ifdef HAS_NORMALS
vsIn vec4 a_Normal;
#endif

#ifdef HAS_TANGENTS
vsIn vec4 a_Tangent;
#endif

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
vsOut mat3 v_TBN;
#else
vsOut vec3 v_Normal;
#endif
#endif

#ifdef HAS_UV_SET1
vsIn vec2 a_UV1;
#endif

#ifdef HAS_UV_SET2
vsIn vec2 a_UV2;
#endif

vsOut vec2 v_UVCoord1;

#ifdef HAS_UV_SET2
vsOut vec2 v_UVCoord2;
#endif

#ifdef HAS_VERTEX_COLOR_VEC3
vsIn vec3 a_Color;
vsOut vec3 v_Color;
#endif

#ifdef HAS_VERTEX_COLOR_VEC4
vsIn vec4 a_Color;
vsOut vec4 v_Color;
#endif

uniform mat4 u_ViewProjectionMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;

#ifdef EDITOR_TRANSFORM
uniform vec4 uEditorTransform;
#endif

#ifdef USE_SHADOW_MAPPING
uniform mat4 u_LightViewProjectionMatrix;
uniform float u_DeltaSceneSize;
vsOut vec4 v_PositionLightSpace;
vsOut vec4 v_dPositionLightSpace;
#endif

vec4 getPosition()
{
    vec4 pos = vec4(a_Position.xyz, 1.0);

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
    vec4 normal = a_Normal;

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
    vec4 tangent = a_Tangent;

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
    vec4 pos = u_ModelMatrix * getPosition();
    v_Position = vec3(pos.xyz) / pos.w;

    #ifdef HAS_NORMALS
    #ifdef HAS_TANGENTS
    vec4 tangent = getTangent();
    vec3 normalW = normalize(vec3(u_NormalMatrix * vec4(getNormal().xyz, 0.0)));
    vec3 tangentW = normalize(vec3(u_ModelMatrix * vec4(tangent.xyz, 0.0)));
    vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
    v_TBN = mat3(tangentW, bitangentW, normalW);
    #else // !HAS_TANGENTS
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(getNormal().xyz, 0.0)));
    #endif
    #endif // !HAS_NORMALS

    v_UVCoord1 = vec2(0.0, 0.0);

    #ifdef HAS_UV_SET1
    v_UVCoord1 = a_UV1;
    #endif

    #ifdef HAS_UV_SET2
    v_UVCoord2 = a_UV2;
    #endif

    #if defined(HAS_VERTEX_COLOR_VEC3) || defined(HAS_VERTEX_COLOR_VEC4)
    v_Color = a_Color;
    #endif

    #ifdef USE_SHADOW_MAPPING
    v_PositionLightSpace = u_LightViewProjectionMatrix * pos;
    vec3 dpos = vec3(u_DeltaSceneSize);
    v_dPositionLightSpace = u_LightViewProjectionMatrix * (pos + vec4(dpos, 0));
    #endif

    gl_Position = u_ViewProjectionMatrix * pos;

    #ifdef EDITOR_TRANSFORM
        gl_Position = vec4(gl_Position.xy * uEditorTransform.xy + uEditorTransform.zw * gl_Position.w, gl_Position.zw);
    #endif
}