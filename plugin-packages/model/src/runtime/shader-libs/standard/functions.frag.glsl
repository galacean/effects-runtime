// textures.glsl needs to be included

const float M_PI = 3.141592653589793;
const float c_MinReflectance = 0.04;

fsIn vec3 v_Position;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
fsIn mat3 v_TBN;
#else
fsIn vec3 v_Normal;
#endif
#endif

#ifdef HAS_VERTEX_COLOR_VEC3
fsIn vec3 v_Color;
#endif
#ifdef HAS_VERTEX_COLOR_VEC4
fsIn vec4 v_Color;
#endif

struct AngularInfo
{
    float NdotL;                  // cos angle between normal and light direction
    float NdotV;                  // cos angle between normal and view direction
    float NdotH;                  // cos angle between normal and half vector
    float LdotH;                  // cos angle between light direction and half vector

    float VdotH;                  // cos angle between view direction and half vector

    vec3 padding;
};

vec4 getVertexColor()
{
   vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

#ifdef HAS_VERTEX_COLOR_VEC3
    color.rgb = v_Color;
#endif
#ifdef HAS_VERTEX_COLOR_VEC4
    color = v_Color;
#endif

   return color;
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getNormal()
{
    vec2 UV = getNormalUV();

    // Retrieve the tangent space matrix
#ifndef HAS_TANGENTS
    vec3 pos_dx = _dFdx(v_Position);
    vec3 pos_dy = _dFdy(v_Position);
    vec3 tex_dx = _dFdx(vec3(UV, 0.0));
    vec3 tex_dy = _dFdy(vec3(UV, 0.0));
    vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
    vec3 ng = normalize(v_Normal);
#else
    vec3 ng = cross(pos_dx, pos_dy);
#endif

    t = normalize(t - ng * dot(ng, t));
    vec3 b = normalize(cross(ng, t));
    mat3 tbn = mat3(t, b, ng);
#else // HAS_TANGENTS
    mat3 tbn = v_TBN;
#endif

#ifdef HAS_NORMAL_MAP
    vec3 n = texture2D(u_NormalSampler, UV).rgb;
    n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_NormalScale, u_NormalScale, 1.0)));
#else
    // The tbn matrix is linearly interpolated, so we need to re-normalize
    vec3 n = normalize(tbn[2].xyz);
#endif

#ifdef DOUBLE_SIDED
    float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
    n = n * faceDirection;
#endif

    return n;
}

float getPerceivedBrightness(vec3 vector)
{
    return sqrt(0.299 * vector.r * vector.r + 0.587 * vector.g * vector.g + 0.114 * vector.b * vector.b);
}

// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness/examples/convert-between-workflows/js/three.pbrUtilities.js#L34
float solveMetallic(vec3 diffuse, vec3 specular, float oneMinusSpecularStrength) {
    float specularBrightness = getPerceivedBrightness(specular);

    if (specularBrightness < c_MinReflectance) {
        return 0.0;
    }

    float diffuseBrightness = getPerceivedBrightness(diffuse);

    float a = c_MinReflectance;
    float b = diffuseBrightness * oneMinusSpecularStrength / (1.0 - c_MinReflectance) + specularBrightness - 2.0 * c_MinReflectance;
    float c = c_MinReflectance - specularBrightness;
    float D = b * b - 4.0 * a * c;

    return clamp((-b + sqrt(D)) / (2.0 * a), 0.0, 1.0);
}

AngularInfo getAngularInfo(vec3 pointToLight, vec3 normal, vec3 view)
{
    // Standard one-letter names
    vec3 n = normalize(normal);           // Outward direction of surface point
    vec3 v = normalize(view);             // Direction from surface point to view
    vec3 l = normalize(pointToLight);     // Direction from surface point to light
    vec3 h = normalize(l + v);            // Direction of the vector between l and v

    float NdotL = clamp(dot(n, l), 0.0, 1.0);
    float NdotV = clamp(dot(n, v), 0.0, 1.0);
    float NdotH = clamp(dot(n, h), 0.0, 1.0);
    float LdotH = clamp(dot(l, h), 0.0, 1.0);
    float VdotH = clamp(dot(v, h), 0.0, 1.0);

    return AngularInfo(
        NdotL,
        NdotV,
        NdotH,
        LdotH,
        VdotH,
        vec3(0, 0, 0)
    );
}

float getAARoughnessFactor(vec3 normal) 
{
    // 根据偏导数计算法线变化剧烈程度
    // http://www.jp.square-enix.com/tech/library/pdf/ImprovedGeometricSpecularAA.pdf
    vec3 dxy = max(abs(_dFdx(normal)), abs(_dFdy(normal)));
    return max(max(dxy.x, dxy.y), dxy.z) * 2.0;
}

#ifdef DEBUG_UV

uniform float u_DebugUVGridSize;
//const float u_DebugUVGridSize = 1.0 / 12.0;

float getDebugUVColor(vec2 uv, vec3 n) {
    float s = dot(abs(n), vec3(1,1,1)) * 0.6;
    uv = uv / (u_DebugUVGridSize * 2.0);
    uv = uv - floor(uv);
    uv = uv * 2.0 - vec2(1.0);
    return s * (uv.x * uv.y >= 0.0 ? 0.2: 1.0);
}

#endif