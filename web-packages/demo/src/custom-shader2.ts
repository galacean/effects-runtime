/* eslint-disable no-case-declarations */
import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';
import { clamp } from 'three/src/math/MathUtils';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*gAIvS7C5mJ4AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数
interface ShaderParams {
  curveAngle: number,
  curveType: number,
  lineWidth: number,
  insideAlpha: number,
  timeSpeed: number,
  amplitude: number,
  blend: number,
  audioInfluence: number,
  audioMultiplier: number,
  timeSpeedUniform: number,
  noiseScale: number,
  heightMultiplier: number,
  midPoint: number,
  intensityMultiplier: number,
  yOffset: number,
  insideColor: { x: number, y: number, z: number, w: number },
  colorStops: { x: number, y: number, z: number, w: number }[],
  leftMode: number,
  rightMode: number,
  glowWidth: number,
  glowSoft: number,
  glowPower: number,
  glowIntensity: number,
  dynamicWidthFalloff: number,
  colorRegion: number,
  glowRegion: number,
  dynamicWidthCenter: number,
  dynamicWidthCenterRange: number,
  dynamicWidthSpeed: number,
  isDynamicWidthCenter: number,
  glowmask: number,
  minVolume: number,
  maxVolume: number,
  audioCurveInfluence: number, // 新增音量曲率影响参数
  glowBaseRatio: number, // 新增辉光基础比例，默认50%
  strokeAA: number, // 线条虚实度，默认2.0
  [key: string]: any, // Add index signature to allow string indexing
}

const defaults = {
  amplitude: 1.0,
  audioInfluence: 1.0,
  audioMultiplier: 2.0,
  blend: 0.5,
  timeSpeedUniform: 4.1,
  noiseScale: 2.0,
  heightMultiplier: 0.5,
  midPoint: 0.20,
  intensityMultiplier: 0.6,
  yOffset: 0.2,
  curveAngle: 0.5,
  curveType: 0.0,
  lineWidth: 0.084,
  insideAlpha: 1.0,
  timeSpeed: 4.100,
  leftMode: 3,
  rightMode: 1,
  glowWidth: 0.162,
  glowSoft: 0.03,
  glowPower: 2.0,
  glowIntensity: 0.830,
  dynamicWidthFalloff: 3.250,
  colorRegion: -1.270,
  glowRegion: -0.010,
  dynamicWidthCenter: 0.5,
  dynamicWidthCenterRange: 0.1,
  dynamicWidthSpeed: 0.5,
  isDynamicWidthCenter: 1.0,
  isDynamicCurve: 0.0,
  glowmask: 0,
  minVolume: 0.0,
  maxVolume: 1.0,
  audioCurveInfluence: 0.5, // 默认影响强度，可调整
  glowBaseRatio: 0.5, // 新增辉光基础比例，默认50%
  strokeAA: 2.0, // 线条虚实度，默认2.0
  centerPos: 0.5, // 中心位置(0-1)
  leftWidth: 0.5, // 左侧总宽度
  rightWidth: 0.5, // 右侧总宽度
  leftInnerRatio: 0.5, // 左侧内部高亮区域占比
  rightInnerRatio: 0.5, // 右侧内部高亮区域占比
  insideColor: { x: 0, y: 0, z: 0, w: 1.0 },
  colorStops: [
    { x: 82 / 255, y: 38 / 255, z: 255 / 255, w: 1.0 }, // #5226ff
    { x: 125 / 255, y: 255 / 255, z: 102 / 255, w: 1.0 }, // #7dff66
    { x: 167 / 255, y: 36 / 255, z: 255 / 255, w: 1.0 }, // #A724FF
  ],
};

const shaderParams: ShaderParams = { ...defaults };

const vertex = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;
varying vec2 uv;
uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;

void main(){
  uv = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
`;

const fragment = /*glsl*/ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec2 uv;
uniform vec4 _Time;
uniform float _CurveAngle;
uniform float _CurveType;
uniform float _LineWidth;
uniform float _InsideAlpha;
uniform vec4 _InsideColor;
uniform vec4 _ColorStops0;
uniform vec4 _ColorStops1;
uniform vec4 _ColorStops2;
uniform float _TimeSpeedUniform;
uniform float _LeftMode;   // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态
uniform float _RightMode;  // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态
uniform float _GlowWidth;      // 辉光范围
uniform float _GlowSoft;       // 辉光边缘柔和度
uniform float _GlowPower;      // 辉光边缘衰减
uniform float _GlowIntensity;  // 辉光强度
uniform float _DynamicWidthFalloff;
uniform float _ColorRegion;
uniform float _GlowRegion;
uniform float _DynamicWidthCenter;
uniform float _DynamicWidthCenterRange;
uniform float _DynamicWidthSpeed;
uniform float _IsDynamicWidthCenter; // 开关左右滑动
uniform float _Glowmask; // 0: 上, 1: 下, 2: 上下
uniform float _AudioMin;
uniform float _AudioMax;
uniform float _AudioCurrent;
uniform float _IsDynamicCurve; // 是否开启动态曲率
uniform float _AudioCurveInfluence; // 新增音量影响强度参数
uniform float _GlowBaseRatio; // 辉光基础比例，0.5表示最低50%辉光，1.0表示100%辉光
uniform float _StrokeAA; // 线条过渡抗锯齿// 中心位置(0-1)
uniform float _LeftWidth; // 左侧总宽度
uniform float _RightWidth; // 右侧总宽度
uniform float _LeftInnerRatio; // 左侧内部高亮区域占比
uniform float _RightInnerRatio; // 右侧内部高亮区域占比

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
        A = vec2(0.0, 0.5);
        C = vec2(1.0, 0.5);
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
    // 改进的抗锯齿计算，在低线宽时提供更好的控制
    
    // 基础抗锯齿范围，受_StrokeAA参数影响
    float baseAA = fwidth(dist) * _StrokeAA;
    
    // 动态调整最小/最大抗锯齿范围
    float minAA = lineWidth * 0.1 * _StrokeAA;  // 更灵活的最小值
    float maxAA = lineWidth * 0.8;  // 保持对粗线条的限制
    
    // 应用抗锯齿范围
    float aa = clamp(baseAA, minAA, maxAA);
    return smoothstep(lineWidth + aa, lineWidth - aa, abs(dist));
}

vec4 getStopColor(float mode, float beat) {
    if(abs(mode-0.0)<0.5) return _ColorStops0;
    if(abs(mode-1.0)<0.5) return _ColorStops1;
    if(abs(mode-2.0)<0.5) return _ColorStops2;
    if(abs(mode-3.0)<0.5) return mix(_ColorStops0, _ColorStops2, beat);
    if(abs(mode-4.0)<0.5) return mix(_ColorStops1, _ColorStops2, beat);
    return _ColorStops0;
}

vec4 getColorFromGradient(float factor) {
    float beat = sin(_Time.y * _TimeSpeedUniform) * 0.5 + 0.5;
    vec4 leftColor = getStopColor(_LeftMode, beat);
    vec4 rightColor = getStopColor(_RightMode, beat);
    return mix(leftColor, rightColor, factor);
}

float getDynamicWidthCenter() {
    float t = _Time.y * _DynamicWidthSpeed;
    // 基础中心位置
    float baseCenter = _DynamicWidthCenter;
    // 计算最大允许动态范围(不超过左右宽度)
    float maxRange = min(_LeftWidth, _RightWidth) * 0.8;
    // 应用动态范围限制
    float effectiveRange = clamp(_DynamicWidthCenterRange, 0.01, maxRange);
    // 动态偏移量
    float offset = effectiveRange * sin(t);
    // 确保最终中心位置在有效范围内
    float center = clamp(baseCenter + offset, _LeftWidth, 1.0 - _RightWidth);
    return center;
}
//使用音量印象曲线角度_CurveAngle
float getCurveAngle() {
    float audioRange = _AudioMax - _AudioMin;
    float audioNormalized = (_AudioCurrent - _AudioMin) / audioRange;
    audioNormalized = clamp(audioNormalized * 0.5 + 0.5, 0.0, 1.0); // 映射到[0,1]
    float base = abs(_CurveAngle);
    float delta = base * audioNormalized * _AudioCurveInfluence;
    if (_CurveType < 0.5) {
        // 向上
        return base + delta;
    } else {
        // 向下
        return _CurveAngle + delta;
    }
}

//根据音量获取辉光强度
float getGlowIntensity() {
    float audioRange = _AudioMax - _AudioMin;
    float audioNormalized = (_AudioCurrent - _AudioMin) / audioRange;
    audioNormalized = clamp(audioNormalized, 0.0, 1.0); // 保证范围
    float influenced = _GlowIntensity * (_GlowBaseRatio + (1.0 - _GlowBaseRatio) * audioNormalized);
    return influenced;
}

void main() {
    vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);

    //获取渐变的颜色
    vec4 rampColor = getColorFromGradient(uvCoord.x);
    vec4 glowColor = rampColor;

    uvCoord = vec2(uv.x, uv.y);

    // 获取曲线角度
    float CurveAngle = _CurveAngle;
    if(_IsDynamicCurve == 1.0) {
      CurveAngle = getCurveAngle();
    }else {
      CurveAngle = _CurveAngle;
    }
    
    // 计算贝塞尔曲线绘制
    vec2 A_single, C_single;
    getCurvePoints(_CurveType, A_single, C_single);
    vec2 B_single = getBezierControlPoint(CurveAngle, A_single, C_single);
    float signedDist = sd_bezier_signed(uvCoord, A_single, B_single, C_single);

    vec2 grad = vec2(dFdx(signedDist), dFdy(signedDist));
    float gradient = length(grad);
    float globalAARange = clamp(gradient * 2.0, 0.005, 0.15);

    // 双向平滑过渡
    float normalizedDist = signedDist / globalAARange;
    float alphaTransition = smoothstep(-0.5, 0.5, normalizedDist);


    //获取动态宽度中心
    float center;
    if(_IsDynamicWidthCenter == 1.0) {
      center = getDynamicWidthCenter();
    } else {
      center = _DynamicWidthCenter;
    }
    /*
    //线条从中间到两侧逐渐减少宽度
    float widthCenter = _LineWidth;         // 中间最大线宽
    float widthEdge = _LineWidth * 0.3;     // 两侧最小线宽，可调
    // 修改中心点
    float t = pow(abs(uvCoord.x - center) / max(center, 1.0-center), _DynamicWidthFalloff);
    t = max(0.0, t - _ColorRegion); // _ColorRegion 越大，彩色区域越窄
    float dynamicLineWidth = mix(widthCenter, widthEdge, t);
    */
        // 基于中心位置的控制点
    float centerPos = center; // 使用统一中心位置
    float leftWidth = _LeftWidth; // 左侧总宽度
    float rightWidth = _RightWidth; // 右侧总宽度
    float leftInnerRatio = _LeftInnerRatio; // 左侧内部高亮区域占比
    float rightInnerRatio = _RightInnerRatio; // 右侧内部高亮区域占比
    
    // 计算控制点位置
    float outerLeft = centerPos - leftWidth;
    float innerLeft = centerPos - leftWidth * leftInnerRatio;
    float innerRight = centerPos + rightWidth * rightInnerRatio;
    float outerRight = centerPos + rightWidth;
    
    float xPos = uvCoord.x;
    float alpha = 0.0;
    
    if (xPos >= outerLeft && xPos < innerLeft) {
      alpha = (xPos - outerLeft) / (innerLeft - outerLeft);
    } else if (xPos >= innerLeft && xPos <= innerRight) {
      alpha = 1.0;
    } else if (xPos > innerRight && xPos <= outerRight) {
      alpha = 1.0 - (xPos - innerRight) / (outerRight - innerRight);
    }

    //计算静宽
    float lineStroke = antiAliasedStroke(abs(signedDist), _LineWidth/10.0)* alpha;

    vec4 linecolor = rampColor;

    vec3 finalColorRGB = vec3(0.0);
    float finalAlpha = 1.0;

    // --- 辉光效果 begin ---
    float glowWidthCenter = _GlowWidth;
    float glowWidthEdge = _GlowWidth * 0.15; // 辉光两侧最小宽度
    float glowPower = _GlowPower;
    float glowIntensity = getGlowIntensity();
    float glowOffset = 0.01; 

    float glowt = pow(abs(uvCoord.x - center) / max(center, 1.0-center), _DynamicWidthFalloff);
    glowt = max(0.0, glowt - _GlowRegion*3.5); // _ColorRegion 越大，彩色区域越窄
    float dynamicLineGlowWidth = mix(glowWidthCenter, glowWidthEdge, glowt);
    
    float glow = 0.0;
    float distanceFromLine = (signedDist - _LineWidth*0.9/10.0) + glowOffset;
    float glowStart = dynamicLineGlowWidth - _GlowSoft;
    float glowEnd = dynamicLineGlowWidth + _GlowWidth;
    float glowAA = max(fwidth(distanceFromLine), 0.001); // 加入抗锯齿
    glow = 1.0 - smoothstep(glowStart - glowAA, glowEnd + glowAA, abs(distanceFromLine));
    glow = pow(glow, _GlowPower);

    // --- 辉光效果 end ---
    finalAlpha = 0.0;

    // 计算边界过渡抗锯齿
    float transitionRange = max(max(fwidth(signedDist)*2.0, 0.005) * (_LineWidth*2.0), 0.0045); // 增加过渡范围，避免锯齿

    float inner_base_alpha = smoothstep(0.0, -transitionRange, signedDist - _LineWidth*1.0/10.0);
    float line_base_alpha = smoothstep(0.0, -transitionRange, signedDist);
    float lineStrokeAA = smoothstep(0.0, 1.0, lineStroke);
    vec3 insidecolor = mix(_InsideColor.rgb, linecolor.rgb, lineStrokeAA);

    // 2. 内部区域处理（单向过渡）
    if (signedDist < _LineWidth *1.0/10.0) {
        finalColorRGB = _InsideColor.rgb;
        finalAlpha = inner_base_alpha * _InsideAlpha;
    }


    float final_stroke_alpha = lineStroke;
    vec4 stroke_layer = linecolor * final_stroke_alpha;

    // 使用max混合实现变亮效果
    finalColorRGB = max(stroke_layer.rgb, finalColorRGB);
    finalAlpha = max(stroke_layer.a, finalAlpha);
    
    float upperGlowMask = 0.0;
    if(_Glowmask == 0.0) {
        upperGlowMask = smoothstep(-0.01, 0.0, signedDist - _LineWidth * 0.9/10.0);
    }

    if (_Glowmask == 1.0) {
        upperGlowMask = smoothstep(-0.001, -0.005, signedDist + _LineWidth * 1.0/10.0);
    }

    if (_Glowmask == 2.0) {
        upperGlowMask = 1.0;
    }

    glow = glow * upperGlowMask * alpha;

    // 辉光部分使用加法混合
    finalColorRGB = glowColor.rgb * glow * glowIntensity + finalColorRGB * (1.0 - glow * glowIntensity);
    finalAlpha = glow * glowIntensity + finalAlpha * (1.0 - glow * glowIntensity);
    
    
    // 限制alpha值不超过1.0
    finalAlpha = min(finalAlpha, 1.0);
    gl_FragColor = vec4(finalColorRGB , finalAlpha);
}
`;

const materials: Material[] = [];

// 颜色转换函数
function hexToRgba (hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: 1.0,
  } : null;
}

function rgbaToHex (r: number, g: number, b: number, a: number = 1.0) {
  return '#' + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
}

// 创建UI控制面板
function createControlPanel () {
  const existingPanel = document.getElementById('control-panel');

  if (existingPanel) {
    existingPanel.remove();
  }
  const panel = document.createElement('div');

  panel.id = 'control-panel';
  panel.innerHTML = `
    <style>
      #control-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        background: rgba(42, 42, 42, 0.95);
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 1000;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      
      .control-group {
        margin-bottom: 20px;
        padding: 15px;
        background: rgba(51, 51, 51, 0.8);
        border-radius: 8px;
      }
      
      .control-group h3 {
        margin: 0 0 15px 0;
        color: #4CAF50;
        border-bottom: 1px solid #555;
        padding-bottom: 8px;
        font-size: 16px;
      }
      
      .control-item {
        margin-bottom: 15px;
      }
      
      .control-item label {
        display: block;
        margin-bottom: 5px;
        font-size: 12px;
        color: #ccc;
      }
      
      .control-item input[type="range"] {
        width: 100%;
        margin-bottom: 5px;
        height: 6px;
        border-radius: 3px;
        background: #555;
        outline: none;
      }
      
      .control-item input[type="range"]::-webkit-slider-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4CAF50;
        cursor: pointer;
        -webkit-appearance: none;
      }
      
      .control-item .value-display {
        font-size: 11px;
        color: #888;
        text-align: right;
      }
      
      .color-input {
        width: 100%;
        height: 35px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .reset-btn {
        background: #f44336;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
        margin-top: 10px;
        font-size: 14px;
      }
      
      .reset-btn:hover {
        background: #d32f2f;
      }
      
      .toggle-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #2196F3;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
    </style>
    <button class="toggle-btn" onclick="togglePanel()">收起</button>
    <h2 style="margin-top: 0; color: #4CAF50;">Aurora + Bezier Shader Controls</h2>
    <div class="control-group">
      <h3>贝塞尔曲线</h3>
      <div class="control-item">
        <label>曲线类型:</label>
        <div style="margin: 5px 0;">
          <label><input type="radio" name="curve-type" value="0" checked> 向上曲线 (0,0)→(1,0)</label><br>
          <label><input type="radio" name="curve-type" value="1"> 向下曲线 (0,1)→(1,1)</label><br>
        </div>
      </div>
      <div class="control-item">
        <label for="curveAngle">曲线角度</label>
        <input type="range" id="curveAngle" min="-1.57" max="1.57" step="0.1" value="0.5">
        <div class="value-display" id="curveAngle-value">0.5</div>
      </div>

      <div class="control-item">
        <label for="lineWidth">线条宽度</label>
        <input type="range" id="lineWidth" min="0.001" max="0.5" step="0.001" value="0.01">
        <div class="value-display" id="lineWidth-value">0.01</div>
      </div>
      <div class="control-item">
        <label for="strokeAA">线条虚实度 (_StrokeAA)</label>
        <input type="range" id="strokeAA" min="0.1" max="30.0" step="0.01" value="2.0">
        <div class="value-display" id="strokeAA-value">2.00</div>
      </div>
      <div class="control-item">
        <label for="isDynamicCurve">动态曲率开关 (_IsDynamicCurve)</label>
        <input type="checkbox" id="isDynamicCurve">
      </div>
    </div>
    <div class="control-group">
      <h3>噪声动画</h3>
      <div class="control-item">
        <label for="timeSpeedUniform">Time Speed (时间速度)</label>
        <input type="range" id="timeSpeedUniform" min="0" max="50" step="0.1" value="4.1">
        <div class="value-display" id="timeSpeedUniform-value">4.1</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>颜色渐变</h3>
      <div class="control-item">
        <label for="leftMode">左端色模式</label>
        <select id="leftMode">
          <option value="0">Stop0</option>
          <option value="1">Stop1</option>
          <option value="2">Stop2</option>
          <option value="3" selected>Stop0↔Stop2 动态</option>
          <option value="4">Stop1↔Stop2 动态</option>
        </select>
      </div>
      <div class="control-item">
        <label for="rightMode">右端色模式</label>
        <select id="rightMode">
          <option value="0">Stop0</option>
          <option value="1" selected>Stop1</option>
          <option value="2">Stop2</option>
          <option value="3">Stop0↔Stop2 动态</option>
          <option value="4">Stop1↔Stop2 动态</option>
        </select>
      </div>
      <div class="control-item">
        <label for="colorStop0">Color Stop 0 (色1)</label>
        <input type="color" id="colorStop0" class="color-input" value="#5226ff">
      </div>
      <div class="control-item">
        <label for="colorStop1">Color Stop 1 (色2)</label>
        <input type="color" class="color-input" id="colorStop1" value="#7dff66">
      </div>
      <div class="control-item">
        <label for="colorStop2">Color Stop 2 (色3)</label>
        <input type="color" id="colorStop2" value="#5226ff">
      </div>
    </div>
    
    <div class="control-group">
      <h3>内部颜色</h3>
      <div class="control-item">
        <label for="insideColor">内侧颜色</label>
        <input type="color" id="insideColor" class="color-input" value="#000000">
      </div>
      <div class="control-item">
        <label for="insideAlpha">内侧透明度</label>
        <input type="range" id="insideAlpha" min="0" max="1" step="0.1" value="1.0">
        <div class="value-display" id="insideAlpha-value">1.0</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>辉光效果</h3>
      <div class="control-item">
        <label for="glowWidth">辉光范围 (_GlowWidth)</label>
        <input type="range" id="glowWidth" min="0" max="5.0" step="0.001" value="0.05">
        <div class="value-display" id="glowWidth-value">0.05</div>
      </div>
      <div class="control-item">
        <label for="glowSoft">辉光柔和度 (_GlowSoft)</label>
        <input type="range" id="glowSoft" min="0" max="0.2" step="0.001" value="0.03">
        <div class="value-display" id="glowSoft-value">0.03</div>
      </div>
      <div class="control-item">
        <label for="glowPower">辉光衰减 (_GlowPower)</label>
        <input type="range" id="glowPower" min="0.1" max="5" step="0.01" value="2.0">
        <div class="value-display" id="glowPower-value">2.0</div>
      </div>
      <div class="control-item">
        <label for="glowIntensity">辉光强度 (_GlowIntensity)</label>
        <input type="range" id="glowIntensity" min="0" max="2" step="0.01" value="0.8">
        <div class="value-display" id="glowIntensity-value">0.8</div>
      </div>
      <div class="control-item">
        <label for="glowBaseRatio">辉光基础比例 (_GlowBaseRatio)</label>
        <input type="range" id="glowBaseRatio" min="0" max="1" step="0.01" value="0.5">
        <div class="value-display" id="glowBaseRatio-value">0.50</div>
      </div>
      <div class="control-item">
        <label for="glowmaskMode">辉光显示模式 (_Glowmask)</label>
        <select id="glowmaskMode">
          <option value="0">只在上</option>
          <option value="1">只在下</option>
          <option value="2">上下都有</option>
        </select>
      </div>
    </div>
    
    <div class="control-group">
      <h3>线宽衰减</h3>
      <div class="control-item">
        <label for="leftWidth">左侧宽度 (_LeftWidth)</label>
        <input type="range" id="leftWidth" min="0" max="0.5" step="0.01" value="0.2">
        <div class="value-display" id="leftWidth-value">0.20</div>
      </div>
      <div class="control-item">
        <label for="rightWidth">右侧宽度 (_RightWidth)</label>
        <input type="range" id="rightWidth" min="0" max="0.5" step="0.01" value="0.2">
        <div class="value-display" id="rightWidth-value">0.20</div>
      </div>
      <div class="control-item">
        <label for="leftInnerRatio">左侧内部高亮占比 (_LeftInnerRatio)</label>
        <input type="range" id="leftInnerRatio" min="0" max="1" step="0.01" value="0.5">
        <div class="value-display" id="leftInnerRatio-value">0.50</div>
      </div>
      <div class="control-item">
        <label for="rightInnerRatio">右侧内部高亮占比 (_RightInnerRatio)</label>
        <input type="range" id="rightInnerRatio" min="0" max="1" step="0.01" value="0.5">
        <div class="value-display" id="rightInnerRatio-value">0.50</div>
      </div>
      <div class="control-item">
        <label for="dynamicWidthFalloff">线宽衰减力度 (_DynamicWidthFalloff)</label>
        <input type="range" id="dynamicWidthFalloff" min="0" max="4" step="0.01" value="1.0">
        <div class="value-display" id="dynamicWidthFalloff-value">1.00</div>
      </div>
      <div class="control-item">
        <label for="colorRegion">彩色区域宽度 (_ColorRegion)</label>
        <input type="range" id="colorRegion" min="-5" max="5" step="0.01" value="0.0">
        <div class="value-display" id="colorRegion-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="glowRegion">辉光区域宽度 (_GlowRegion)</label>
        <input type="range" id="glowRegion" min="-5" max="5" step="0.01" value="0.0">
        <div class="value-display" id="glowRegion-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="dynamicWidthCenter">线宽衰减中心 (_DynamicWidthCenter)</label>
        <input type="range" id="dynamicWidthCenter" min="0" max="1" step="0.001" value="0.5">
        <div class="value-display" id="dynamicWidthCenter-value">0.50</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>线宽中心动态滑动</h3>
      <div class="control-item">
        <label for="dynamicWidthCenterRange">滑动范围 (_DynamicWidthCenterRange)</label>
        <input type="range" id="dynamicWidthCenterRange" min="0" max="0.5" step="0.01" value="0.4">
        <div class="value-display" id="dynamicWidthCenterRange-value">0.40</div>
      </div>
      <div class="control-item">
        <label for="dynamicWidthSpeed">滑动速度 (_DynamicWidthSpeed)</label>
        <input type="range" id="dynamicWidthSpeed" min="0" max="20" step="0.01" value="0.5">
        <div class="value-display" id="dynamicWidthSpeed-value">0.50</div>
      </div>
      <div class="control-item">
        <label for="isDynamicWidthCenter">动态滑动开关 (_IsDynamicWidthCenter)</label>
        <input type="checkbox" id="isDynamicWidthCenter" checked>
      </div>
    </div>
    
    
    <div class="control-item">
      <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
    </div>
    <div class="control-group">
      <h3>音量参数</h3>
      <div class="control-item">
        <label for="minVolume">最小音量 (_AudioMin)</label>
        <input type="range" id="minVolume" min="0" max="1" step="0.01" value="0.0">
        <div class="value-display" id="minVolume-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="maxVolume">最大音量 (_AudioMax)</label>
        <input type="range" id="maxVolume" min="0" max="1" step="0.01" value="1.0">
        <div class="value-display" id="maxVolume-value">1.00</div>
      </div>
      <div class="control-item">
        <label for="audioCurveInfluence">音量曲率影响 (_AudioCurveInfluence)</label>
        <input type="range" id="audioCurveInfluence" min="0" max="2" step="0.01" value="0.5">
        <div class="value-display" id="audioCurveInfluence-value">0.50</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
}

// 初始化UI控制
function initializeControls () {
  // 贝塞尔曲线类型控制
  const curveTypeRadios = document.querySelectorAll('input[name="curve-type"]');

  curveTypeRadios.forEach(radio => {
    radio.addEventListener('change', e => {
      const value = parseFloat((e.target as HTMLInputElement).value);

      materials.forEach(material => {
        material.setFloat('_CurveType', value);
      });
      shaderParams.curveType = value;
    });
  });

  // 数值滑块控制
  const controls = [
    'curveAngle', 'lineWidth', 'insideAlpha', 'timeSpeed',
    'amplitude', 'blend', 'audioInfluence', 'audioMultiplier', 'timeSpeedUniform',
    'noiseScale', 'heightMultiplier', 'midPoint', 'intensityMultiplier', 'yOffset',
    'glowWidth', 'glowSoft', 'glowPower', 'glowIntensity',
    'dynamicWidthFalloff', 'colorRegion', 'glowRegion', 'dynamicWidthCenter',
    'dynamicWidthCenterRange', 'dynamicWidthSpeed',
    'audioCurveInfluence', // 新增到控件列表
    'glowBaseRatio', // 新增到控件列表
    'strokeAA', // 新增到控件列表
    'leftWidth', // 新增左侧宽度控制
    'rightWidth', // 新增右侧宽度控制
    'leftInnerRatio', // 新增左侧内部高亮占比控制
    'rightInnerRatio', // 新增右侧内部高亮占比控制
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      slider.value = (shaderParams as any)[controlName]?.toString() || '0';
      valueDisplay.textContent = (shaderParams as any)[controlName]?.toString() || '0';

      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(2);

        const uniformName = `_${controlName.charAt(0).toUpperCase()}${controlName.slice(1)}`;

        materials.forEach(material => {
          material.setFloat(uniformName, value);
        });
        (shaderParams as any)[controlName] = value;
      });
    }
  });

  // 音量参数滑块控制
  ['minVolume', 'maxVolume'].forEach(param => {
    const slider = document.getElementById(param) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${param}-value`);

    if (slider && valueDisplay) {
      slider.value = shaderParams[param].toString();
      valueDisplay.textContent = shaderParams[param].toFixed(2);
      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(2);
        shaderParams[param] = value;
        materials.forEach(material => {
          material.setFloat(`_${param.charAt(0).toUpperCase()}${param.slice(1)}`, value);
        });
      });
    }
  });

  // 颜色控制
  ['colorStop0', 'colorStop1', 'colorStop2'].forEach((colorName, index) => {
    const colorPicker = document.getElementById(colorName) as HTMLInputElement;

    if (colorPicker) {
      const color = shaderParams.colorStops[index];

      colorPicker.value = rgbaToHex(color.x, color.y, color.z, color.w);
      colorPicker.addEventListener('input', e => {
        const rgba = hexToRgba((e.target as HTMLInputElement).value);

        if (rgba) {
          shaderParams.colorStops[index] = { x: rgba.r, y: rgba.g, z: rgba.b, w: 1.0 };
          materials.forEach(material => {
            material.setVector4(`_ColorStops${index}`, new math.Vector4(rgba.r, rgba.g, rgba.b, 1.0));
          });
        }
      });
    }
  });

  // 内部颜色
  const insideColorPicker = document.getElementById('insideColor') as HTMLInputElement;

  if (insideColorPicker) {
    insideColorPicker.value = rgbaToHex(
      shaderParams.insideColor.x,
      shaderParams.insideColor.y,
      shaderParams.insideColor.z,
      shaderParams.insideColor.w
    );
    insideColorPicker.addEventListener('input', e => {
      const rgba = hexToRgba((e.target as HTMLInputElement).value);

      if (rgba) {
        shaderParams.insideColor = { x: rgba.r, y: rgba.g, z: rgba.b, w: 1.0 };
        materials.forEach(material => {
          material.setVector4('_InsideColor', new math.Vector4(rgba.r, rgba.g, rgba.b, 1.0));
        });
      }
    });
  }

  // 左右端色模式
  ['leftMode', 'rightMode'].forEach((modeName, idx) => {
    const select = document.getElementById(modeName) as HTMLSelectElement;

    if (select) {
      select.value = (shaderParams as any)[modeName]?.toString() || '0';
      select.addEventListener('change', e => {
        const value = parseFloat((e.target as HTMLSelectElement).value);
        const uniformName = idx === 0 ? '_LeftMode' : '_RightMode';

        materials.forEach(material => {
          material.setFloat(uniformName, value);
        });
        (shaderParams as any)[modeName] = value;
      });

      materials.forEach(material => {
        material.setFloat(idx === 0 ? '_LeftMode' : '_RightMode', (shaderParams as any)[modeName] || 0);
      });
    }
  });

  // 新增动态宽度中心相关控件事件监听
  const dynamicWidthCenterRangeSlider = document.getElementById('dynamicWidthCenterRange') as HTMLInputElement;
  const dynamicWidthCenterRangeValue = document.getElementById('dynamicWidthCenterRange-value');

  if (dynamicWidthCenterRangeSlider && dynamicWidthCenterRangeValue) {
    dynamicWidthCenterRangeSlider.value = shaderParams.dynamicWidthCenterRange.toString();
    dynamicWidthCenterRangeValue.textContent = shaderParams.dynamicWidthCenterRange.toFixed(2);
    dynamicWidthCenterRangeSlider.addEventListener('input', e => {
      const value = parseFloat((e.target as HTMLInputElement).value);

      dynamicWidthCenterRangeValue.textContent = value.toFixed(2);
      shaderParams.dynamicWidthCenterRange = value;
      materials.forEach(material => {
        material.setFloat('_DynamicWidthCenterRange', value);
      });
    });
  }
  const dynamicWidthSpeedSlider = document.getElementById('dynamicWidthSpeed') as HTMLInputElement;
  const dynamicWidthSpeedValue = document.getElementById('dynamicWidthSpeed-value');

  if (dynamicWidthSpeedSlider && dynamicWidthSpeedValue) {
    dynamicWidthSpeedSlider.value = shaderParams.dynamicWidthSpeed.toString();
    dynamicWidthSpeedValue.textContent = shaderParams.dynamicWidthSpeed.toFixed(2);
    dynamicWidthSpeedSlider.addEventListener('input', e => {
      const value = parseFloat((e.target as HTMLInputElement).value);

      dynamicWidthSpeedValue.textContent = value.toFixed(2);
      shaderParams.dynamicWidthSpeed = value;
      materials.forEach(material => {
        material.setFloat('_DynamicWidthSpeed', value);
      });
    });
  }
  const isDynamicWidthCenterCheckbox = document.getElementById('isDynamicWidthCenter') as HTMLInputElement;

  if (isDynamicWidthCenterCheckbox) {
    isDynamicWidthCenterCheckbox.checked = !!shaderParams.isDynamicWidthCenter;
    isDynamicWidthCenterCheckbox.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked;

      shaderParams.isDynamicWidthCenter = checked ? 1.0 : 0.0;
      materials.forEach(material => {
        material.setFloat('_IsDynamicWidthCenter', checked ? 1.0 : 0.0);
      });
    });
  }

  // 动态曲率开关
  const isDynamicCurveCheckbox = document.getElementById('isDynamicCurve') as HTMLInputElement;

  if (isDynamicCurveCheckbox) {
    isDynamicCurveCheckbox.checked = !!shaderParams.isDynamicCurve;
    isDynamicCurveCheckbox.addEventListener('change', e => {
      const checked = (e.target as HTMLInputElement).checked;

      shaderParams.isDynamicCurve = checked ? 1.0 : 0.0;
      materials.forEach(material => {
        material.setFloat('_IsDynamicCurve', shaderParams.isDynamicCurve);
      });
    });
    // 初始化同步一次
    materials.forEach(material => {
      material.setFloat('_IsDynamicCurve', shaderParams.isDynamicCurve);
    });
  }

  // 新增辉光模式控件事件监听
  const glowmaskModeSelect = document.getElementById('glowmaskMode') as HTMLSelectElement;

  if (glowmaskModeSelect) {
    glowmaskModeSelect.value = (shaderParams.glowmask).toString();
    glowmaskModeSelect.addEventListener('change', e => {
      const value = parseInt((e.target as HTMLSelectElement).value, 10);

      shaderParams.glowmask = value;
      materials.forEach(material => {
        material.setFloat('_Glowmask', value);
      });
    });
  }
}

// 重置为默认值
function resetToDefaults () {
  const defaults = {
    amplitude: 1.0,
    audioInfluence: 1.0,
    audioMultiplier: 2.0,
    blend: 0.5,
    timeSpeedUniform: 4.1,
    noiseScale: 2.0,
    heightMultiplier: 0.5,
    midPoint: 0.20,
    intensityMultiplier: 0.6,
    yOffset: 0.2,
    curveAngle: 0.5,
    curveType: 0.0,
    lineWidth: 0.084,
    insideAlpha: 1.0,
    timeSpeed: 4.100,
    leftMode: 3,
    rightMode: 1,
    glowWidth: 0.162,
    glowSoft: 0.03,
    glowPower: 2.0,
    glowIntensity: 0.830,
    dynamicWidthFalloff: 3.250,
    colorRegion: -1.270,
    glowRegion: -0.010,
    dynamicWidthCenter: 0.5,
    dynamicWidthCenterRange: 0.1,
    dynamicWidthSpeed: 0.5,
    isDynamicWidthCenter: 1.0,
    isDynamicCurve: 0.0,
    glowmask: 0,
    minVolume: 0.0,
    maxVolume: 1.0,
    audioCurveInfluence: 0.5,
    glowBaseRatio: 0.5,
    strokeAA: 2.0,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = value.toString();
      valueDisplay.textContent = typeof value === 'number' ? value.toFixed(2) : value;

      // 生成对应的uniform名称
      const uniformName = `_${key.charAt(0).toUpperCase()}${key.slice(1)}`;

      materials.forEach(material => {
        material.setFloat(uniformName, value);
      });

      (shaderParams as any)[key] = value;
    }
  });

  // 重置颜色
  const defaultColors = [
    '#5226ff', '#7dff66', '#A724FF',
  ];

  defaultColors.forEach((hex, index) => {
    const colorPicker = document.getElementById(`colorStop${index}`) as HTMLInputElement;

    if (colorPicker) {
      colorPicker.value = hex;
      const rgba = hexToRgba(hex);

      if (rgba) {
        shaderParams.colorStops[index] = { x: rgba.r, y: rgba.g, z: rgba.b, w: 1.0 };
        materials.forEach(material => {
          material.setVector4(`_ColorStops${index}`, new math.Vector4(rgba.r, rgba.g, rgba.b, 1.0));
        });
      }
    }
  });

  // 重置内部颜色
  const insideColorPicker = document.getElementById('insideColor') as HTMLInputElement;

  if (insideColorPicker) {
    insideColorPicker.value = '#000000';
    shaderParams.insideColor = { x: 0, y: 0, z: 0, w: 1.0 };
    materials.forEach(material => {
      material.setVector4('_InsideColor', new math.Vector4(0, 0, 0, 1.0));
    });
  }
}

// 切换面板显示/隐藏
function togglePanel () {
  const panel = document.getElementById('control-panel');
  const toggleBtn = panel?.querySelector('.toggle-btn') as HTMLButtonElement;

  if (panel && toggleBtn) {
    const groups = panel.querySelectorAll('.control-group, h2, .reset-btn');
    const isHidden = panel.style.height === '40px';

    if (isHidden) {
      panel.style.height = 'auto';
      groups.forEach(group => (group as HTMLElement).style.display = 'block');
      toggleBtn.textContent = '收起';
    } else {
      panel.style.height = '40px';
      groups.forEach(group => (group as HTMLElement).style.display = 'none');
      toggleBtn.textContent = '展开';
    }
  }
}

// 将函数暴露给全局作用域
(window as any).resetToDefaults = resetToDefaults;
(window as any).togglePanel = togglePanel;

(async () => {
  const player = new Player({
    container,
    interactive: true,
    onError: (err: Error, ...args: any[]) => {
      console.error(err.message);
    },
  });

  const jsonValue = await getJSON(json);

  // 初始化材质属性
  jsonValue.materials[0].floats = jsonValue.materials[0].floats || {};
  jsonValue.materials[0].vector3s = jsonValue.materials[0].vector3s || {};
  jsonValue.materials[0].textures = jsonValue.materials[0].textures || {};

  // 设置贝塞尔参数默认值
  jsonValue.materials[0].floats['_CurveAngle'] = shaderParams.curveAngle;
  jsonValue.materials[0].floats['_CurveType'] = shaderParams.curveType;
  jsonValue.materials[0].floats['_LineWidth'] = shaderParams.lineWidth;
  jsonValue.materials[0].floats['_InsideAlpha'] = shaderParams.insideAlpha;

  // 设置氛围光参数默认值
  jsonValue.materials[0].floats['_TimeSpeedUniform'] = shaderParams.timeSpeedUniform;

  // 设置颜色
  jsonValue.materials[0].vector3s['_InsideColor'] = shaderParams.insideColor;
  shaderParams.colorStops.forEach((color, index) => {
    jsonValue.materials[0].vector3s[`_ColorStops${index}`] = color;
  });

  // 设置模式参数
  jsonValue.materials[0].floats['_LeftMode'] = shaderParams.leftMode;
  jsonValue.materials[0].floats['_RightMode'] = shaderParams.rightMode;

  // 设置辉光参数
  jsonValue.materials[0].floats['_GlowWidth'] = shaderParams.glowWidth;
  jsonValue.materials[0].floats['_GlowSoft'] = shaderParams.glowSoft;
  jsonValue.materials[0].floats['_GlowPower'] = shaderParams.glowPower;
  jsonValue.materials[0].floats['_GlowIntensity'] = shaderParams.glowIntensity;

  // 设置线宽衰减参数
  jsonValue.materials[0].floats['_DynamicWidthFalloff'] = shaderParams.dynamicWidthFalloff;
  jsonValue.materials[0].floats['_ColorRegion'] = shaderParams.colorRegion;
  jsonValue.materials[0].floats['_GlowRegion'] = shaderParams.glowRegion;
  jsonValue.materials[0].floats['_LeftWidth'] = shaderParams.leftWidth;
  jsonValue.materials[0].floats['_RightWidth'] = shaderParams.rightWidth;
  jsonValue.materials[0].floats['_LeftInnerRatio'] = shaderParams.leftInnerRatio;
  jsonValue.materials[0].floats['_RightInnerRatio'] = shaderParams.rightInnerRatio;
  jsonValue.materials[0].floats['_DynamicWidthCenter'] = shaderParams.dynamicWidthCenter;

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;

  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_3');

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    for (const component of rendererComponents) {
      const { materials: componentMaterials } = component;

      for (const material of componentMaterials) {
        // 使用加法混合实现变亮效果
        setBlendMode(material, spec.BlendingMode.ADD);
        material.depthMask = false;

        // 设置所有贝塞尔uniform参数
        material.setFloat('_CurveAngle', shaderParams.curveAngle);
        material.setFloat('_CurveType', shaderParams.curveType);
        material.setFloat('_LineWidth', shaderParams.lineWidth);
        material.setFloat('_InsideAlpha', shaderParams.insideAlpha);

        // 设置所有氛围光uniform参数
        material.setFloat('_TimeSpeedUniform', shaderParams.timeSpeedUniform);

        // 设置内部颜色
        material.setVector3('_InsideColor', new math.Vector3(
          shaderParams.insideColor.x,
          shaderParams.insideColor.y,
          shaderParams.insideColor.z
        ));

        // 设置左右端色模式
        material.setFloat('_LeftMode', shaderParams.leftMode);
        material.setFloat('_RightMode', shaderParams.rightMode);

        // 设置辉光参数
        material.setFloat('_GlowWidth', shaderParams.glowWidth);
        material.setFloat('_GlowSoft', shaderParams.glowSoft);
        material.setFloat('_GlowPower', shaderParams.glowPower);
        material.setFloat('_GlowIntensity', shaderParams.glowIntensity);

        // 设置线宽衰减参数
        material.setFloat('_DynamicWidthFalloff', shaderParams.dynamicWidthFalloff);
        material.setFloat('_ColorRegion', shaderParams.colorRegion);
        material.setFloat('_GlowRegion', shaderParams.glowRegion);

        //设置线条左右滑动通过设置_DynamicWidthCenter

        material.setFloat('_DynamicWidthCenter', shaderParams.dynamicWidthCenter);
        material.setFloat('_DynamicWidthCenterRange', shaderParams.dynamicWidthCenterRange);
        material.setFloat('_DynamicWidthSpeed', shaderParams.dynamicWidthSpeed);
        material.setFloat('_IsDynamicWidthCenter', shaderParams.isDynamicWidthCenter ? 1.0 : 0.0);

        //设置辉光在上还是在下
        material.setFloat('_Glowmask', shaderParams.glowmask);

        //设置音量参数（min/max UI控制，current模拟）
        material.setFloat('_AudioMin', shaderParams.minVolume);
        material.setFloat('_AudioMax', shaderParams.maxVolume);
        // 用sin模拟audioCurrent（初始化时赋值，后续用 requestAnimationFrame 动态更新）
        material.setFloat('_AudioCurrent', clamp(0, 1, Math.sin(Date.now() * 0.001)));

        // 设置是否需要开启动态曲率
        material.setFloat('_IsDynamicCurve', shaderParams.isDynamicCurve);
        // 设置颜色停止点
        shaderParams.colorStops.forEach((color, index) => {
          material.setVector3(`_ColorStops${index}`, new math.Vector3(color.x, color.y, color.z));
        });

        //setBlendMode(material, spec.BlendingMode.ALPHA);
        materials.push(material);
      }
    }
  }

  // 创建并初始化UI控制面板
  createControlPanel();
  initializeControls();
  // 启动时自动重置一次参数和UI
  resetToDefaults();

  // 用 requestAnimationFrame 动态同步 audioCurrent 到 shader
  function updateAudioCurrent () {
    // 用 sin 动态模拟 currentVolume，需要接入真实音量
    const t = Date.now() * 0.001;
    const audioCurrent = Math.sin(t);

    shaderParams.currentVolume = audioCurrent;
    materials.forEach(material => {
      material.setFloat('_AudioCurrent', audioCurrent);
    });
    requestAnimationFrame(updateAudioCurrent);
  }
  updateAudioCurrent();

  player.play();

  window.addEventListener('beforeunload', () => {
  });
})();

function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}
