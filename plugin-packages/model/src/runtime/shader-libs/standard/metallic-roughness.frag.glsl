//
// This fragment shader defines a reference implementation for Physically Based Shading of
// a microfacet surface material defined by a glTF model.
//
// References:
// [1] Real Shading in Unreal Engine 4
//     http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
// [2] Physically Based Shading at Disney
//     http://blog.selfshadow.com/publications/s2012-shading-course/burley/s2012_pbs_disney_brdf_notes_v3.pdf
// [3] README.md - Environment Maps
//     https://github.com/KhronosGroup/glTF-WebGL-PBR/#environment-maps
// [4] "An Inexpensive BRDF Model for Physically based Rendering" by Christophe Schlick
//     https://www.cs.virginia.edu/~jdl/bib/appearance/analytic%20models/schlick94b.pdf
#define FEATURES

#ifndef WEBGL2
#extension GL_OES_standard_derivatives : enable
#endif

#if !defined(WEBGL2) && defined(USE_TEX_LOD)
#extension GL_EXT_shader_texture_lod : enable
#endif


#ifdef USE_HDR
#extension GL_OES_texture_float : enable
#extension GL_OES_texture_float_linear : enable
#endif


#if !defined(WEBGL2) && defined(USE_WBOIT)
#extension GL_EXT_draw_buffers: require
#endif

#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif

#ifdef WEBGL2
    #ifdef USE_WBOIT
        layout(location = 0) out vec4 outFragColor0;
        layout(location = 1) out vec4 outFragColor1;
    #else
        out vec4 outFragColor;
    #endif
#else
    #ifdef USE_WBOIT
        #define outFragColor0 gl_FragData[0]
        #define outFragColor1 gl_FragData[1]
    #else
        #define outFragColor gl_FragColor
    #endif
#endif

#include <webglCompatibility.glsl>
#include <extensions.frag.glsl>
#include <tonemapping.frag.glsl>
#include <textures.vert.glsl>
#include <functions.frag.glsl>
#include <shadowCommon.vert.glsl>
#include <shadow.frag.glsl>

// KHR_lights_punctual extension.
// see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual

struct Light
{
    vec3 direction;
    float range;

    vec3 color;
    float intensity;

    vec3 position;
    float innerConeCos;

    float outerConeCos;
    int type;

    vec2 padding;
};

const int LightType_Directional = 0;
const int LightType_Point = 1;
const int LightType_Spot = 2;
const int LightType_Ambient = 3;

#ifdef USE_PUNCTUAL
uniform Light u_Lights[LIGHT_COUNT];
#endif

#if defined(MATERIAL_SPECULARGLOSSINESS) || defined(MATERIAL_METALLICROUGHNESS)
uniform float u_MetallicFactor;
uniform float u_RoughnessFactor;
uniform vec4 u_BaseColorFactor;
#endif

#ifdef MATERIAL_SPECULARGLOSSINESS
uniform vec3 u_SpecularFactor;
uniform vec4 u_DiffuseFactor;
uniform float u_GlossinessFactor;
#endif

#ifdef ALPHAMODE_MASK
uniform float u_AlphaCutoff;
#endif

#ifdef ADD_FOG
uniform vec4 u_FogColor;
    #ifdef LINEAR_FOG
        uniform float u_FogNear;
        uniform float u_FogFar;
    #endif

    #ifdef EXP_FOG
        uniform float u_FogDensity;
    #endif
#endif

#ifdef PREVIEW_BORDER
uniform vec4 uPreviewColor;
#endif


uniform vec3 u_Camera;

uniform int u_MipCount;

struct MaterialInfo
{
    float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
    vec3 reflectance0;            // full reflectance color (normal incidence angle)

    float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
    vec3 diffuseColor;            // color contribution from diffuse lighting

    vec3 reflectance90;           // reflectance color at grazing angle
    vec3 specularColor;           // color contribution from specular lighting
};

#ifdef ADD_FOG
    vec3 getMixFogColor(vec3 baseColor) {
        vec3 distance = u_Camera - v_Position;
        float fogAmount = 0.0;

        #ifdef LINEAR_FOG
            fogAmount = smoothstep(u_FogNear, u_FogFar, distance[2]);
        #endif

        #ifdef EXP_FOG
            #define LOG2 1.442695
            fogAmount = 1. - exp2(-u_FogDensity * u_FogDensity * distance[2] * distance[2] * LOG2);
            fogAmount = clamp(fogAmount, 0., 1.);
        #endif

        vec3 mixColor = baseColor.rgb + (vec3(u_FogColor)- baseColor.rgb) * fogAmount;
        return mixColor;
    }
#endif

#ifdef IRRADIANCE_COEFFICIENTS
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

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
#ifdef USE_IBL
vec3 getIBLContribution(MaterialInfo materialInfo, vec3 n, vec3 v)
{
    float NdotV = clamp(dot(n, v), 0.0, 1.0);

    float lod = clamp(materialInfo.perceptualRoughness * float(u_MipCount), 0.0, float(u_MipCount));
    vec3 reflection = normalize(reflect(-v, n));

    vec2 brdfSamplePoint = clamp(vec2(NdotV, materialInfo.perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
    // retrieve a scale and bias to F0. See [1], Figure 3
    vec2 brdf = texture2D(u_brdfLUT, brdfSamplePoint).rg;
    //vec4 diffuseSample = textureCube(u_DiffuseEnvSampler, n);
    vec4 diffuseColor = vec4(1.0,0.0,0.0,1.0);
    #ifdef IRRADIANCE_COEFFICIENTS
    vec3 irradiance = getIrradiance( n, u_shCoefficients );
    diffuseColor = vec4(irradiance,1.0);
    #else
    diffuseColor = textureCube(u_DiffuseEnvSampler, n);
    #endif

#ifdef USE_TEX_LOD
    vec4 specularSample = _textureCubeLodEXT(u_SpecularEnvSampler, reflection, lod);
#else
    vec4 specularSample = textureCube(u_SpecularEnvSampler, reflection, lod);
#endif

#ifdef USE_HDR
    // Already linear.
    vec3 diffuseLight = diffuseColor.rgb;
    vec3 specularLight = specularSample.rgb;
#else
    vec3 diffuseLight = SRGBtoLINEAR(diffuseColor).rgb;
    vec3 specularLight = SRGBtoLINEAR(specularSample).rgb;
#endif

    vec3 diffuse = diffuseLight * materialInfo.diffuseColor;
    vec3 specular = specularLight * (materialInfo.specularColor * brdf.x + brdf.y);

    return diffuse * u_IblIntensity[0] + specular * u_IblIntensity[1];
}
#endif

// Lambert lighting
// see https://seblagarde.wordpress.com/2012/01/08/pi-or-not-to-pi-in-game-lighting-equation/
vec3 diffuse(MaterialInfo materialInfo)
{
    return materialInfo.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 specularReflection(MaterialInfo materialInfo, AngularInfo angularInfo)
{
    return materialInfo.reflectance0 + (materialInfo.reflectance90 - materialInfo.reflectance0) * pow(clamp(1.0 - angularInfo.VdotH, 0.0, 1.0), 5.0);
}

// Smith Joint GGX
// Note: Vis = G / (4 * NdotL * NdotV)
// see Eric Heitz. 2014. Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs. Journal of Computer Graphics Techniques, 3
// see Real-Time Rendering. Page 331 to 336.
// see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg)
float visibilityOcclusion(MaterialInfo materialInfo, AngularInfo angularInfo)
{
    float NdotL = angularInfo.NdotL;
    float NdotV = angularInfo.NdotV;
    float alphaRoughnessSq = materialInfo.alphaRoughness * materialInfo.alphaRoughness;

    float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);
    float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - alphaRoughnessSq) + alphaRoughnessSq);

    float GGX = GGXV + GGXL;
    if (GGX > 0.0)
    {
        return 0.5 / GGX;
    }
    return 0.0;
}

// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
float microfacetDistribution(MaterialInfo materialInfo, AngularInfo angularInfo)
{
    float alphaRoughnessSq = materialInfo.alphaRoughness * materialInfo.alphaRoughness;
    float f = (angularInfo.NdotH * alphaRoughnessSq - angularInfo.NdotH) * angularInfo.NdotH + 1.0;
    return alphaRoughnessSq / (M_PI * f * f);
}

vec3 getPointShade(vec3 pointToLight, MaterialInfo materialInfo, vec3 normal, vec3 view)
{
    AngularInfo angularInfo = getAngularInfo(pointToLight, normal, view);

    if (angularInfo.NdotL > 0.0 || angularInfo.NdotV > 0.0)
    {
        // Calculate the shading terms for the microfacet specular shading model
        vec3 F = specularReflection(materialInfo, angularInfo);
        float Vis = visibilityOcclusion(materialInfo, angularInfo);
        float D = microfacetDistribution(materialInfo, angularInfo);

        // Calculation of analytical lighting contribution
        vec3 diffuseContrib = (1.0 - F) * diffuse(materialInfo);
        vec3 specContrib = F * Vis * D;

        // Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
        return angularInfo.NdotL * (diffuseContrib + specContrib);
    }

    return vec3(0.0, 0.0, 0.0);
}

// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_lights_punctual/README.md#range-property
// https://geom.io/bakery/wiki/index.php?title=Point_Light_Attenuation
float getRangeAttenuation(float range, float distance)
{
    if (range <= 0.0)
    {
        // negative range means unlimited
        return 1.0;
    }

    return 1.0 / (pow( 5.0 * distance / range, 2.0) + 1.0);
}

// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_lights_punctual/README.md#inner-and-outer-cone-angles
float getSpotAttenuation(vec3 pointToLight, vec3 spotDirection, float outerConeCos, float innerConeCos)
{
    float actualCos = dot(normalize(spotDirection), normalize(-pointToLight));
    if (actualCos > outerConeCos)
    {
        if (actualCos < innerConeCos)
        {
            return smoothstep(outerConeCos, innerConeCos, actualCos);
        }
        return 1.0;
    }
    return 0.0;
}

vec3 applyDirectionalLight(Light light, MaterialInfo materialInfo, vec3 normal, vec3 view, float shadow)
{
    vec3 pointToLight = -light.direction;
    vec3 shade = getPointShade(pointToLight, materialInfo, normal, view) * shadow;
    return light.intensity * light.color * shade;
}

vec3 applyPointLight(Light light, MaterialInfo materialInfo, vec3 normal, vec3 view)
{
    vec3 pointToLight = light.position - v_Position;
    float distance = length(pointToLight);
    float attenuation = getRangeAttenuation(light.range, distance);
    vec3 shade = getPointShade(pointToLight, materialInfo, normal, view);
    return light.color * shade * attenuation * light.intensity;
}

vec3 applySpotLight(Light light, MaterialInfo materialInfo, vec3 normal, vec3 view, float shadow)
{
    vec3 pointToLight = light.position - v_Position;
    float distance = length(pointToLight);
    float rangeAttenuation = getRangeAttenuation(light.range, distance);
    float spotAttenuation = getSpotAttenuation(pointToLight, light.direction, light.outerConeCos, light.innerConeCos);
    vec3 shade = getPointShade(pointToLight, materialInfo, normal, view) * shadow;
    return rangeAttenuation * spotAttenuation * light.intensity * light.color * shade;
}

vec3 applyAmbientLight(Light light, MaterialInfo materialInfo)
{
    return light.intensity * light.color * diffuse(materialInfo);
}

float weight(float z, float a) {
    return clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3);
}

void writeFragmentColor(vec4 fragColor)
{
#if !defined(ALPHAMODE_OPAQUE) && defined(USE_WBOIT)
    float w = weight(gl_FragCoord.z, fragColor.a);
    fragColor.rgb *= fragColor.a;
    outFragColor0 = vec4(fragColor.rgb * w, fragColor.a);
    outFragColor1 = vec4(fragColor.a * w);
#else
    outFragColor = fragColor;
#endif
}

void main()
{
    // Metallic and Roughness material properties are packed together
    // In glTF, these factors can be specified by fixed scalar values
    // or from a metallic-roughness map
    float perceptualRoughness = 0.0;
    float metallic = 0.0;
    vec4 baseColor = vec4(0.0, 0.0, 0.0, 1.0);
    vec3 diffuseColor = vec3(0.0);
    vec3 specularColor= vec3(0.0);
    vec3 f0 = vec3(0.04);

#ifdef PREVIEW_BORDER
    writeFragmentColor(uPreviewColor);
    return;
#endif

#ifdef MATERIAL_SPECULARGLOSSINESS

#ifdef HAS_SPECULAR_GLOSSINESS_MAP
    vec4 sgSample = SRGBtoLINEAR(texture2D(u_SpecularGlossinessSampler, getSpecularGlossinessUV()));
    perceptualRoughness = (1.0 - sgSample.a * u_GlossinessFactor); // glossiness to roughness
    f0 = sgSample.rgb * u_SpecularFactor; // specular
#else
    f0 = u_SpecularFactor;
    perceptualRoughness = 1.0 - u_GlossinessFactor;
#endif // ! HAS_SPECULAR_GLOSSINESS_MAP

#ifdef HAS_DIFFUSE_MAP
    baseColor = SRGBtoLINEAR(texture2D(u_DiffuseSampler, getDiffuseUV())) * u_DiffuseFactor;
#else
    baseColor = SRGBtoLINEAR(u_DiffuseFactor);
#endif // !HAS_DIFFUSE_MAP

    baseColor *= getVertexColor();

    // f0 = specular
    specularColor = f0;
    float oneMinusSpecularStrength = 1.0 - max(max(f0.r, f0.g), f0.b);
    diffuseColor = baseColor.rgb * oneMinusSpecularStrength;

#ifdef DEBUG_METALLIC
    // do conversion between metallic M-R and S-G metallic
    metallic = solveMetallic(baseColor.rgb, specularColor, oneMinusSpecularStrength);
#endif // ! DEBUG_METALLIC

#endif // ! MATERIAL_SPECULARGLOSSINESS

#ifdef MATERIAL_METALLICROUGHNESS

#ifdef HAS_METALLIC_ROUGHNESS_MAP
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    vec4 mrSample = texture2D(u_MetallicRoughnessSampler, getMetallicRoughnessUV());
    perceptualRoughness = mrSample.g * u_RoughnessFactor;
    /*注： 适配unity的效果，unity中对metallic使用orm贴图时，roughness仍为数值
    perceptualRoughness = u_RoughnessFactor;*/
    metallic = mrSample.b * u_MetallicFactor;
#else
    metallic = u_MetallicFactor;
    perceptualRoughness = u_RoughnessFactor;
#endif

    // The albedo may be defined from a base texture or a flat color
#ifdef HAS_BASE_COLOR_MAP
    baseColor = SRGBtoLINEAR(texture2D(u_BaseColorSampler, getBaseColorUV())) * u_BaseColorFactor;
#else
    baseColor = SRGBtoLINEAR(u_BaseColorFactor);
#endif

    baseColor *= getVertexColor();

    diffuseColor = baseColor.rgb * (vec3(1.0) - f0) * (1.0 - metallic);

    specularColor = mix(f0, baseColor.rgb, metallic);

#endif // ! MATERIAL_METALLICROUGHNESS

#ifdef ALPHAMODE_MASK
    if(baseColor.a < u_AlphaCutoff)
    {
        discard;
    }
    baseColor.a = 1.0;
#endif

#ifdef ALPHAMODE_OPAQUE
    baseColor.a = 1.0;
#endif

#ifdef MATERIAL_UNLIT
    #ifndef DEBUG_OUTPUT // no debug
        #ifdef ADD_FOG
            vec3 mixColor = getMixFogColor(baseColor.rgb);
            vec4 fragColorUnlit = vec4(LINEARtoSRGB(mixColor) * baseColor.a, baseColor.a);
        #else
            vec4 fragColorUnlit = vec4(LINEARtoSRGB(baseColor.rgb) * baseColor.a, baseColor.a);
        #endif
        writeFragmentColor(fragColorUnlit);
    #else
        #ifdef DEBUG_UV
            outFragColor.rgb = vec3(getDebugUVColor(getBaseColorUV(), getNormal()));
        #endif

        #ifdef DEBUG_METALLIC
            outFragColor.rgb = vec3(metallic);
        #endif

        #ifdef DEBUG_ROUGHNESS
            outFragColor.rgb = vec3(perceptualRoughness);
        #endif

        #ifdef DEBUG_NORMAL
            outFragColor.rgb = getNormal() * 0.5 + 0.5;
        #endif

        #ifdef DEBUG_BASECOLOR
            outFragColor.rgb = LINEARtoSRGB(baseColor.rgb);
        #endif

        #ifdef DEBUG_OCCLUSION
            outFragColor.rgb = vec3(1.0);
        #endif

        #ifdef DEBUG_EMISSIVE
            outFragColor.rgb = vec3(0.0);
        #endif

        #ifdef DEBUG_ALPHA
            outFragColor.rgb = vec3(baseColor.a);
        #endif

        outFragColor.a = 1.0;
    #endif
    return;
#endif

    metallic = clamp(metallic, 0.0, 1.0);

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness [2].
    float alphaRoughness = perceptualRoughness * perceptualRoughness;

    vec3 normal = getNormal();

    #ifdef USE_SPECULAR_AA
        // 法线变化非常剧烈时，AARoughnessFactor 值很大，法线变化平缓时，AARoughnessFactor 趋于 0
        float AARoughnessFactor = getAARoughnessFactor(normal);
        perceptualRoughness += AARoughnessFactor;
        alphaRoughness += AARoughnessFactor;
    #endif

    // 确保粗糙度不为 0，避免发生高光消失的情况
    perceptualRoughness = clamp(perceptualRoughness, 0.04, 1.0);
    alphaRoughness = clamp(alphaRoughness, 0.04, 1.0);

    // Compute reflectance.
    float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

    vec3 specularEnvironmentR0 = specularColor.rgb;
    // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
    vec3 specularEnvironmentR90 = vec3(clamp(reflectance * 50.0, 0.0, 1.0));

    MaterialInfo materialInfo = MaterialInfo(
        perceptualRoughness,
        specularEnvironmentR0,
        alphaRoughness,
        diffuseColor,
        specularEnvironmentR90,
        specularColor
    );

    // LIGHTING

    vec3 color = vec3(0.0, 0.0, 0.0);
    vec3 view = normalize(u_Camera - v_Position);

    float shadow = 1.0;
    #ifdef USE_SHADOW_MAPPING
        shadow = getShadowContribution();
    #endif

#ifdef USE_PUNCTUAL
    for (int i = 0; i < LIGHT_COUNT; ++i)
    {
        Light light = u_Lights[i];
        if (light.type == LightType_Directional)
        {
            color += applyDirectionalLight(light, materialInfo, normal, view, shadow);
        }
        else if (light.type == LightType_Point)
        {
            color += applyPointLight(light, materialInfo, normal, view);
        }
        else if (light.type == LightType_Spot)
        {
            color += applySpotLight(light, materialInfo, normal, view, shadow);
        }
        else if (light.type == LightType_Ambient)
        {
 			color += applyAmbientLight(light, materialInfo);
 		}
    }
#endif

    // Calculate lighting contribution from image based lighting source (IBL)
#ifdef USE_IBL
    color += getIBLContribution(materialInfo, normal, view);
#endif

    float ao = 1.0;
    // Apply optional PBR terms for additional (optional) shading
#ifdef HAS_OCCLUSION_MAP
    /* unity exporter orm 适配的写法
    ao = texture2D(u_OcclusionSampler,  getOcclusionUV()).g;*/
    ao = texture2D(u_OcclusionSampler,  getOcclusionUV()).r;
    color = mix(color, color * ao, u_OcclusionStrength);
#endif

    vec3 emissive = vec3(0);
/*#ifdef HAS_EMISSIVE_MAP
    emissive = SRGBtoLINEAR(texture2D(u_EmissiveSampler, getEmissiveUV())).rgb * u_EmissiveFactor.rgb;
    color += emissive;
#endif

#ifdef HAS_EMISSIVE
    color += u_EmissiveFactor.rgb;
#endif*/

#ifndef DEBUG_OUTPUT // no debug
   // regular shading
    #ifdef ADD_FOG
        // 处理曝光
        vec4 toneMapColor = SRGBtoLINEAR(vec4(toneMap(color), baseColor.a));
        // 最终颜色处理完成后再添加雾
        color = getMixFogColor(toneMapColor.rgb);
        vec4 fragColorOut = vec4(LINEARtoSRGB(color.rgb) * baseColor.a, baseColor.a);
    #else
        color = toneMap(color) * baseColor.a;
        // emmisive要放在tone mapping之后，否则会导致光影过弱
        #ifdef HAS_EMISSIVE
          color += u_EmissiveFactor.rgb;
        #endif
        #ifdef HAS_EMISSIVE_MAP
          emissive = SRGBtoLINEAR(texture2D(u_EmissiveSampler, getEmissiveUV())).rgb * u_EmissiveFactor.rgb;
          color += emissive;
        #endif
        vec4 fragColorOut = vec4(color, baseColor.a);
    #endif
    writeFragmentColor(fragColorOut);
#else // debug output

    #ifdef DEBUG_UV
        outFragColor.rgb = vec3(getDebugUVColor(getBaseColorUV(), normal));
    #endif

    #ifdef DEBUG_METALLIC
        outFragColor.rgb = vec3(metallic);
    #endif

    #ifdef DEBUG_ROUGHNESS
        outFragColor.rgb = vec3(perceptualRoughness);
    #endif

    #ifdef DEBUG_NORMAL
        outFragColor.rgb = normal * 0.5 + 0.5;
    #endif

    #ifdef DEBUG_BASECOLOR
        outFragColor.rgb = LINEARtoSRGB(baseColor.rgb);
    #endif

    #ifdef DEBUG_OCCLUSION
        #ifdef HAS_OCCLUSION_MAP
            outFragColor.rgb = vec3(mix(1.0, ao, u_OcclusionStrength));
        #else
            outFragColor.rgb = vec3(1.0);
        #endif
    #endif

    #ifdef DEBUG_EMISSIVE
        // fetch emissive data
        #ifdef HAS_EMISSIVE
            emissive = u_EmissiveFactor.rgb;
        #endif

        #ifdef HAS_EMISSIVE_MAP
            emissive = SRGBtoLINEAR(texture2D(u_EmissiveSampler, getEmissiveUV())).rgb * u_EmissiveFactor.rgb;
        #endif

        outFragColor.rgb = LINEARtoSRGB(emissive);
    #endif

    #ifdef DEBUG_F0
        outFragColor.rgb = vec3(f0);
    #endif

    #ifdef DEBUG_ALPHA
        outFragColor.rgb = vec3(baseColor.a);
    #endif

    outFragColor.a = 1.0;

#endif // !DEBUG_OUTPUT
}