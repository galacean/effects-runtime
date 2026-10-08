#define _MAX_STOPS 8
#define PI 3.14159265359

uniform vec4 _Color;                   // 纯色
uniform vec4 _Colors[_MAX_STOPS];      // 渐变颜色数组
uniform float _Stops[_MAX_STOPS];      // 渐变控制点位置数组
uniform int _StopsCount;               // 实际使用的渐变控制点数量
uniform float _FillType;               // 填充类型 (0:solid, 1:linear, 2:radial, 3:angular, 4:image)
uniform vec2 _StartPoint;              // 渐变起点 (0-1范围)
uniform vec2 _EndPoint;                // 渐变终点 (0-1范围)

// 辅助函数：在两点之间进行平滑插值
vec4 smoothMix(vec4 a, vec4 b, float t) {
    return mix(a, b, smoothstep(0.0, 1.0, t));
}

// 计算向量的角度 (返回0到1之间的值)
float calculateAngleRatio(vec2 v1, vec2 v2) {
    float angle = atan(v2.y, v2.x) - atan(v1.y, v1.x);
    if(angle < 0.0)
        angle += 2.0 * PI;
    return angle / (2.0 * PI);
}

// 返回未预乘颜色。调用方负责与覆盖率相乘。
vec4 evalGradient(vec2 uv) {
    if(_FillType == 0.0) {
        return _Color;
    }

    float t = 0.0;

    if(_FillType == 1.0) {
        // 线性渐变
        vec2 gradientVector = _EndPoint - _StartPoint;
        vec2 pixelVector = uv - _StartPoint;
        float denom = max(dot(gradientVector, gradientVector), 1e-6);
        t = clamp(dot(pixelVector, gradientVector) / denom, 0.0, 1.0);
    } else if(_FillType == 2.0) {
        // 径向渐变
        float maxRadius = max(distance(_EndPoint, _StartPoint), 0.001);
        t = clamp(distance(uv, _StartPoint) / maxRadius, 0.0, 1.0);
    } else if(_FillType == 3.0) {
        // 角度渐变
        vec2 center = _StartPoint;
        vec2 referenceVector = _EndPoint - center;
        vec2 targetVector = uv - center;
        if(length(targetVector) > 0.001) {
            t = calculateAngleRatio(referenceVector, targetVector);
        }
    } else {
        return vec4(1.0);
    }

    vec4 finalColor = _Colors[0];
    for(int i = 1; i < _MAX_STOPS; i++) {
        if(i >= _StopsCount)
            break;
        float prevStop = _Stops[i - 1];
        float currStop = _Stops[i];
        if(t >= prevStop && t <= currStop) {
            float localT = (t - prevStop) / max(currStop - prevStop, 1e-6);
            finalColor = smoothMix(_Colors[i - 1], _Colors[i], localT);
            break;
        }
    }

    return finalColor;
}
