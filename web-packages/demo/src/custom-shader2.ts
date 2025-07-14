/* eslint-disable no-case-declarations */
import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*gAIvS7C5mJ4AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数
const shaderParams = {
  curveAngle: 0.5,
  curveType: 0.0,
  lineWidth: 0.084,
  insideAlpha: 1.0,
  timeSpeed: 4.100,
  amplitude: 1.0,
  blend: 0.5,
  audioInfluence: 1.0,
  audioMultiplier: 2.0,
  timeSpeedUniform: 4.1,
  noiseScale: 2.0,
  heightMultiplier: 0.5,
  midPoint: 0.20,
  intensityMultiplier: 0.6,
  yOffset: 0.2,
  insideColor: { x: 0.0, y: 0.0, z: 0.0 },
  colorStops: [
    { x: 0.32, y: 0.15, z: 1.0 },
    { x: 0.49, y: 1.0, z: 0.40 },
    { x: 0.655, y: 0.14, z: 1.0 },
  ],
  leftMode: 3,
  rightMode: 1,
  glowWidth: 0.162,
  glowSoft: 0.03,
  glowPower: 2.0,
  glowIntensity: 1.350,
  dynamicWidthFalloff: 3.250,
  colorRegion: -1.270,
  glowRegion: -0.010,
  dynamicWidthCenter: 0.5,
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

const fragment = `
precision highp float;

varying vec2 uv;
uniform vec4 _Time;
uniform float _CurveAngle;
uniform float _CurveType;
uniform float _LineWidth;
uniform float _InsideAlpha;
uniform vec3 _InsideColor;
uniform vec3 _ColorStops0;
uniform vec3 _ColorStops1;
uniform vec3 _ColorStops2;
uniform float _TimeSpeedUniform;
uniform int _LeftMode;   // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态
uniform int _RightMode;  // 0: stops0, 1: stops1, 2: stops2, 3: stops0<->stops2 动态, 4: stops1<->stops2 动态
uniform float _GlowWidth;      // 辉光范围
uniform float _GlowSoft;       // 辉光边缘柔和度
uniform float _GlowPower;      // 辉光边缘衰减
uniform float _GlowIntensity;  // 辉光强度
uniform float _DynamicWidthFalloff;
uniform float _ColorRegion;
uniform float _GlowRegion;
uniform float _DynamicWidthCenter;

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
    float aa = max(fwidth(dist)* 2.0, 0.01);
    // 两边都平滑
    return smoothstep(lineWidth + aa, lineWidth - aa, abs(dist));
}

vec3 getStopColor(int mode, float beat) {
    if(mode == 0) return _ColorStops0;
    if(mode == 1) return _ColorStops1;
    if(mode == 2) return _ColorStops2;
    if(mode == 3) return mix(_ColorStops0, _ColorStops2, beat);
    if(mode == 4) return mix(_ColorStops1, _ColorStops2, beat);
    return _ColorStops0;
}

vec3 getColorFromGradient(float factor) {
    float beat = sin(_Time.y * _TimeSpeedUniform) * 0.5 + 0.5;
    vec3 leftColor = getStopColor(_LeftMode, beat);
    vec3 rightColor = getStopColor(_RightMode, beat);
    return mix(leftColor, rightColor, factor);
}

void main() {
    vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);


    //获取渐变的颜色
    vec3 rampColor = getColorFromGradient(uvCoord.x);
    vec3 glowColor = rampColor;

    uvCoord = vec2(uv.x, uv.y);

    // 计算贝塞尔曲线绘制
    vec2 A_single, C_single;
    getCurvePoints(_CurveType, A_single, C_single);
    vec2 B_single = getBezierControlPoint(_CurveAngle, A_single, C_single);
    float signedDist = sd_bezier_signed(uvCoord, A_single, B_single, C_single);

    vec2 grad = vec2(dFdx(signedDist), dFdy(signedDist));
    float gradient = length(grad);
    float globalAARange = clamp(gradient * 2.0, 0.005, 0.15);

    // 双向平滑过渡
    float normalizedDist = signedDist / globalAARange;
    float alphaTransition = smoothstep(-0.5, 0.5, normalizedDist);

    //线条从中间到两侧逐渐减少宽度
    float widthCenter = _LineWidth;         // 中间最大线宽
    float widthEdge = _LineWidth * 0.3;     // 两侧最小线宽，可调
    // 修改中心点
    float t = pow(abs(uvCoord.x - _DynamicWidthCenter) / max(_DynamicWidthCenter, 1.0-_DynamicWidthCenter), _DynamicWidthFalloff);
    t = max(0.0, t - _ColorRegion); // _ColorRegion 越大，彩色区域越窄
    float dynamicLineWidth = mix(widthCenter, widthEdge, t);

    //计算静宽
    float lineStroke = antiAliasedStroke(abs(signedDist), dynamicLineWidth);

    vec4 linecolor = vec4(rampColor,1.0);

    vec3 finalColorRGB = vec3(0.0);
    float finalAlpha = 1.0;

    // --- 辉光效果 begin ---
    float glowWidthCenter = _GlowWidth;
    float glowWidthEdge = _GlowWidth * 0.15; // 辉光两侧最小宽度
    float glowPower = _GlowPower;
    float glowIntensity = _GlowIntensity;
    float glowOffset = 0.01; 

    float glowt = pow(abs(uvCoord.x - _DynamicWidthCenter) / max(_DynamicWidthCenter, 1.0-_DynamicWidthCenter), _DynamicWidthFalloff);
    glowt = max(0.0, t - _GlowRegion*3.5); // _ColorRegion 越大，彩色区域越窄
    float dynamicLineGlowWidth = mix(glowWidthCenter, glowWidthEdge, glowt);
    
    float glow = 0.0;
    float distanceFromLine = signedDist+glowOffset;
    float glowStart = dynamicLineGlowWidth - _GlowSoft;
    float glowEnd = dynamicLineGlowWidth + _GlowWidth;
    float glowAA = max(fwidth(distanceFromLine), 0.001); // 加入抗锯齿
    glow = 1.0 - smoothstep(glowStart - glowAA, glowEnd + glowAA, abs(distanceFromLine));
    glow = pow(glow, _GlowPower);

    // --- 辉光效果 end ---
    finalAlpha = 0.0;

    // 计算边界过渡抗锯齿
    float transitionRange = max(fwidth(signedDist)*2.0, 0.001) ;

    float inner_base_alpha = smoothstep(0.0, -transitionRange, signedDist);

    // 2. 内部区域处理（单向过渡）
    if (signedDist < 0.0) {
        finalColorRGB = _InsideColor;
        finalAlpha = inner_base_alpha * _InsideAlpha;
    }

    float final_stroke_alpha = lineStroke * (1.0 - inner_base_alpha);
    vec4 stroke_layer = linecolor * final_stroke_alpha;

    finalColorRGB = stroke_layer.rgb * stroke_layer.a + finalColorRGB * (1.0 - stroke_layer.a);
    finalAlpha = stroke_layer.a + finalAlpha * (1.0 - stroke_layer.a);

    float upperGlowMask = smoothstep(-0.01, 0.0, signedDist);
    float topAttenuation = smoothstep(0.0, 0.2, 1.0 - uvCoord.y);
    glow = glow * upperGlowMask * topAttenuation;

    finalColorRGB = glowColor * glow * _GlowIntensity + finalColorRGB * (1.0 - glow * _GlowIntensity);
    finalAlpha = glow * _GlowIntensity + finalAlpha * (1.0 - glow * _GlowIntensity);

    gl_FragColor = vec4(finalColorRGB,finalAlpha);
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
        <input type="range" id="lineWidth" min="0.001" max="0.5" step="0.001" value="0.01">
        <div class="value-display" id="lineWidth-value">0.01</div>
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
        <input type="color" class="color-input" id="colorStop2" value="#5226ff">
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
    
    <div class="control-group">
      <h3>线宽衰减</h3>
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
    
    <div class="control-item">
      <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
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
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      slider.value = (shaderParams as any)[controlName]?.toString() || '0';
      valueDisplay.textContent = (shaderParams as any)[controlName]?.toString() || '0';

      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(3);

        const uniformName = `_${controlName.charAt(0).toUpperCase()}${controlName.slice(1)}`;

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
            material.setVector3(`_ColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
          });
        }
      });
    }
  });

  // 内部颜色
  const insideColorPicker = document.getElementById('insideColor') as HTMLInputElement;

  if (insideColorPicker) {
    insideColorPicker.value = rgbToHex(
      shaderParams.insideColor.x,
      shaderParams.insideColor.y,
      shaderParams.insideColor.z
    );

    insideColorPicker.addEventListener('input', e => {
      const rgb = hexToRgb((e.target as HTMLInputElement).value);

      if (rgb) {
        shaderParams.insideColor = { x: rgb.r, y: rgb.g, z: rgb.b };
        materials.forEach(material => {
          material.setVector3('_InsideColor', new math.Vector3(rgb.r, rgb.g, rgb.b));
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
        const value = parseInt((e.target as HTMLSelectElement).value, 10);
        const uniformName = idx === 0 ? '_LeftMode' : '_RightMode';

        materials.forEach(material => {
          material.setInt(uniformName, value);
        });
        (shaderParams as any)[modeName] = value;
      });

      materials.forEach(material => {
        material.setInt(idx === 0 ? '_LeftMode' : '_RightMode', (shaderParams as any)[modeName] || 0);
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
    timeSpeedUniform: 4.1,
    noiseScale: 2.0,
    heightMultiplier: 0.5,
    midPoint: 0.20,
    intensityMultiplier: 0.6,
    yOffset: 0.2,
    curveAngle: 0.5,
    lineWidth: 0.084,
    insideAlpha: 1.0,
    timeSpeed: 4.100,
    leftMode: 3,
    rightMode: 1,
    glowWidth: 0.162,
    glowSoft: 0.03,
    glowPower: 2.0,
    glowIntensity: 1.350,
    dynamicWidthFalloff: 3.250,
    colorRegion: -1.270,
    glowRegion: -0.010,
    dynamicWidthCenter: 0.5,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = value.toString();
      valueDisplay.textContent = typeof value === 'number' ? value.toFixed(3) : value;

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
    '#5226ff', '#7dff66', '##A724FF',
  ];

  defaultColors.forEach((hex, index) => {
    const colorPicker = document.getElementById(`colorStop${index}`) as HTMLInputElement;

    if (colorPicker) {
      colorPicker.value = hex;
      const rgb = hexToRgb(hex);

      if (rgb) {
        shaderParams.colorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b };
        materials.forEach(material => {
          material.setVector3(`_ColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
        });
      }
    }
  });

  // 重置内部颜色
  const insideColorPicker = document.getElementById('insideColor') as HTMLInputElement;

  if (insideColorPicker) {
    insideColorPicker.value = '#000000';
    shaderParams.insideColor = { x: 0, y: 0, z: 0 };
    materials.forEach(material => {
      material.setVector3('_InsideColor', new math.Vector3(0, 0, 0));
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
  jsonValue.materials[0].ints = {
    '_LeftMode': shaderParams.leftMode,
    '_RightMode': shaderParams.rightMode,
  };

  // 设置辉光参数
  jsonValue.materials[0].floats['_GlowWidth'] = shaderParams.glowWidth;
  jsonValue.materials[0].floats['_GlowSoft'] = shaderParams.glowSoft;
  jsonValue.materials[0].floats['_GlowPower'] = shaderParams.glowPower;
  jsonValue.materials[0].floats['_GlowIntensity'] = shaderParams.glowIntensity;

  // 设置线宽衰减参数
  jsonValue.materials[0].floats['_DynamicWidthFalloff'] = shaderParams.dynamicWidthFalloff;
  jsonValue.materials[0].floats['_ColorRegion'] = shaderParams.colorRegion;
  jsonValue.materials[0].floats['_GlowRegion'] = shaderParams.glowRegion;
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
        setBlendMode(material, spec.BlendingMode.ALPHA);
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
        material.setInt('_LeftMode', shaderParams.leftMode);
        material.setInt('_RightMode', shaderParams.rightMode);

        // 设置辉光参数
        material.setFloat('_GlowWidth', shaderParams.glowWidth);
        material.setFloat('_GlowSoft', shaderParams.glowSoft);
        material.setFloat('_GlowPower', shaderParams.glowPower);
        material.setFloat('_GlowIntensity', shaderParams.glowIntensity);

        // 设置线宽衰减参数
        material.setFloat('_DynamicWidthFalloff', shaderParams.dynamicWidthFalloff);
        material.setFloat('_ColorRegion', shaderParams.colorRegion);
        material.setFloat('_GlowRegion', shaderParams.glowRegion);
        material.setFloat('_DynamicWidthCenter', shaderParams.dynamicWidthCenter);

        // 设置颜色停止点
        shaderParams.colorStops.forEach((color, index) => {
          material.setVector3(`_ColorStops${index}`, new math.Vector3(color.x, color.y, color.z));
        });

        setBlendMode(material, spec.BlendingMode.ALPHA);
        materials.push(material);
      }
    }
  }

  // 创建并初始化UI控制面板
  createControlPanel();
  initializeControls();

  player.play();

  window.addEventListener('beforeunload', () => {
  });
})();

function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}