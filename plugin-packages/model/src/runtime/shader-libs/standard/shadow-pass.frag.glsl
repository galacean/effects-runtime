#define FEATURES

#include <shadow-common.vert.glsl>
#include <webgl-compatibility.glsl>


#if defined(SHADOWMAP_VSM) && !defined(WEBGL2)
#extension GL_OES_standard_derivatives : enable
#endif


#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif


#ifdef WEBGL2
    out vec4 outFragColor;
#else
    #define outFragColor gl_FragColor
#endif


vec4 CalcMomentVSM(float depth)
{
    float dx = 0.0;
    float dy = 0.0;

    #if defined(SHADOWMAP_VSM) && (defined(GL_OES_standard_derivatives) || defined(WEBGL2))
        dx = dFdx(depth);
        dy = dFdy(depth);
    #endif

    float moment2 = depth * depth + 0.25 * (dx * dx + dy * dy);
    return vec4(1.0 - depth, 1.0 - moment2, 0.0, 1.0);
}

vec4 CalcMomentEVSM(float depth)
{
    float pos = EVSM_FUNC0(depth);
    float neg = EVSM_FUNC1(depth);
    return vec4(pos, pos * pos, neg, neg * neg);
}

void main()
{
    #if defined(SHADOWMAP_STANDARD) || defined(SHADOWMAP_VSM)
        outFragColor = CalcMomentVSM(gl_FragCoord.z);
    #else // SHADOWMAP_EVSM
        outFragColor = CalcMomentEVSM(gl_FragCoord.z);
    #endif
}
