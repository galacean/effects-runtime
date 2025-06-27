/* eslint-disable no-case-declarations */
import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';
import { Vector3 } from '@galacean/effects-plugin-model';
import type { AudioData } from './audio-state-machine';
import AudioSimulator from './audio-state-machine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*BIRER6z6IKoAAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数
// 1. 统一参数定义（保持原有结构）
const shaderParams = {
  curveAngle: 0.5,
  curveType: 0.0,
  lineWidth: 0.01,
  baseBloomIntensity: 0.4,
  bloomRange: 0.25,
  bloomTransitionRange: 0.05,
  gradientPower: 1.5,
  gradientCenterThreshold: 0.2,
  insideAlpha: 1.0,
  timeSpeed: 3.0,
  amplitude: 1.0,
  blend: 0.5,
  audioInfluence: 1.0,
  audioMultiplier: 2.0,
  uTimeSpeed: 4.1,
  noiseScale: 2.0,
  heightMultiplier: 0.5,
  midPoint: 0.20,
  intensityMultiplier: 0.6,
  yOffset: 0.2,
  lineColor: { x: 1.0, y: 1.0, z: 1.0 },
  purpleColor: { x: 0.6, y: 0.2, z: 0.8 },
  greenColor: { x: 0.2, y: 0.8, z: 0.3 },
  blueColor: { x: 0.2, y: 0.4, z: 1.0 },
  insideColor: { x: 0.0, y: 0.0, z: 0.0 },
  colorStops: [
    { x: 0.32, y: 0.15, z: 1.0 },
    { x: 0.49, y: 1.0, z: 0.40 },
    { x: 0.32, y: 0.15, z: 1.0 },
  ],
  barColorCenter: { x: 1.0, y: 1.0, z: 1.0 },
  barColorMiddle: { x: 0.576, y: 0.607, z: 0.808 },
  barColorEdge: { x: 0.0431, y: 0.059, z: 0.1 },
  leftMode: 3,
  rightMode: 1,
  // 新增辉光参数
  glowWidth: 0.05,
  glowSoft: 0.03,
  glowPower: 2.0,
  glowIntensity: 0.8,
};

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

const fragment = `precision highp float;

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
    float antiAliasWidth = max(dist * 1.0, 0.002);
    return smoothstep(lineWidth + antiAliasWidth, lineWidth - antiAliasWidth, dist);
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

    vec4 aurora = vec4(rampColor, 1.0);

    uvCoord = vec2(uv.x, uv.y);

    // 计算贝塞尔曲线绘制
    vec2 A_single, C_single;
    getCurvePoints(_CurveType, A_single, C_single);
    vec2 B_single = getBezierControlPoint(_CurveAngle, A_single, C_single);
    float signedDist = sd_bezier_signed(uvCoord, A_single, B_single, C_single);
    vec3 gradientColor = calculateGradientColor(abs(signedDist), uvCoord);
    float bloomIntensity = calculateBloomIntensity(abs(signedDist));
    float lineStroke = antiAliasedStroke(abs(signedDist), _LineWidth);
    vec3 finalColorRGB = vec3(0.0);
    float finalAlpha = 0.0;
    vec4 bgColor = aurora;
    vec3 auroraRampColor = rampColor;
    //finalColorRGB = aurora.rgb;
    finalAlpha = aurora.a;

    // --- 辉光效果 begin ---
    float glowWidth = _GlowWidth;
    float glowPower = _GlowPower;
    float glowIntensity = _GlowIntensity;
    vec3 glowColor = rampColor;

    // 只在曲线外侧（signedDist > _LineWidth）叠加辉光，且边界平滑
    float glow = 0.0;
    if (signedDist > 0.0) {
        glow = 1.0 - smoothstep(_LineWidth, _LineWidth + glowWidth, signedDist);
        glow = pow(glow, glowPower);
        // 让辉光在 _LineWidth 附近平滑开启
        //glow *= smoothstep(_LineWidth/2.0, _LineWidth/2.0 + 0.01, signedDist); // 0.01 可调
    }
    // --- 辉光效果 end ---
    finalColorRGB = glowColor * glow * glowIntensity;
    finalAlpha = 1.0;


    if(signedDist < 0.0) {
        finalColorRGB = _InsideColor;
        finalAlpha = max(bgColor.a, _InsideAlpha);
        bgColor= vec4(_InsideColor, _InsideAlpha);
    }
    if (signedDist >= 0.0) {
        bgColor.rgb = finalColorRGB;
        // 叠加辉光
        finalColorRGB = glowColor * glow * glowIntensity;

    }
    if (lineStroke > 0.0) {
        finalColorRGB = mix(bgColor.rgb, rampColor.rgb * _LineColor, lineStroke);
        finalAlpha = max(bgColor.a, lineStroke);
    }

    // 叠加辉光
    //finalColorRGB += glowColor * glow * glowIntensity;

    gl_FragColor = vec4(finalColorRGB , 1.0);
}
`;

const materials: Material[] = [];

// 颜色转换函数
function hexToRgb (hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : null;
}

function rgbToHex (r: number, g: number, b: number) {
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
        <input type="range" id="lineWidth" min="0.001" max="0.05" step="0.001" value="0.01">
        <div class="value-display" id="lineWidth-value">0.01</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>Bloom效果</h3>
      <div class="control-item">
        <label for="baseBloomIntensity">基础强度</label>
        <input type="range" id="baseBloomIntensity" min="0" max="2" step="0.1" value="0.4">
        <div class="value-display" id="baseBloomIntensity-value">0.4</div>
      </div>
      <div class="control-item">
        <label for="bloomRange">影响范围</label>
        <input type="range" id="bloomRange" min="0.05" max="0.5" step="0.01" value="0.25">
        <div class="value-display" id="bloomRange-value">0.25</div>
      </div>
      <div class="control-item">
        <label for="bloomTransitionRange">过渡范围</label>
        <input type="range" id="bloomTransitionRange" min="0.01" max="0.2" step="0.01" value="0.05">
        <div class="value-display" id="bloomTransitionRange-value">0.05</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>音频效果</h3>
      <div class="control-item">
        <label for="amplitude">Amplitude (振幅)</label>
        <input type="range" id="amplitude" min="0" max="3" step="0.1" value="1.0">
        <div class="value-display" id="amplitude-value">1.0</div>
      </div>
      <div class="control-item">
        <label for="audioInfluence">Audio Influence (音频影响)</label>
        <input type="range" id="audioInfluence" min="0" max="5" step="0.1" value="1.0">
        <div class="value-display" id="audioInfluence-value">1.0</div>
      </div>
      <div class="control-item">
        <label for="audioMultiplier">Audio Multiplier (音频倍数)</label>
        <input type="range" id="audioMultiplier" min="0" max="10" step="0.5" value="2.0">
        <div class="value-display" id="audioMultiplier-value">2.0</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>极光效果</h3>
      <div class="control-item">
        <label for="blend">Blend Factor (混合因子)</label>
        <input type="range" id="blend" min="0" max="2" step="0.05" value="0.5">
        <div class="value-display" id="blend-value">0.5</div>
      </div>
      <div class="control-item">
        <label for="midPoint">Mid Point (中点位置)</label>
        <input type="range" id="midPoint" min="0" max="1" step="0.01" value="0.20">
        <div class="value-display" id="midPoint-value">0.20</div>
      </div>
      <div class="control-item">
        <label for="intensityMultiplier">Intensity (强度倍数)</label>
        <input type="range" id="intensityMultiplier" min="0" max="2" step="0.1" value="0.6">
        <div class="value-display" id="intensityMultiplier-value">0.6</div>
      </div>
      <div class="control-item">
        <label for="yOffset">Y Offset (Y偏移)</label>
        <input type="range" id="yOffset" min="-1" max="1" step="0.001" value="0.2">
        <div class="value-display" id="yOffset-value">0.2</div>
      </div>
    </div>
    
    <div class="control-group">
      <h3>噪声动画</h3>
      <div class="control-item">
        <label for="uTimeSpeed">Time Speed (时间速度)</label>
        <input type="range" id="uTimeSpeed" min="0" max="50" step="0.1" value="0.5">
        <div class="value-display" id="uTimeSpeed-value">0.5</div>
      </div>
      <div class="control-item">
        <label for="timeSpeed">Bezier Time Speed (贝塞尔时间速度)</label>
        <input type="range" id="timeSpeed" min="0.5" max="10" step="0.5" value="3.0">
        <div class="value-display" id="timeSpeed-value">3.0</div>
      </div>
      <div class="control-item">
        <label for="noiseScale">Noise Scale (噪声缩放)</label>
        <input type="range" id="noiseScale" min="0.5" max="5" step="0.1" value="2.0">
        <div class="value-display" id="noiseScale-value">2.0</div>
      </div>
      <div class="control-item">
        <label for="heightMultiplier">Height Multiplier (高度倍数)</label>
        <input type="range" id="heightMultiplier" min="0" max="3" step="0.01" value="0.15">
        <div class="value-display" id="heightMultiplier-value">0.13</div>
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
          <option value="3">Stop0↔Stop2 动态</option>
          <option value="4">Stop1↔Stop2 动态</option>
        </select>
      </div>
      <div class="control-item">
        <label for="rightMode">右端色模式</label>
        <select id="rightMode">
          <option value="0">Stop0</option>
          <option value="1">Stop1</option>
          <option value="2">Stop2</option>
          <option value="3">Stop0↔Stop2 动态</option>
          <option value="4">Stop1↔Stop2 动态</option>
        </select>
      </div>
      <div class="control-item">
        <label for="colorStop0">Color Stop 0 (起始色)</label>
        <input type="color" id="colorStop0" class="color-input" value="#5226ff">
      </div>
      <div class="control-item">
        <label for="colorStop1">Color Stop 1 (中间色)</label>
        <input type="color" class="color-input" id="colorStop1" value="#7dff66">
      </div>
      <div class="control-item">
        <label for="colorStop2">Color Stop 2 (结束色)</label>
        <input type="color" class="color-input" id="colorStop2" value="#5226ff">
      </div>
    </div>
    
    <div class="control-group">
      <h3>贝塞尔颜色</h3>
      <div class="control-item">
        <label for="lineColor">线条颜色</label>
        <input type="color" id="lineColor" class="color-input" value="#ffffff">
      </div>
      <div class="control-item">
        <label for="purpleColor">紫色</label>
        <input type="color" id="purpleColor" class="color-input" value="#9933cc">
      </div>
      <div class="control-item">
        <label for="greenColor">绿色</label>
        <input type="color" id="greenColor" class="color-input" value="#33cc4d">
      </div>
      <div class="control-item">
        <label for="blueColor">蓝色</label>
        <input type="color" id="blueColor" class="color-input" value="#3366ff">
      </div>
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
        <input type="range" id="glowWidth" min="0" max="0.2" step="0.001" value="0.05">
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
    </div>
    
    <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
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
  // 2. UI滑块与uniform自动映射
  const controls = [
    'curveAngle', 'curveType', 'lineWidth', 'baseBloomIntensity', 'bloomRange', 'bloomTransitionRange',
    'gradientPower', 'gradientCenterThreshold', 'insideAlpha', 'timeSpeed',
    'amplitude', 'blend', 'audioInfluence', 'audioMultiplier', 'uTimeSpeed',
    'noiseScale', 'heightMultiplier', 'midPoint', 'intensityMultiplier', 'yOffset',
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(3);

        // 自动生成 uniform 名称
        let uniformName = controlName;

        // 兼容shader中的下划线命名
        if (['_CurveAngle', '_CurveType', '_LineWidth', '_BaseBloomIntensity', '_BloomRange', '_BloomTransitionRange', '_GradientPower', '_GradientCenterThreshold', '_InsideAlpha', '_TimeSpeed'].includes(`_${controlName.charAt(0).toUpperCase()}${controlName.slice(1)}`)) {
          uniformName = `_${controlName.charAt(0).toUpperCase()}${controlName.slice(1)}`;
        }
        // 其它直接用参数名
        materials.forEach(material => {
          material.setFloat(uniformName, value);
        });
        (shaderParams as any)[controlName] = value;
      });
    }
  });

  // 颜色控制
  ['colorStop0', 'colorStop1', 'colorStop2'].forEach((colorName, index) => {
    const colorPicker = document.getElementById(colorName) as HTMLInputElement;

    if (colorPicker) {
      const color = shaderParams.colorStops[index];

      colorPicker.value = rgbToHex(color.x, color.y, color.z);
      colorPicker.addEventListener('input', e => {
        const rgb = hexToRgb((e.target as HTMLInputElement).value);

        if (rgb) {
          shaderParams.colorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b };
          materials.forEach(material => {
            material.setVector3(`uColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
          });
        }
      });
    }
  });

  // 贝塞尔颜色
  ['lineColor', 'purpleColor', 'greenColor', 'blueColor', 'insideColor'].forEach(colorName => {
    const colorPicker = document.getElementById(colorName) as HTMLInputElement;

    if (colorPicker) {
      const color = (shaderParams as any)[colorName];

      colorPicker.value = rgbToHex(color.x, color.y, color.z);
      colorPicker.addEventListener('input', e => {
        const rgb = hexToRgb((e.target as HTMLInputElement).value);

        if (rgb) {
          (shaderParams as any)[colorName] = { x: rgb.r, y: rgb.g, z: rgb.b };
          materials.forEach(material => {
            material.setVector3(`_${colorName.charAt(0).toUpperCase()}${colorName.slice(1)}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
          });
        }
      });
    }
  });

  // 左右端色模式
  ['leftMode', 'rightMode'].forEach((modeName, idx) => {
    const select = document.getElementById(modeName) as HTMLSelectElement;

    if (select) {
      select.value = (shaderParams as any)[modeName]?.toString() || '0';
      select.addEventListener('change', e => {
        const value = parseInt((e.target as HTMLSelectElement).value, 10);
        const uniformName = idx === 0 ? 'uLeftMode' : 'uRightMode';

        materials.forEach(material => {
          material.setInt(uniformName, value);
        });
        (shaderParams as any)[modeName] = value;
      });
      materials.forEach(material => {
        material.setInt(idx === 0 ? 'uLeftMode' : 'uRightMode', (shaderParams as any)[modeName] || 0);
      });
    }
  });

  // 新增辉光参数
  [
    { name: 'glowWidth', uniform: '_GlowWidth', fixed: 3 },
    { name: 'glowSoft', uniform: '_GlowSoft', fixed: 3 },
    { name: 'glowPower', uniform: '_GlowPower', fixed: 2 },
    { name: 'glowIntensity', uniform: '_GlowIntensity', fixed: 2 },
  ].forEach(({ name, uniform, fixed }) => {
    const slider = document.getElementById(name) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${name}-value`);

    if (slider && valueDisplay) {
      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(fixed);
        materials.forEach(material => {
          material.setFloat(uniform, value);
        });
        (shaderParams as any)[name] = value;
      });
    }
  });
}

// 重置为默认值
function resetToDefaults () {
  const defaults = {
    amplitude: 1.0,
    audioInfluence: 1.0,
    audioMultiplier: 2.0,
    blend: 0.5,
    uTimeSpeed: 0.5,
    noiseScale: 2.0,
    heightMultiplier: 0.5,
    midPoint: 0.20,
    intensityMultiplier: 0.6,
    yOffset: 0.2,
    curveAngle: 0.5,
    lineWidth: 0.01,
    baseBloomIntensity: 0.4,
    bloomRange: 0.25,
    bloomTransitionRange: 0.05,
    gradientPower: 1.5,
    gradientCenterThreshold: 0.2,
    insideAlpha: 1.0,
    timeSpeed: 3.0,
    leftMode: 0,
    rightMode: 2,
    // 新增辉光参数
    glowWidth: 0.05,
    glowSoft: 0.03,
    glowPower: 2.0,
    glowIntensity: 0.8,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = value.toString();
      valueDisplay.textContent = typeof value === 'number' ? value.toFixed(3) : value;
      let uniformName = '';

      if (key === 'curveAngle') {uniformName = '_CurveAngle';} else if (key === 'lineWidth') {uniformName = '_LineWidth';} else if (key === 'baseBloomIntensity') {uniformName = '_BaseBloomIntensity';} else if (key === 'bloomRange') {uniformName = '_BloomRange';} else if (key === 'bloomTransitionRange') {uniformName = '_BloomTransitionRange';} else if (key === 'gradientPower') {uniformName = '_GradientPower';} else if (key === 'gradientCenterThreshold') {uniformName = '_GradientCenterThreshold';} else if (key === 'insideAlpha') {uniformName = '_InsideAlpha';} else if (key === 'timeSpeed') {uniformName = '_TimeSpeed';} else if (key === 'glowWidth') {uniformName = '_GlowWidth';} else if (key === 'glowSoft') {uniformName = '_GlowSoft';} else if (key === 'glowPower') {uniformName = '_GlowPower';} else if (key === 'glowIntensity') {uniformName = '_GlowIntensity';} else {uniformName = `u${key.charAt(0).toUpperCase() + key.slice(1)}`;}
      materials.forEach(material => {
        material.setFloat(uniformName, value);
      });
    }
  });

  // 重置颜色
  const defaultColors = [
    '#9124ff', '#00aaff', '#24ff70',
  ];

  defaultColors.forEach((hex, index) => {
    const colorPicker = document.getElementById(`colorStop${index}`) as HTMLInputElement;

    if (colorPicker) {
      colorPicker.value = hex;
      const rgb = hexToRgb(hex);

      if (rgb) {
        shaderParams.colorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b };
        materials.forEach(material => {
          material.setVector3(`uColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
        });
      }
    }
  });
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
  jsonValue.materials[0].floats['_BaseBloomIntensity'] = shaderParams.baseBloomIntensity;
  jsonValue.materials[0].floats['_BloomRange'] = shaderParams.bloomRange;
  jsonValue.materials[0].floats['_BloomTransitionRange'] = shaderParams.bloomTransitionRange;
  jsonValue.materials[0].floats['_GradientPower'] = shaderParams.gradientPower;
  jsonValue.materials[0].floats['_GradientCenterThreshold'] = shaderParams.gradientCenterThreshold;
  jsonValue.materials[0].floats['_InsideAlpha'] = shaderParams.insideAlpha;
  jsonValue.materials[0].floats['_TimeSpeed'] = shaderParams.timeSpeed;

  // 设置氛围光参数默认值
  jsonValue.materials[0].floats['uAmplitude'] = shaderParams.amplitude;
  jsonValue.materials[0].floats['uBlend'] = shaderParams.blend;
  jsonValue.materials[0].floats['uAudioInfluence'] = shaderParams.audioInfluence;
  jsonValue.materials[0].floats['uAudioMultiplier'] = shaderParams.audioMultiplier;
  jsonValue.materials[0].floats['uTimeSpeed'] = shaderParams.uTimeSpeed;
  jsonValue.materials[0].floats['uNoiseScale'] = shaderParams.noiseScale;
  jsonValue.materials[0].floats['uHeightMultiplier'] = shaderParams.heightMultiplier;
  jsonValue.materials[0].floats['uMidPoint'] = shaderParams.midPoint;
  jsonValue.materials[0].floats['uIntensityMultiplier'] = shaderParams.intensityMultiplier;
  jsonValue.materials[0].floats['uYOffset'] = shaderParams.yOffset;

  // 设置颜色
  jsonValue.materials[0].vector3s['_LineColor'] = shaderParams.lineColor;
  jsonValue.materials[0].vector3s['_PurpleColor'] = shaderParams.purpleColor;
  jsonValue.materials[0].vector3s['_GreenColor'] = shaderParams.greenColor;
  jsonValue.materials[0].vector3s['_BlueColor'] = shaderParams.blueColor;
  jsonValue.materials[0].vector3s['_InsideColor'] = shaderParams.insideColor;
  jsonValue.materials[0].vector3s['_BarColorCenter'] = shaderParams.barColorCenter;
  jsonValue.materials[0].vector3s['_BarColorMiddle'] = shaderParams.barColorMiddle;
  jsonValue.materials[0].vector3s['_BarColorEdge'] = shaderParams.barColorEdge;

  shaderParams.colorStops.forEach((color, index) => {
    jsonValue.materials[0].vector3s[`uColorStops${index}`] = color;
  });

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;

  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_3');

  const audioSimulator: AudioSimulator = new AudioSimulator(64);
  let audioTexture: Texture | null = null;
  const engine = composition.renderer.engine;

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    for (const component of rendererComponents) {
      const { materials: componentMaterials } = component;

      for (const material of componentMaterials) {
        setBlendMode(material, spec.BlendingMode.ALPHA);
        material.depthMask = false;

        // 设置所有贝塞尔uniform参数
        material.setFloat('_CurveAngle', shaderParams.curveAngle);
        material.setFloat('_CurveType', shaderParams.curveType);
        material.setFloat('_LineWidth', shaderParams.lineWidth);
        material.setFloat('_BaseBloomIntensity', shaderParams.baseBloomIntensity);
        material.setFloat('_BloomRange', shaderParams.bloomRange);
        material.setFloat('_BloomTransitionRange', shaderParams.bloomTransitionRange);
        material.setFloat('_GradientPower', shaderParams.gradientPower);
        material.setFloat('_GradientCenterThreshold', shaderParams.gradientCenterThreshold);
        material.setFloat('_InsideAlpha', shaderParams.insideAlpha);
        material.setFloat('_TimeSpeed', shaderParams.timeSpeed);

        // 设置所有氛围光uniform参数
        material.setFloat('uAmplitude', shaderParams.amplitude);
        material.setFloat('uBlend', shaderParams.blend);
        material.setFloat('uAudioInfluence', shaderParams.audioInfluence);
        material.setFloat('uAudioMultiplier', shaderParams.audioMultiplier);
        material.setFloat('uTimeSpeed', shaderParams.uTimeSpeed);
        material.setFloat('uNoiseScale', shaderParams.noiseScale);
        material.setFloat('uHeightMultiplier', shaderParams.heightMultiplier);
        material.setFloat('uMidPoint', shaderParams.midPoint);
        material.setFloat('uIntensityMultiplier', shaderParams.intensityMultiplier);
        material.setFloat('uYOffset', shaderParams.yOffset);

        // 设置颜色
        material.setVector3('_LineColor', new math.Vector3(shaderParams.lineColor.x, shaderParams.lineColor.y, shaderParams.lineColor.z));
        material.setVector3('_PurpleColor', new math.Vector3(shaderParams.purpleColor.x, shaderParams.purpleColor.y, shaderParams.purpleColor.z));
        material.setVector3('_GreenColor', new math.Vector3(shaderParams.greenColor.x, shaderParams.greenColor.y, shaderParams.greenColor.z));
        material.setVector3('_BlueColor', new math.Vector3(shaderParams.blueColor.x, shaderParams.blueColor.y, shaderParams.blueColor.z));
        material.setVector3('_InsideColor', new math.Vector3(shaderParams.insideColor.x, shaderParams.insideColor.y, shaderParams.insideColor.z));
        material.setVector3('_BarColorCenter', new math.Vector3(shaderParams.barColorCenter.x, shaderParams.barColorCenter.y, shaderParams.barColorCenter.z));
        material.setVector3('_BarColorMiddle', new math.Vector3(shaderParams.barColorMiddle.x, shaderParams.barColorMiddle.y, shaderParams.barColorMiddle.z));
        material.setVector3('_BarColorEdge', new math.Vector3(shaderParams.barColorEdge.x, shaderParams.barColorEdge.y, shaderParams.barColorEdge.z));

        // 设置左右端色模式
        material.setInt('uLeftMode', shaderParams.leftMode);
        material.setInt('uRightMode', shaderParams.rightMode);

        // 创建音频纹理 - 使用您的方法
        const audioTextureData = {
          width: 64,
          height: 1,
          data: new Float32Array(64).fill(128),
        };

        audioTexture = Texture.createWithData(
          engine,
          audioTextureData,
          {
            wrapS: glContext.CLAMP_TO_EDGE,
            wrapT: glContext.CLAMP_TO_EDGE,
            minFilter: glContext.LINEAR,
            magFilter: glContext.LINEAR,
          }
        );

        material.setTexture('uAudioTexture', audioTexture);
        materials.push(material);
      }
    }
  }

  // 创建并初始化UI控制面板
  createControlPanel();
  initializeControls();

  // 启动音频模拟器 - 使用您的方法
  audioSimulator.start((audioData: AudioData) => {
    if (audioTexture && materials.length > 0) {
      const width = 64;
      const height = 1;

      const updatedTextureData = {
        width: width,
        height: height,
        data: audioData.textureData,
      };

      const newAudioTexture = Texture.createWithData(
        engine,
        updatedTextureData,
        {
          wrapS: glContext.CLAMP_TO_EDGE,
          wrapT: glContext.CLAMP_TO_EDGE,
          minFilter: glContext.LINEAR,
          magFilter: glContext.LINEAR,
          format: glContext.RGBA,
          type: glContext.FLOAT,
        }
      );

      materials.forEach((material: Material) => {
        material.setTexture('uAudioTexture', newAudioTexture);
      });

      audioTexture = newAudioTexture;

      const avgAmplitude = audioData.floatData.reduce((a: number, b: number) => a + b, 0) / audioData.frequencyBands;
      const bassLevel = audioData.floatData.slice(0, 13).reduce((a: number, b: number) => a + b, 0) / 13;

      materials.forEach((material: Material) => {
        material.setFloat('uAmplitude', shaderParams.amplitude + bassLevel * 1.5);
        material.setFloat('uAudioInfluence', shaderParams.audioInfluence * avgAmplitude * 2.0);
      });
    }
  }, 60);

  player.play();

  window.addEventListener('beforeunload', () => {
    audioSimulator.stop();
  });
})();

function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}