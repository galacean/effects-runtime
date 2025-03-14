export default `
//_ALPHATEST_ON
//_RECEIVE_SHADOWS_OFF
// _ENV_SPECULAR_ON
// _ENV_DIFFUSE_ON
//_ADDITIONAL_LIGHTS_ON
//_ADDITIONAL_LIGHTS_VERTEX_ON
// _EYE


//_MATCAP


// ----- Surface -----
//_NORMALMAP
//_LIGHTMAP2_ON
uniform vec4  _BaseMap_ST;// BumpMap、LightMap1、LightMap2、EmissionTex 统一使用 _BaseMap_ST
uniform vec4 _BaseColor;

#ifdef _NORMALMAP
uniform sampler2D _BumpMap;
uniform float _BumpScale;
#endif

uniform sampler2D _LightMap1;
#ifdef _LIGHTMAP2_ON
uniform sampler2D _LightMap2;
#endif

uniform float _Occlusion;
uniform float _Roughness;
uniform float _Metallic;

// ----- Diffuse -----
//_DIFFUSE_RAMP
//_DIFFUSE_LAMBERT
uniform float _UseHalfLambert;
uniform float _UseRadianceOcclusion;

#ifdef _DIFFUSE_LAMBERT
uniform vec4 _HighColor;
uniform vec4 _DarkColor;
#endif

#ifdef _DIFFUSE_RAMP
uniform sampler2D _DiffuseRampMap;
uniform float _RampMapUOffset;
uniform float _RampMapVOffset;
#endif

// ----- Specular -----
//_STYLIZED
//_BLINNPHONG
//_GGX
//_KAJIYAHAIR
//_SPECULAR_AA_ON
//_SPECULAR_MASK_ON

#if defined(_STYLIZED) || defined(_BLINNPHONG) || defined(_GGX) || defined(_KAJIYAHAIR)
uniform vec4 _SpecularColor;
uniform float _SpecularIntensity;
#endif

#ifdef _STYLIZED
uniform float _StylizedSpecularSize;
uniform float _StylizedSpecularSoftness;
uniform float _StylizedSpecularAlbedoWeight;
#endif

#ifdef _BLINNPHONG
uniform float _Shininess;
#endif

#if defined(_GGX) && defined(_SPECULAR_AA_ON)
uniform float _SpecularAAThreshold;
uniform float _SpecularAAStrength;
#endif

#ifdef _KAJIYAHAIR
uniform sampler2D _AnisoShiftMap;
uniform float _AnisoShiftScale;
uniform vec4 _AnisoSpecularColor1;
uniform float _AnisoSpread1;
uniform float _AnisoSpecularShift1;
uniform float _AnisoSpecularStrength1;
uniform float _AnisoSpecularExponent1;
uniform vec4 _AnisoSpecularColor2;
uniform float _AnisoSpread2;
uniform float _AnisoSpecularShift2;
uniform float _AnisoSpecularStrength2;
uniform float _AnisoSpecularExponent2;
#endif

// ----- Emission -----
//_EMISSION_TEX_ON
#ifdef _EMISSION_TEX_ON
uniform sampler2D _EmissionTex;
#endif
uniform vec4 _EmissionColor;
uniform float _EmissionColorAlbedoWeight;

// ----- Fresnel Rim -----
//_RIM_FRESNEL
#ifdef _RIM_FRESNEL
uniform vec4 _RimColor;
uniform float _RimDirectionLightContribution;
uniform float _FresnelMin;
uniform float _FresnelMax;
#endif

// ----- Parallax & MatCap -----
#ifdef _EYE
uniform float _Parallax;

uniform sampler2D _MatCapTex;
uniform vec4 _MatCapTex_ST;
uniform vec4 _MatCapColor;
uniform float _MatCapAlbedoWeight;

uniform float _BumpIrisInvert;
#endif

// ----- RenderSetting -----
uniform float _Cutoff;
`;