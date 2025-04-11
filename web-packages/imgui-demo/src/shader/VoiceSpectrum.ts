const vart = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

varying vec2 _uv;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;

void main(){
  _uv = aUV;
  
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos,1.0);
}
`;

const frag = `
precision highp float;

// Varyings
varying vec2 _uv;

uniform vec4 _Time;
// uniform vec2 _AspectRatio; // 宽高比
uniform sampler2D _Spectrum; // 音频信息

float _AspectRatio = 702. / 98.;

// 颜色常量定义
const vec3 BAR_COLOR_CENTER = vec3(1.0, 1.0, 1.0);    // 柱子中心颜色
const vec3 BAR_COLOR_MIDDLE = vec3(0.576, 0.607, 0.808);    // 柱子过渡颜色
const vec3 BAR_COLOR_EDGE = vec3(0.0431, 0.059, 0.1);      // 柱子边缘颜色
const float GRADIENT_POWER = 1.5;         // 渐变指数
const float GRADIENT_CENTER_THRESHOLD = 0.2; // 渐变中心区域阈值

// 常量定义
const float EDGE_SMOOTHING = 0.0007;      // 边缘平滑参数，越小越锐利
const float BAR_COUNT = 50.0;            // 柱子的数量
const float BAR_WIDTH_SCALE = 0.57;       // 柱子宽度占用可用空间的比例
const float AUDIO_THRESHOLD = 0.02;      // 音频强度的阈值
const float BAR_HEIGHT_SCALE = 0.357;      // 柱子高度缩放比例

// Bloom效果参数
const float BASE_BLOOM_INTENSITY = 0.4;   // 基础辉光强度
const float AUDIO_BLOOM_MULTIPLIER = 3.0; // 音频对辉光的影响系数
const float BLOOM_THRESHOLD = 0.1;       // 判断是否为柱子区域的阈值
const float BLOOM_TRANSITION_RANGE = 0.1; // Bloom边缘过渡范围

// 绘制胶囊形状（上下两端是半圆的矩形）
float drawCapsule(vec2 position, vec2 center, vec2 size) {
    // 调整position的y坐标，确保在任何比例下都能保持正确形状
    vec2 aspectCorrectedPos = vec2(position.x, position.y);
    vec2 aspectCorrectedCenter = vec2(center.x, center.y);
    vec2 aspectCorrectedSize = vec2(size.x, size.y);
    
    float halfWidth = aspectCorrectedSize.x;
    float halfHeight = aspectCorrectedSize.y;
    
    // 如果高度为0，则绘制纯圆形
    if (halfHeight <= 0.0) {
        // 为确保圆形在任何宽高比下都是真正的圆形，计算椭圆距离
        vec2 delta = aspectCorrectedPos - aspectCorrectedCenter;
        delta.x *= _AspectRatio;
        float dist = length(delta) / _AspectRatio;
        // 抗锯齿处理
        return 1.0 - smoothstep(halfWidth - EDGE_SMOOTHING, halfWidth + EDGE_SMOOTHING, dist);
    }
    
    // 计算水平距离，考虑宽高比
    float distToLine = abs(aspectCorrectedPos.x - aspectCorrectedCenter.x) / _AspectRatio;
    // 计算垂直方向上的距离
    float verticalDist = abs(aspectCorrectedPos.y - aspectCorrectedCenter.y);
    
    // 如果是矩形的主体部分
    if (verticalDist <= halfHeight - halfWidth) {
        return step(distToLine, halfWidth);
    }

    // 如果是顶部或底部的半圆部分

    // 计算到顶部或底部圆心的距离
    vec2 circleCenter = vec2(
        aspectCorrectedCenter.x, 
        aspectCorrectedCenter.y + sign(aspectCorrectedPos.y - aspectCorrectedCenter.y) * (halfHeight - halfWidth)
    );
    
    // 计算到圆心的距离，考虑宽高比，确保形成真正的圆形
    vec2 delta = aspectCorrectedPos - circleCenter;
    delta.x *= _AspectRatio;
    float dist = length(delta) / _AspectRatio;
    
    // 抗锯齿处理
    return 1.0 - smoothstep(halfWidth - EDGE_SMOOTHING, halfWidth + EDGE_SMOOTHING, dist);
}

// 计算颜色渐变：从边缘到中心的三段式渐变
vec3 calculateGradientColor(float position) {
    // 计算到中心的距离（0.0=中心，1.0=边缘）
    float distanceToCenter = abs(position - 0.5) * 2.0;
    // 调整渐变比例
    float adjustedDistance = pow(distanceToCenter, GRADIENT_POWER);
    
    // 三段式渐变
    if (adjustedDistance < GRADIENT_CENTER_THRESHOLD) {
        // 中心区域：从纯白到中间色
        float t = adjustedDistance / GRADIENT_CENTER_THRESHOLD;
        return mix(BAR_COLOR_CENTER, BAR_COLOR_MIDDLE, t);
    } else {
        // 外围区域：从中间色到边缘色
        float t = (adjustedDistance - GRADIENT_CENTER_THRESHOLD) / (1.0 - GRADIENT_CENTER_THRESHOLD);
        return mix(BAR_COLOR_MIDDLE, BAR_COLOR_EDGE, t);
    }
}

// 获取音频样本
float getAudioSample(float xPosition) {
    return texture2D(_Spectrum, vec2(xPosition, 0.5)).x;
}

// 计算柱子位置和属性
vec2 calculateBarPosition(float index) {
    float barX = (index + 0.5) / BAR_COUNT; // 柱子中心的x坐标
    float barWidth = (1.0 / BAR_COUNT) * BAR_WIDTH_SCALE;
    return vec2(barX, barWidth);
}

// 计算柱子的振动高度
float calculateBarHeight(float audioSample, float barIndex) {
    float baseHeight = audioSample * BAR_HEIGHT_SCALE;
    // baseHeight *= 1.0 + 0.1 * sin(_Time.y * 10.0); // 增加动感
    return baseHeight;
}

// 计算Bloom效果强度
float calculateBloomIntensity(float distToCenter, float audioSample, vec3 color) {
    // 距离衰减
    float distanceFalloff = smoothstep(0.6, 0.0, distToCenter);

    // 音频影响，使用 BAR_HEIGHT_SCALE 调整音频强度
    float audioFactor = 0.5 + audioSample * BAR_HEIGHT_SCALE * AUDIO_BLOOM_MULTIPLIER;

    // 根据当前像素颜色值平滑 bloom 效果
    float colLength = length(color);
    float bloomFactor = smoothstep(BLOOM_THRESHOLD + BLOOM_TRANSITION_RANGE, BLOOM_THRESHOLD - BLOOM_TRANSITION_RANGE, colLength);
    
    float intensity = BASE_BLOOM_INTENSITY * distanceFalloff * distanceFalloff * audioFactor * bloomFactor;
    return intensity;
}

void main() {
    vec2 uv = _uv.xy;
    vec3 col = vec3(0.0);
    
    // 计算当前像素属于哪个柱子
    float barIndex = floor(uv.x * BAR_COUNT);
    vec2 barPos = calculateBarPosition(barIndex);
    float barX = barPos.x; // 柱子中心x坐标
    float barWidth = barPos.y; // 柱子宽度
    float halfBarWidth = barWidth * 0.5;
    
    // 为当前柱子获取音频样本数据
    float fSample = getAudioSample(barX);
    // 计算柱子的颜色（连续渐变）
    vec3 barColor = calculateGradientColor(uv.x);
    
    // 计算当前像素是否在柱子的可绘制范围内
    float pixelOffset = abs(uv.x - barX);
    // 绘制柱子
    if (pixelOffset < halfBarWidth) {
        // 计算当前柱子的高度（包含振动效果）
        float barHeight = calculateBarHeight(fSample, barIndex);
        
        if (barHeight < AUDIO_THRESHOLD) {
            // 音频强度小于阈值时，绘制纯圆形
            float circle = drawCapsule(uv, vec2(barX, 0.5), vec2(halfBarWidth, 0.0));
            col = barColor * circle;
        } else {
            // 音频强度大于阈值时，绘制胶囊形状
            float rect = drawCapsule(uv, vec2(barX, 0.5), vec2(halfBarWidth, barHeight));
            col = barColor * rect;
        }
    }

    // 计算中间柱子的索引和位置
    float middleBarIndex = floor(BAR_COUNT / 2.0);
    float middleBarX = (middleBarIndex + 0.5) / BAR_COUNT;

    // 中心平滑 bloom 效果计算
    vec2 center = vec2(0.5, 0.5);
    float distToCenter = length(uv - center);

    // 获取当前点最近的柱子的音频强度和颜色
    float nearestBarSample = getAudioSample(barX);

    // 计算Bloom强度
    float bloomIntensity = calculateBloomIntensity(distToCenter, nearestBarSample, col);


    // 平滑混合bloom效果
    col += barColor * bloomIntensity;
    
    gl_FragColor = vec4(col, 1.0);
}
`;