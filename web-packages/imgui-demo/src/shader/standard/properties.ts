export default `
// RenderSetting
// [SubToggle(Global, _RECEIVE_SHADOWS_OFF)] _RECEIVE_SHADOWS_OFF("不接收阴影", Float) = 0
// [SubToggle(Global, _ENV_SPECULAR_ON)] _ENV_SPECULAR_ON ("使用 Env Specular", float) = 1
// [SubToggle(Global, _ENV_DIFFUSE_ON)] _ENV_DIFFUSE_ON ("使用 Env Diffuse", float) = 1
// [KWEnum(Global, None, _, Pixel Light, _ADDITIONAL_LIGHTS_ON, Vertex Light, _ADDITIONAL_LIGHTS_VERTEX_ON)] _enum_additional_lights ("附加光源类型", float) = 1

// [Surface(RenderSetting)] _Surface("Surface Type", Float) = 0.0
// [SubEnum(RenderSetting, UnityEngine.Rendering.CullMode)] _Cull("Cull Mode", Float) = 2.0
// [SubEnum(RenderSetting, UnityEngine.Rendering.BlendMode)] _SrcBlend("Src Alpha", Float) = 1.0
// [SubEnum(RenderSetting, UnityEngine.Rendering.BlendMode)] _DstBlend("Dst Alpha", Float) = 0.0
// [SubEnum(RenderSetting, Off, 0, On, 1)] _ZWrite("Z Write", Float) = 1.0
// [SubEnum(RenderSetting, Off, 0, On, 1)] _CasterShadow("Caster Shadow", Float) = 1
// [Sub(RenderSetting)]_Cutoff("Alpha Clipping", Range(0.0, 1.0)) = 0.5

// ========== Surface ==========
_BaseMap ("Base Map", 2D) = "white" { }
_BaseColor ("Base Color", color) = (1, 1, 1, 1)
_Alpha ("Alpha", Range(0,2)) = 1.0

// [SubToggle(Surface, _NORMALMAP)] _NORMALMAP("使用 Normal Map", Float) = 0.0
_BumpMap ("Normal Map", 2D) = "bump" { }
_BumpScale("Normal Scale", Float) = 1.0

_LightMap1 ("Light Map 1", 2D) = "white" { } // R  Occlusion, G  Roughness, B  Metalli, A  None
// [SubToggle(Surface, _LIGHTMAP2_ON)] _LIGHTMAP2_ON("使用第二张 LightMap", Float) = 0.0
_LightMap2 ("Light Map 2", 2D) = "white" { } // R  SpecularMask, G  EmissionMask, B  ParallaxMap, A  None

_Occlusion("Occlusion", Range(0, 1.0)) = 1
_Roughness("_Roughness", Range(0, 1.0)) = 1
_Metallic("Metallic", Range(0, 1.0)) = 1

// ========== Diffuse ==========
// [KWEnum(Diffuse, Ramp, _DIFFUSE_RAMP, Lambert, _DIFFUSE_LAMBERT)] _enum_diffuse ("Shading Mode", float) = 1
_UseHalfLambert ("使用半兰伯特模型（提亮）", float) = 0
_UseRadianceOcclusion ("Occlusion 影响直接光照（增强 AO，减弱光照）", float) = 0

_HighColor ("亮部偏色", Color) = (1,1,1,1)
_DarkColor ("暗部偏色", Color) = (0,0,0,1)

_DiffuseRampMap ("Ramp Map", 2D) = "white" {}
_RampMapUOffset ("Ramp Map U 偏移", Range(-1,1)) = 0
_RampMapVOffset ("Ramp Map V 偏移", Range(0,1)) = 0.5

// ========== Specular ==========
// [KWEnum(Specular, None, _, Stylized, _STYLIZED, Blinn Phong, _BLINNPHONG, GGX, _GGX, Anisotropy, _KAJIYAHAIR)] _enum_specular ("Shading Mode", float) = 3
// [SubToggle(Specular, _SPECULAR_MASK_ON)] [ShowIf(_enum_specular, G, 0)] _SPECULAR_MASK_ON("使用 Specular Mask", Float) = 0.0 // todo DEBUG 功能
_SpecularColor ("Specular Color", Color) = (1,1,1,1)
_SpecularIntensity ("Specular 强度", Range(0,16)) = 1
// 风格化
_StylizedSpecularSize ("Stylized Specular Size", Range(0,1)) = 0.1
_StylizedSpecularSoftness ("Stylized Specular Softness", Range(0.001,1)) = 0.05
_StylizedSpecularAlbedoWeight ("高光颜色和基色混合权重", Range(0,1)) = 0
  // Phong
_Shininess ("BlinnPhong Shininess", Range(0,1)) = 1
// GGX
_SPECULAR_AA_ON("Use Specular AA", Float) = 0.0
_SpecularAAThreshold ("SpecularAA Threshold", Range(0,1)) = 0.5
_SpecularAAStrength ("SpecularAA Strength", Range(0,1)) = 1
// KK
_AnisoShiftMap ("Aniso Shift Map", 2D) = "white" {}
_AnisoShiftScale ("Aniso Shift Scale", Range(1, 50)) = 10
_AnisoSpecularColor1("Aniso Specular Color Layer1", Color) = (1,1,1,1)
_AnisoSpread1("Aniso Specular Spread Layer1", Range(-1,1)) = 0.0
_AnisoSpecularShift1("Aniso Specular Shift Layer1", Range(-3,3)) = 1.0
_AnisoSpecularStrength1("Aniso Specular Strength Layer1", Range(0, 64)) = 1.0
_AnisoSpecularExponent1("Aniso Specular Exponent Layer1", Range(1,1024)) = 1.0
_AnisoSpecularColor2("Aniso Specular Color Layer2", Color) = (0.5,0.5,0.5,1)
_AnisoSpread2("Aniso Specular Spread Layer2", Range(-1,1)) = 0.0
_AnisoSpecularShift2("Aniso Specular Shift Layer2", Range(-3,3)) = 1.0
_AnisoSpecularStrength2("Aniso Specular Strength Layer2", Range(0, 64)) = 1.0
_AnisoSpecularExponent2("Aniso Specular Exponent Layer2",Range(1,1024)) = 1.0

// ========== Emission ==========
// [SubToggle(EmssionSetting, _EMISSION_TEX_ON)] _EMISSION_TEX_ON("使用额外的自发光贴图", Float) = 0.0
_EmissionTex ("自发光贴图", 2D) = "white" { }
_EmissionColor("自发光颜色", Color) = (0,0,0,0)
_EmissionColorAlbedoWeight("自发光颜色和基色混合权重", Range(0, 1)) = 0

// ========== Rim ==========
// [Main(Rim, _RIM_FRESNEL, off, on)] _RIM_FRESNEL ("Fresnel Rim", float) = 0
_RimColor("Rim Color",Color) = (1,1,1,1)
_RimDirectionLightContribution("主光源方向矫正", Range(0,1)) = 1.0
_FresnelMin("Fresnel Min",Range(-1,2)) = 0.5
_FresnelMax("Fresnel Max",Range(-1,2)) = 1

// ========== Dissolve ==========
// [Main(Dissolve, _DISSOLVE, off, on)] _DISSOLVE_ON ("溶解", float) = 0
_PolarCenterU("_PolarCenterU", Float) = 0.5
_PolarCenterV("_PolarCenterV", Float) = 0.5
_DissolveTex("_DissolveTex",2D) = "white"{} // Linear 灰度
_DissolveColor("_DissolveColor",Color) = (1,1,1,1) // sRGB
_DissolveSpeedU("_DissolveSpeedU",float) = 0
_DissolveSpeedV("_DissolveSpeedV",float) = 0
_DissolveFactor("_DissolveFactor",Range(0,1)) = 0.5
_DissolveHardness("_DissolveHardness",Range(0,1)) = 0.9
_DissolveWidth("_DissolveWidth",Range(0,1)) = 0.1
`;
