#define AA_ENABLED 0  // 1=启用高级抗锯齿，0=禁用

precision highp float;

varying vec2 uv;
uniform vec4 _Time;
uniform float _CurveAngle;
uniform float _CurveType;

// UI可控制的参数
uniform float _LineWidth;
uniform vec3 _LineColor;
uniform float _BaseBloomIntensity;
uniform float _BloomRange;
uniform float _BloomTransitionRange;
uniform float _GradientPower;
uniform float _GradientCenterThreshold;
uniform vec3 _PurpleColor;
uniform vec3 _GreenColor;
uniform vec3 _BlueColor;
uniform vec3 _InsideColor;
uniform float _InsideAlpha;
uniform float _TimeSpeed;

// 保留的渐变参数
uniform vec3 _BarColorCenter;
uniform vec3 _BarColorMiddle;
uniform vec3 _BarColorEdge;

// 氛围光参数
uniform float uAmplitude;
uniform vec3 uColorStops0;
uniform vec3 uColorStops1;
uniform vec3 uColorStops2;
uniform float uBlend;
uniform sampler2D uAudioTexture;
uniform float uAudioInfluence;
uniform float uAudioMultiplier;
uniform float uTimeSpeed;
uniform float uNoiseScale;
uniform float uHeightMultiplier;
uniform float uMidPoint;
uniform float uIntensityMultiplier;
uniform float uYOffset;

// 新增 uniform 控制左右端色的动态方式
uniform int uLeftMode;   // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态
uniform int uRightMode;  // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态

// 新增辉光控制参数
uniform float _GlowWidth;      // 辉光范围
uniform float _GlowSoft;       // 辉光边缘柔和度
uniform float _GlowPower;      // 辉光边缘衰减
uniform float _GlowIntensity;  // 辉光强度

// 新增：线宽衰减力度，建议范围 1~4
uniform float uDynamicWidthFalloff;
uniform float uColorRegion; // 新增
uniform float uGlowRegion;
uniform float uDynamicWidthCenter; // 新增，线宽衰减中心位置

vec2 getBezierControlPoint(float angle, vec2 A, vec2 C) {
    float midX = (A.x + C.x) * 0.5;
    float midY = (A.y + C.y) * 0.5;
    float offsetY = tan(angle) * abs(C.x - A.x) * 0.5;
    return vec2(midX, midY + offsetY);
}

void getCurvePoints(float curveType, out vec2 A, out vec2 C) {
    if (curveType < 0.5) {
        A = vec2(0.0, 0.0);
        C = vec2(1.0, 0.0);
    } else {
        A = vec2(0.0, 1.0);
        C = vec2(1.0, 1.0);
    }
}

float sd_bezier_signed(vec2 pos, vec2 A, vec2 B, vec2 C) {
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    
    float kk = 1.0/dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);
    
    float res = 0.0;
    float bestT = 0.0;
    vec2 closestPoint;
    
    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float h = q*q + 4.0*p3;
    
    if (h >= 0.0) {
        h = sqrt(h);
        vec2 x = (vec2(h,-h) - q) / 2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp(uv.x + uv.y - kx, 0.0, 1.0);
        
        closestPoint = A + t*(c + b*t);
        res = length(closestPoint - pos);
        bestT = t;
    } else {
        float z = sqrt(-p);
        float v = acos(q/(p*z*2.0)) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
        
        vec2 point1 = A + t.x*(c + b*t.x);
        vec2 point2 = A + t.y*(c + b*t.y);
        vec2 point3 = A + t.z*(c + b*t.z);
        
        float dist1 = distance(pos, point1);
        float dist2 = distance(pos, point2);
        float dist3 = distance(pos, point3);
        
        if (dist1 <= dist2 && dist1 <= dist3) {
            res = dist1;
            closestPoint = point1;
            bestT = t.x;
        } else if (dist2 <= dist3) {
            res = dist2;
            closestPoint = point2;
            bestT = t.y;
        } else {
            res = dist3;
            closestPoint = point3;
            bestT = t.z;
        }
    }

    vec2 tangent = 2.0*(1.0-bestT)*(B-A) + 2.0*bestT*(C-B);
    vec2 normal = normalize(vec2(-tangent.y, tangent.x));
    vec2 toPoint = pos - closestPoint;
    float side = dot(normalize(toPoint), normal);
    return side > 0.0 ? res : -res;
}

float antiAliasedStroke(float dist, float lineWidth) {
    float aa = max(fwidth(dist), 0.002);
    // 两边都平滑
    return smoothstep(lineWidth + aa, lineWidth - aa, abs(dist));
}

vec3 calculateGradientColor(float sdfDistance, vec2 uvPos) {
    float normalizedDistance = clamp(sdfDistance / _BloomRange, 0.0, 1.0);
    float adjustedDistance = pow(normalizedDistance, _GradientPower);
    float timeInfluence = sin(_Time.y * _TimeSpeed) * 0.5 + 0.5;
    vec3 baseColor;
    if (uvPos.x < 0.3) {
        baseColor = mix(_PurpleColor, _GreenColor, timeInfluence);
    } else if (uvPos.x > 0.7)  {
        baseColor = _BlueColor;
    } else {
        vec3 leftColor = mix(_PurpleColor, _GreenColor, timeInfluence);
        float transitionFactor = (uvPos.x - 0.3) / 0.4;
        baseColor = mix(leftColor, _BlueColor, transitionFactor);
    }
    if (adjustedDistance < _GradientCenterThreshold) {
        float t = adjustedDistance / _GradientCenterThreshold;
        return mix(baseColor, _BarColorMiddle, t);
    } else {
        float t = (adjustedDistance - _GradientCenterThreshold) / (1.0 - _GradientCenterThreshold);
        return mix(_BarColorMiddle, _BarColorEdge, t);
    }
}

float calculateBloomIntensity(float sdfDistance) {
    if (sdfDistance <= 0.0) {
        return 0.0;
    }
    float audioSample = sin(_Time.y * _TimeSpeed) * 0.5 + 0.5;
    float distanceFalloff = smoothstep(_BloomRange + _BloomTransitionRange, _BloomRange - _BloomTransitionRange, sdfDistance);
    float audioFactor = 0.5 + audioSample * 2.0;
    float intensity = _BaseBloomIntensity * distanceFalloff * distanceFalloff * audioFactor;
    return intensity;
}

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 getStopColor(int mode, float beat) {
    if(mode == 0) return uColorStops0;
    if(mode == 1) return uColorStops1;
    if(mode == 2) return uColorStops2;
    if(mode == 3) return mix(uColorStops0, uColorStops2, beat);
    if(mode == 4) return mix(uColorStops1, uColorStops2, beat);
    return uColorStops0;
}

vec3 getColorFromGradient(float factor) {
    float beat = sin(_Time.y * uTimeSpeed) * 0.5 + 0.5;
    vec3 leftColor = getStopColor(uLeftMode, beat);
    vec3 rightColor = getStopColor(uRightMode, beat);
    return mix(leftColor, rightColor, factor);
}


void main() {
    vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);

    float audioData = texture2D(uAudioTexture, vec2(uvCoord.x, 0.5)).r;

    //获取渐变的颜色
    vec3 rampColor = getColorFromGradient(uvCoord.x);
    vec3 glowColor = rampColor;


    uvCoord = vec2(uv.x, uv.y);

    // 计算贝塞尔曲线绘制
    vec2 A_single, C_single;
    getCurvePoints(_CurveType, A_single, C_single);
    vec2 B_single = getBezierControlPoint(_CurveAngle, A_single, C_single);
    float signedDist = sd_bezier_signed(uvCoord, A_single, B_single, C_single);
    vec3 gradientColor = calculateGradientColor(abs(signedDist), uvCoord);
    float bloomIntensity = calculateBloomIntensity(abs(signedDist));


    // 在着色器开头添加全局抗锯齿控制
#if AA_ENABLED
    vec2 grad = vec2(dFdx(signedDist), dFdy(signedDist));
    float gradient = length(grad);
    float globalAARange = clamp(gradient * 2.0, 0.005, 0.15);

        // 双向平滑过渡
    float normalizedDist = signedDist / globalAARange;
    float alphaTransition = smoothstep(-0.5, 0.5, normalizedDist);
#else
    float globalAARange = max(fwidth(signedDist), 0.01) ;
    float alphaTransition = smoothstep(0.0, -globalAARange, signedDist);
#endif


    //线条从中间到两侧逐渐减少宽度
    float widthCenter = _LineWidth;         // 中间最大线宽
    float widthEdge = _LineWidth * 0.3;     // 两侧最小线宽，可调
    // 修改中心点
    float t = pow(abs(uvCoord.x - uDynamicWidthCenter) / max(uDynamicWidthCenter, 1.0-uDynamicWidthCenter), uDynamicWidthFalloff);
    t = max(0.0, t - uColorRegion); // uColorRegion 越大，彩色区域越窄
    float dynamicLineWidth = mix(widthCenter, widthEdge, t);

    //计算静宽
    float lineStroke = antiAliasedStroke(abs(signedDist), dynamicLineWidth);

    // 彩色区域mask
    float aa = fwidth(signedDist) * 3.0; // 1.0~2.0 可调，越大越柔和
    float colorMask = smoothstep(dynamicLineWidth +aa, dynamicLineWidth - aa, abs(signedDist));


    vec3 linecolor = _InsideColor;

    // 计算mask后的rampcolor
    rampColor = mix(linecolor, rampColor, colorMask);

    vec3 finalColorRGB = vec3(0.0);
    float finalAlpha = 0.0;
    vec4 bgColor = vec4(rampColor, 1.0);
    vec3 auroraRampColor = rampColor;
    //finalColorRGB = aurora.rgb;
    finalAlpha = bgColor.a;

    // --- 辉光效果 begin ---
    float glowWidthCenter = _GlowWidth;
    float glowWidthEdge = _GlowWidth * 0.3; // 辉光两侧最小宽度
    float glowPower = _GlowPower;
    float glowIntensity = _GlowIntensity;
    float glowOffset = 0.01; 

    float glowt = pow(abs(uvCoord.x - uDynamicWidthCenter) / max(uDynamicWidthCenter, 1.0-uDynamicWidthCenter), uDynamicWidthFalloff);
    glowt = max(0.0, t - uGlowRegion); // uColorRegion 越大，彩色区域越窄
    float dynamicLineGlowWidth = mix(glowWidthCenter, glowWidthEdge, glowt);
    
    

    // 修改辉光的条件判断，使其与主线条的抗锯齿区域重叠
    float glow = 0.0;
    if (signedDist >= 0.0) {
        float distanceFromLine = signedDist+glowOffset;
        float glowStart = dynamicLineGlowWidth - _GlowSoft;
        float glowEnd = dynamicLineGlowWidth + _GlowWidth;
        float glowAA = max(fwidth(distanceFromLine), 0.002); // 加入抗锯齿
        glow = 1.0 - smoothstep(glowStart - glowAA, glowEnd + glowAA, abs(distanceFromLine));
        glow = pow(glow, _GlowPower);
    }

    // --- 辉光效果 end ---
    //finalColorRGB = _InsideColor;
    finalAlpha = 0.0;

    // 计算边界过渡抗锯齿
    float transitionRange = max(fwidth(signedDist), 0.01) ;
    float boundaryTransition = smoothstep(-globalAARange, globalAARange, transitionRange);




    // 2. 内部区域处理（单向过渡）
    if (signedDist < 0.0) {
        finalColorRGB = _InsideColor;
        if (lineStroke == 0.0) {
            // 在边界处alpha从1.0渐变到0.0
            #if AA_ENABLED
                finalAlpha = 1.0 - alphaTransition;
            #else
                finalAlpha = alphaTransition;
            #endif
        } else {
            finalAlpha = 1.0;
        }
        
    }

    // 3. 线条区域处理（渐变色/线条）
    if (lineStroke > 0.0) {
        if (signedDist < 0.0) {
            finalColorRGB = mix(_InsideColor.rgb, rampColor.rgb, lineStroke);
        } else {
            finalColorRGB = rampColor.rgb;
        }
        finalAlpha = finalAlpha;
    }

    // 4. 辉光区域处理（对称过渡+二次平滑）
    if (signedDist > 0.0) {
        vec3 glowBlend = glowColor;
        float glowFactor = glow * _GlowIntensity;
        float glowAA = globalAARange * 0.5; // 辉光抗锯齿范围与主范围关联

        if (lineStroke == 0.0) {
            // 对称过渡
            float blendFactor = smoothstep(-globalAARange, globalAARange, signedDist);
            finalColorRGB = mix(_InsideColor, glowBlend, blendFactor);

            // 二次平滑消除硬边
            float edgeSmooth = smoothstep(-globalAARange * 0.5, globalAARange * 0.5, signedDist);
            finalAlpha = mix(0.0, glowFactor, blendFactor) * edgeSmooth;
        } else {
            finalColorRGB = glowBlend;
            finalAlpha = max(lineStroke, glowFactor);
        }
    }



    gl_FragColor = vec4(finalColorRGB * finalAlpha, finalAlpha);
}