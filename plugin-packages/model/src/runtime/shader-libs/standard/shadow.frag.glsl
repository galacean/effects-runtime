#ifdef USE_SHADOW_MAPPING
uniform vec2 _ShadowMapSizeInv;
fsIn vec4 v_PositionLightSpace;
fsIn vec4 v_dPositionLightSpace;
#endif

float linstep(float low, float high, float v)
{
    return clamp((v-low) / (high-low), 0.0, 1.0);
}

#ifdef USE_SHADOW_MAPPING

float chebyshev(vec2 moments, float depth, float minVar)
{
    float p = step(depth, moments.x + SHADOWMAP_BAIS);
    float variance = max(moments.y - moments.x * moments.x, minVar);
    float d = depth - (moments.x + SHADOWMAP_BAIS);
    float pMax = linstep(0.2, 1.0, variance / (variance + d*d));
    return mix(0.1, 1.0, min(max(p, pMax), 1.0));
}

float getShadowContributionSM()
{
    vec3 coords = v_PositionLightSpace.xyz / v_PositionLightSpace.w * 0.5 + 0.5;
    if (coords.z < 0.01 || coords.z > 0.99 || coords.x < 0.01 || coords.x > 0.99 || coords.y < 0.01 || coords.y > 0.99) {
        return 1.0;
    }
    vec2 moments = vec2(1.0) - texture2D(_ShadowSampler, coords.xy).xy;
    return coords.z < moments.x * 1.008 + 0.008? 1.0: 0.2;
}

float getShadowContributionVSM()
{
    vec3 coords = v_PositionLightSpace.xyz / v_PositionLightSpace.w * 0.5 + 0.5;
    if (coords.z < 0.01 || coords.z > 0.99 || coords.x < 0.01 || coords.x > 0.99 || coords.y < 0.01 || coords.y > 0.99) {
        return 1.0;
    }
    vec2 moments = vec2(1.0) - texture2D(_ShadowSampler, coords.xy).xy;
    return chebyshev(moments, coords.z, 0.00002);
}

float computeEVSMShadow(vec2 coords, float pos, float neg)
{
    vec4 moments = texture2D(_ShadowSampler, coords);
    float posShadow = chebyshev(moments.xy, pos, 0.00002);
    float negShadow = chebyshev(moments.zw, neg, 0.00002);
    return min(posShadow, negShadow);
}

float getShadowContributionEVSM()
{
    vec3 coords = v_PositionLightSpace.xyz / v_PositionLightSpace.w * 0.5 + 0.5;
    if (coords.z < 0.01 || coords.z > 0.99 || coords.x < 0.01 || coords.x > 0.99 || coords.y < 0.01 || coords.y > 0.99) {
        return 1.0;
    }
    
    float depth = coords.z;
	float pos = EVSM_FUNC0(depth);
    float neg = EVSM_FUNC1(depth);
    #ifdef SHADOWMAP_EVSM_PCF
        vec2 newCoords = v_dPositionLightSpace.xy / v_dPositionLightSpace.w * 0.5 + 0.5;
        vec2 dCoords = min(abs(newCoords - coords.xy), _ShadowMapSizeInv);
        if(max(dCoords.x, dCoords.y) >= min(_ShadowMapSizeInv.x, _ShadowMapSizeInv.y) * 0.5){
            vec2 coords0 = coords.xy + vec2(-1.0,-1.0) * dCoords;
            vec2 coords1 = coords.xy + vec2(-1.0, 1.0) * dCoords;
            vec2 coords2 = coords.xy + vec2( 1.0,-1.0) * dCoords;
            vec2 coords3 = coords.xy + vec2( 1.0, 1.0) * dCoords;
            float shadow0 = computeEVSMShadow(coords0, pos, neg);
            float shadow1 = computeEVSMShadow(coords1, pos, neg);
            float shadow2 = computeEVSMShadow(coords2, pos, neg);
            float shadow3 = computeEVSMShadow(coords3, pos, neg);
            return (shadow0 + shadow1 + shadow2 + shadow3) * 0.25;
        }else{
            return computeEVSMShadow(coords.xy, pos, neg);
        }
    #else
        return computeEVSMShadow(coords.xy, pos, neg);
    #endif
}

float getShadowContribution()
{
    #if defined(SHADOWMAP_STANDARD)
        return getShadowContributionSM();
    #elif defined(SHADOWMAP_VSM)
        return getShadowContributionVSM();
    #else // SHADOWMAP_EVSM
        return getShadowContributionEVSM();
    #endif
}

#endif