#ifdef SHADER_VERTEX
#define CURVE_VALUE_TEXTURE uVCurveValueTexture
#define CURVE_VALUE_ARRAY uVCurveValues
#define CURVE_VALUE_COUNT VERT_CURVE_VALUE_COUNT
#define FRAG_CURVE_VALUE_COUNT 0
#else
#define CURVE_VALUE_TEXTURE uFCurveValueTexture
#define CURVE_VALUE_ARRAY uFCurveValues
#define CURVE_VALUE_COUNT FRAG_CURVE_VALUE_COUNT
#define VERT_CURVE_VALUE_COUNT 0
#endif

#if CURVE_VALUE_COUNT > 0
    #if LOOKUP_TEXTURE_CURVE
        uniform sampler2D CURVE_VALUE_TEXTURE;
        const float uCurveCount = 1. / float(CURVE_VALUE_COUNT);
        #define lookup_curve(i) texture2D(CURVE_VALUE_TEXTURE,vec2(float(i) * uCurveCount,0.))
    #else
        // #ifdef WEBGL2
        //     layout(std140) uniform CurveValues {
        //     #if VERT_CURVE_VALUE_COUNT > 0
        //         vec4 uVCurveValues[VERT_CURVE_VALUE_COUNT];
        //     #endif
        //     #if FRAG_CURVE_VALUE_COUNT > 0
        //         vec4 uFCurveValues[FRAG_CURVE_VALUE_COUNT];
        //     #endif
        //     };
        //     #define lookup_curve(i) CURVE_VALUE_ARRAY[i]
        // #else
            uniform vec4 CURVE_VALUE_ARRAY[CURVE_VALUE_COUNT];
            #define lookup_curve(i) CURVE_VALUE_ARRAY[i]
        //#endif
    #endif
#else
    #define lookup_curve(i) vec4(0.)
#endif

#ifdef WEBGL2
#define ITR_END (count + 1)
#else
#define ITR_END MAX_C
#endif
