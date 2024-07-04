fsIn vec2 v_UVCoord1;

#ifdef HAS_UV_SET2
fsIn vec2 v_UVCoord2;
#endif

// General Material
#ifdef HAS_NORMAL_MAP
uniform sampler2D _NormalSampler;
uniform float _NormalScale;
uniform int _NormalUVSet;
uniform mat3 _NormalUVTransform;
#endif

#ifdef HAS_EMISSIVE_MAP
uniform sampler2D _EmissiveSampler;
uniform int _EmissiveUVSet;
uniform vec4 _EmissiveFactor;
uniform float _EmissiveIntensity;
uniform mat3 _EmissiveUVTransform;
#endif

#ifdef HAS_EMISSIVE
uniform vec4 _EmissiveFactor;
uniform float _EmissiveIntensity;
#endif

#ifdef HAS_OCCLUSION_MAP
uniform sampler2D _OcclusionSampler;
uniform int _OcclusionUVSet;
uniform float _OcclusionStrength;
uniform mat3 _OcclusionUVTransform;
#endif

// Metallic Roughness Material
#ifdef HAS_BASE_COLOR_MAP
uniform sampler2D _BaseColorSampler;
uniform int _BaseColorUVSet;
uniform mat3 _BaseColorUVTransform;
#endif

#ifdef HAS_METALLIC_ROUGHNESS_MAP
uniform sampler2D _MetallicRoughnessSampler;
uniform int _MetallicRoughnessUVSet;
uniform mat3 _MetallicRoughnessUVTransform;
#endif

// Specular Glossiness Material
#ifdef HAS_DIFFUSE_MAP
uniform sampler2D _DiffuseSampler;
uniform int _DiffuseUVSet;
uniform mat3 _DiffuseUVTransform;
#endif

#ifdef HAS_SPECULAR_GLOSSINESS_MAP
uniform sampler2D _SpecularGlossinessSampler;
uniform int _SpecularGlossinessUVSet;
uniform mat3 _SpecularGlossinessUVTransform;
#endif

// IBL
#ifdef USE_IBL
uniform samplerCube _DiffuseEnvSampler;
uniform samplerCube _SpecularEnvSampler;
uniform sampler2D _brdfLUT;
uniform vec2 _IblIntensity;
#endif

#ifdef IRRADIANCE_COEFFICIENTS
struct SHCoefficients {
    vec3 l00, l1m1, l10, l11, l2m2, l2m1, l20, l21, l22;
};
uniform SHCoefficients _shCoefficients;
#endif

#ifdef USE_SHADOW_MAPPING
uniform sampler2D _ShadowSampler;
#endif

vec2 getNormalUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_NORMAL_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _NormalUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_NORMAL_UV_TRANSFORM
    uv *= _NormalUVTransform;
    #endif
#endif
    return uv.xy;
}

vec2 getEmissiveUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_EMISSIVE_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _EmissiveUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_EMISSIVE_UV_TRANSFORM
    uv *= _EmissiveUVTransform;
    #endif
#endif

    return uv.xy;
}

vec2 getOcclusionUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_OCCLUSION_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _OcclusionUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_OCCLUSION_UV_TRANSFORM
    uv *= _OcclusionUVTransform;
    #endif
#endif
    return uv.xy;
}

vec2 getBaseColorUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_BASE_COLOR_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _BaseColorUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_BASECOLOR_UV_TRANSFORM
    uv *= _BaseColorUVTransform;
    #endif
#endif
    return uv.xy;
}

vec2 getMetallicRoughnessUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_METALLIC_ROUGHNESS_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _MetallicRoughnessUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_METALLICROUGHNESS_UV_TRANSFORM
    uv *= _MetallicRoughnessUVTransform;
    #endif
#endif
    return uv.xy;
}

vec2 getSpecularGlossinessUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_SPECULAR_GLOSSINESS_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _SpecularGlossinessUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_SPECULARGLOSSINESS_UV_TRANSFORM
    uv *= _SpecularGlossinessUVTransform;
    #endif
#endif
    return uv.xy;
}

vec2 getDiffuseUV()
{
    vec3 uv = vec3(v_UVCoord1, 1.0);
#ifdef HAS_DIFFUSE_MAP
    #ifdef HAS_UV_SET2
    uv.xy = _DiffuseUVSet < 1 ? v_UVCoord1 : v_UVCoord2;
    #endif
    #ifdef HAS_DIFFUSE_UV_TRANSFORM
    uv *= _DiffuseUVTransform;
    #endif
#endif
    return uv.xy;
}