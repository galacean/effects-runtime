

#define FEATURES

#if !defined(WEBGL2) && defined(USE_TEX_LOD)
#extension GL_EXT_shader_texture_lod : enable
#endif

#if !defined(WEBGL2)
#extension GL_OES_standard_derivatives : enable
#endif

precision highp float;

#include <webglCompatibility.glsl>
#include <extensions.frag.glsl>


#ifdef WEBGL2
    out vec4 outFragColor;
#else
    #define outFragColor gl_FragColor
#endif


uniform sampler2D u_brdfLUT;
uniform vec2 u_IblIntensity;

uniform int u_MipCount;
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;

fsIn vec3 v_CameraDir;


#ifdef IRRADIANCE_COEFFICIENTS
struct SHCoefficients {
    vec3 l00, l1m1, l10, l11, l2m2, l2m1, l20, l21, l22;
};
uniform SHCoefficients u_shCoefficients;

vec3 getIrradiance( vec3 norm, SHCoefficients c ) {
    float x = norm.x;
    float y = norm.y;
    float z = norm.z;
    float c1 = 0.429043;
    float c2 = 0.511664;
    float c3 = 0.743125;
    float c4 = 0.886227;
    float c5 = 0.247708;
    vec3 irradiance =
    c1 * c.l22 * (x * x - y * y) +
    c3 * c.l20 * (z * z) +
    c4 * c.l00 -
    c5 * c.l20 +
    2.0 * c1 * (c.l2m2 * x * y + c.l21 * x * z + c.l2m1 * y * z) +
    2.0 * c2 * (c.l11 * x + c.l1m1 * y + c.l10 * z);
    return irradiance;
}
#endif


vec3 getIBLContribution(vec3 n, vec3 v)
{
    const float metallic = 0.9;
    const float perceptualRoughness = 0.1;
    const vec4 baseColor = vec4(1.0);
    const vec3 f0 = vec3(0.04);
    const vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0) * (1.0 - metallic);
    const vec3 specularColor = mix(f0, baseColor.rgb, metallic);

    float NdotV = clamp(dot(n, v), 0.0, 1.0);

    float lod = clamp(perceptualRoughness * float(u_MipCount), 0.0, float(u_MipCount));
    vec3 reflection = normalize(reflect(-v, n));

    vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
    // retrieve a scale and bias to F0. See [1], Figure 3
    vec2 brdf = texture2D(u_brdfLUT, brdfSamplePoint).rg;
    vec4 diffuseSample = vec4(1.0,0.0,0.0,1.0);
    #ifdef IRRADIANCE_COEFFICIENTS
    vec3 irradiance = getIrradiance( n, u_shCoefficients );
    diffuseSample = vec4(irradiance,1.0);
    #else
    diffuseSample = textureCube(u_DiffuseEnvSampler, n);
    #endif

    #ifdef USE_TEX_LOD
        vec4 specularSample = _textureCubeLodEXT(u_SpecularEnvSampler, reflection, lod);
    #else
        vec4 specularSample = textureCube(u_SpecularEnvSampler, reflection, lod);
    #endif

    vec3 diffuseLight = diffuseSample.rgb;
    vec3 specularLight = specularSample.rgb;

    vec3 diffuse = diffuseLight * diffuseColor;
    vec3 specular = specularLight * (specularColor * brdf.x + brdf.y);

    return diffuse * u_IblIntensity[0] + specular * u_IblIntensity[1];
}

void main(){
    vec3 dir = normalize(v_CameraDir);
    outFragColor = vec4(getIBLContribution(dir, dir), 1.0);
}
