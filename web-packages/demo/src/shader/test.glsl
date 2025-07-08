import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';
import { Vector3 } from '@galacean/effects-plugin-model';
import type { AudioData } from './audio-state-machine';
import AudioStateMachine, { AudioStage } from './audio-state-machine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*piz4QagroQ0AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数，仅保留实际用到的参数
const shaderParams = {
  _Amplitude: 0.150,
  _Blend: 1.250,
  _TimeSpeed: 2.100, // 修改
  _NoiseScale: 0.900,
  _HeightMultiplier: 3.900,
  _MidPoint: 0.860,
  _IntensityMultiplier: 1.500,
  _YOffset: 0.480,
  _HeightPower: 0.580,
  _ColorStops0: { x: 0.00, y: 0.15, z: 1.0 },
  _ColorStops1: { x: 0.49, y: 1.0, z: 0.40 },
  _ColorStops2: { x: 0.32, y: 0.15, z: 1.0 },
  _FadeProgressGlobal: 0.0,
  _FadeProgressMask: 0.0,
  _FadeOffset: 0.230,
  _AudioBrightness: 1.000,
  _AudioSensitivity: 2.0,
  _FadeStart: 0.000,
  _FadeEnd: 0.780,
  _MinIntensity: 0.330,
  _MaxIntensity: 1.050,
  _AudioMin: 0.0,
  _AudioMax: 1.0,
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
uniform vec2 _Time;
uniform float _Amplitude;
uniform vec3 _ColorStops0;
uniform vec3 _ColorStops1;
uniform vec3 _ColorStops2;
uniform float _Blend;
uniform float _MinIntensity;
uniform float _MaxIntensity;
uniform float _AudioInfluence;
uniform float _AudioMin;
uniform float _AudioMax;
uniform float _AudioCurrent;
uniform float _TimeSpeed;
uniform float _NoiseScale;
uniform float _HeightMultiplier;
uniform float _MidPoint;
uniform float _IntensityMultiplier;
uniform float _YOffset;
uniform float _HeightPower;
uniform float _FadeProgressGlobal; 
uniform float _FadeProgressMask;   
uniform float _FadeOffset; 
uniform float _FadeMode; 
uniform float _AudioBrightness; 
uniform float _AudioSensitivity; 
uniform float _FadeStart; 
uniform float _FadeEnd;   


vec3 acesToneMapping(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

vec3 reinhardToneMapping(vec3 color) {
  return color / (1.0 + color);
}

vec3 exposureControl(vec3 color, float exposure) {
  return vec3(1.0) - exp(-color * exposure);
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

  vec3 getColorFromGradient(float factor) {
    // 保证 factor 在 [0.0, 1.0) 范围内
    factor = fract(factor);

    // 渐变区间数量
    const int stops = 3;
    vec3 colorStops[3];
    colorStops[0] = _ColorStops0;
    colorStops[1] = _ColorStops1;
    colorStops[2] = _ColorStops2;

    // 用 stops 替换为 stops 数量，避免 idx 越界
    float scaled = factor * float(stops);
    int idx = int(floor(scaled)) % stops;
    float t = fract(scaled);

    // 环形渐变，最后一个和第一个插值
    vec3 c0 = colorStops[idx];
    vec3 c1 = colorStops[(idx + 1) % stops];

    return mix(c0, c1, t);
}

// --- HSV/RGB 互转函数 ---
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs((q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);
  
  float time = _Time.y * _TimeSpeed ; 

  float wavePhase = uvCoord.x * _NoiseScale + time * 0.1;
  
  float offset1 = 0.2;
  float offset2 = 0.4;
  vec3 colorA = getColorFromGradient(wavePhase);
  vec3 colorB = getColorFromGradient(wavePhase + offset1);
  vec3 colorC = getColorFromGradient(wavePhase + offset2);

  // 归一化音量
  float normalizedAudio = clamp((_AudioCurrent - _AudioMin) / max(0.0001, _AudioMax - _AudioMin), 0.0, 1.0);

  // 用 normalizedAudio 替换 uAudioInfluence
  vec3 rampColor = mix(mix(colorA, colorB, normalizedAudio), colorC, normalizedAudio * 0.5);

    // 添加亮度曲线控制，增加灵敏度参数
  float audioFactor = pow(normalizedAudio, _AudioSensitivity); // 灵敏度可调
  float brightness = mix(_MinIntensity, _MaxIntensity, audioFactor);

    // 保持颜色特征的同时提亮
  vec3 auroraColor = rampColor  * _AudioBrightness;

  float baseNoise = snoise(vec2(wavePhase, time * 0.25)) * 0.5 * _Amplitude;
  // 用uAudioInfluence控制起伏幅度，0时无起伏，1时最大起伏
  float height = mix(0.5*baseNoise, baseNoise, normalizedAudio);

  float normHeight = (height + _Amplitude * 0.5) / _Amplitude;
  normHeight = pow(normHeight, 1.0 / _HeightPower);
  height = normHeight * _Amplitude - _Amplitude * 0.5;

  height += _YOffset;
  height = exp(height);
  height = (uvCoord.y * 2.0 - height + 0.2 )* _HeightMultiplier;

  float intensity = _IntensityMultiplier* height;
  
  float edge0 = _MidPoint - _Blend * 0.5;
  float edge1 = _MidPoint + _Blend * 0.5;
  float auroraAlpha = smoothstep(edge0, edge1, intensity);
  // y轴方向整体透明度平滑衰减（底部不透明，顶部逐渐透明）
  float adjustedFadeEnd = mix(_FadeStart, _FadeEnd, brightness);
  float yFade = smoothstep(_FadeStart, adjustedFadeEnd, uv.y);
  auroraAlpha *= 1.0 - yFade;
  float fadeNorm = clamp(((1.0 - uvCoord.y) - _FadeStart) / max(0.0001, _FadeEnd - _FadeStart), 0.0, 1.0);
  float fadePower = 2.5; 
  float verticalFade = pow(1.0 - fadeNorm, fadePower);
  auroraAlpha *= verticalFade;

  // 右到左淡出遮罩
  float fadeEdge = 0.2;
  // 右到左淡入遮罩（与淡出相反，uFadeProgressMask从1到0时显现）
  float fadeInMask =1.0- smoothstep(1.0 - _FadeProgressMask - fadeEdge, 1.0 - _FadeProgressMask,1.0 - uvCoord.x- _FadeOffset);

  float fade = 1.0 - pow(mix(_FadeProgressGlobal, 1.0, uvCoord.x - _FadeOffset), 2.0);

    float mask = 1.0;
    if (_FadeMode == 0.0) {
      mask = 0.0;
    } else if (_FadeMode == 1.0) {
      mask = fadeInMask;
      }
      else if (_FadeMode == 2.0) {
      mask = 1.0;
    } else if (_FadeMode == 3.0) {
      mask = fade ;
    }

    auroraAlpha *= mask;

    gl_FragColor = vec4(auroraColor*auroraAlpha, auroraAlpha );
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

// 创建UI控制面板，新增消隐速度和uFadeOffset滑块
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
    <h2 style="margin-top: 0; color: #4CAF50;">Aurora Shader Controls</h2>
    <div class="control-group">
      <h3>极光形态参数</h3>
      <div class="control-item">
        <label for="_Amplitude">Amplitude (振幅)</label>
        <input type="range" id="_Amplitude" min="0" max="3" step="0.01" value="0.15">
        <div class="value-display" id="_Amplitude-value">0.15</div>
      </div>
      <div class="control-item">
        <label for="_Blend">Blend Factor (混合因子)</label>
        <input type="range" id="_Blend" min="0" max="5" step="0.05" value="1.25">
        <div class="value-display" id="_Blend-value">1.25</div>
      </div>
      <div class="control-item">
        <label for="_MidPoint">Mid Point (中点位置)</label>
        <input type="range" id="_MidPoint" min="0" max="2" step="0.01" value="0.86">
        <div class="value-display" id="_MidPoint-value">0.86</div>
      </div>
      <div class="control-item">
        <label for="_IntensityMultiplier">Intensity (强度倍数)</label>
        <input type="range" id="_IntensityMultiplier" min="0" max="2" step="0.1" value="1.5">
        <div class="value-display" id="_IntensityMultiplier-value">1.50</div>
      </div>
      <div class="control-item">
        <label for="_YOffset">Y Offset (Y偏移)</label>
        <input type="range" id="_YOffset" min="-1" max="1" step="0.01" value="0.48">
        <div class="value-display" id="_YOffset-value">0.48</div>
      </div>
      <div class="control-item">
        <label for="_HeightPower">Height Power (高度幂次)</label>
        <input type="range" id="_HeightPower" min="0.1" max="10" step="0.01" value="0.58">
        <div class="value-display" id="_HeightPower-value">0.58</div>
      </div>
      <div class="control-item">
        <label for="_HeightMultiplier">Height Multiplier (高度倍数)</label>
        <input type="range" id="_HeightMultiplier" min="0" max="5" step="0.1" value="3.9">
        <div class="value-display" id="_HeightMultiplier-value">3.90</div>
      </div>
      <div class="control-item">
        <label for="_NoiseScale">Noise Scale (噪声缩放)</label>
        <input type="range" id="_NoiseScale" min="0.5" max="5" step="0.1" value="0.9">
        <div class="value-display" id="_NoiseScale-value">0.90</div>
      </div>
      <div class="control-item">
        <label for="_ColorStops0">Reveal Edge (显隐过渡宽度)</label>
        <input type="range" id="_ColorStops0" min="0.001" max="1.0" step="0.001" value="0.299">
        <div class="value-display" id="_ColorStops0-value">0.299</div>
      </div>
      <div class="control-item">
        <label for="_AudioMin">Audio Min (音量最小值)</label>
        <input type="range" id="_AudioMin" min="0" max="100" step="0.01" value="0.00">
        <div class="value-display" id="_AudioMin-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="_AudioMax">Audio Max (音量最大值)</label>
        <input type="range" id="_AudioMax" min="0" max="100" step="0.01" value="1.00">
        <div class="value-display" id="_AudioMax-value">1.00</div>
      </div>
    </div>
    <div class="control-group">
      <h3>动画与消隐参数</h3>
      <div class="control-item">
        <label for="_TimeSpeed">Time Speed (时间速度)</label>
        <input type="range" id="_TimeSpeed" min="0" max="10" step="0.1" value="2.1">
        <div class="value-display" id="_TimeSpeed-value">2.10</div>
      </div>
      <div class="control-item">
        <label for="_FadeProgressGlobal">整体消隐速度 (fadeSpeedGlobal)</label>
        <input type="range" id="_FadeProgressGlobal" min="0.001" max="0.05" step="0.001" value="0.035">
        <div class="value-display" id="_FadeProgressGlobal-value">0.035</div>
      </div>
      <div class="control-item">
        <label for="_FadeProgressMask">右到左消隐速度 (fadeSpeedMask)</label>
        <input type="range" id="_FadeProgressMask" min="0.001" max="0.05" step="0.001" value="0.025">
        <div class="value-display" id="_FadeProgressMask-value">0.025</div>
      </div>
      <div class="control-item">
        <label for="_FadeOffset">消隐横坐标偏移 (uFadeOffset)</label>
        <input type="range" id="_FadeOffset" min="0" max="0.95" step="0.01" value="0.0">
        <div class="value-display" id="_FadeOffset-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="_AudioBrightness">Audio Brightness (音频亮度影响)</label>
        <input type="range" id="_AudioBrightness" min="0" max="5" step="0.01" value="0.0">
        <div class="value-display" id="_AudioBrightness-value">0.00</div>
      </div>
      <div class="control-item">
        <label for="_AudioSensitivity">Audio Sensitivity (音频灵敏度)</label>
        <input type="range" id="_AudioSensitivity" min="1" max="3" step="0.01" value="${shaderParams._AudioSensitivity}">
        <div class="value-display" id="_AudioSensitivity-value">${shaderParams._AudioSensitivity.toFixed(2)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeStart">消隐起始Y (uFadeStart)</label>
        <input type="range" id="_FadeStart" min="0" max="1" step="0.01" value="${shaderParams._FadeStart}">
        <div class="value-display" id="_FadeStart-value">${shaderParams._FadeStart.toFixed(2)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeEnd">消隐结束Y (uFadeEnd)</label>
        <input type="range" id="_FadeEnd" min="0" max="1" step="0.01" value="${shaderParams._FadeEnd}">
        <div class="value-display" id="_FadeEnd-value">${shaderParams._FadeEnd.toFixed(2)}</div>
      </div>
    </div>
    <div class="control-group">
      <h3>极光颜色</h3>
      <div class="control-item">
        <label for="_ColorStops0">Color Stop 0</label>
        <input type="color" id="_ColorStops0" class="color-input">
      </div>
      <div class="control-item">
        <label for="_ColorStops1">Color Stop 1</label>
        <input type="color" id="_ColorStops1" class="color-input">
      </div>
      <div class="control-item">
        <label for="_ColorStops2">Color Stop 2</label>
        <input type="color" id="_ColorStops2" class="color-input">
      </div>
    </div>
    <div class="control-group">
      <h3>强度参数</h3>
      <div class="control-item">
        <label for="_MinIntensity">Min Intensity (最小强度)</label>
        <input type="range" id="_MinIntensity" min="0" max="5" step="0.01" value="1.0">
        <div class="value-display" id="_MinIntensity-value">1.00</div>
      </div>
      <div class="control-item">
        <label for="_MaxIntensity">Max Intensity (最大强度)</label>
        <input type="range" id="_MaxIntensity" min="0" max="5" step="0.01" value="2.0">
        <div class="value-display" id="_MaxIntensity-value">2.00</div>
      </div>
    </div>
    <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
  `;

  document.body.appendChild(panel);
}

// 初始化UI控制，支持uFadeOffset
function initializeControls () {
  // 参数分组顺序与UI一致
  const controls = [
    // 极光形态参数
    '_Amplitude', '_Blend', '_MidPoint', '_IntensityMultiplier', '_YOffset', '_HeightPower', '_HeightMultiplier', '_NoiseScale',
    '_MinIntensity', '_MaxIntensity', '_AudioMin', '_AudioMax',
    // 动画与消隐参数
    '_TimeSpeed', '_FadeOffset', '_AudioBrightness', '_AudioSensitivity', '_FadeStart', '_FadeEnd',
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      // 设置初始值
      if (shaderParams[controlName as keyof typeof shaderParams] !== undefined) {
        slider.value = shaderParams[controlName as keyof typeof shaderParams].toString();
        valueDisplay.textContent = shaderParams[controlName as keyof typeof shaderParams].toFixed(3);
      }

      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(3);

        // 更新材质参数
        let uniformName = controlName;

        if (!['_MinIntensity', '_MaxIntensity', '_FadeProgressGlobal', '_FadeProgressMask', '_FadeOffset'].includes(controlName)) {
          uniformName = `u${controlName.charAt(1).toUpperCase() + controlName.slice(2)}`;
        }

        // 只对shader uniform的参数设置
        if (controlName !== '_FadeProgressGlobal' && controlName !== '_FadeProgressMask') {
          materials.forEach(material => {
            material.setFloat(uniformName, value);
          });
        }

        // 更新本地参数
        (shaderParams as any)[controlName] = value;
      });
    }
  });

  // 颜色控制
  ['_ColorStops0', '_ColorStops1', '_ColorStops2'].forEach((colorName, index) => {
    const colorPicker = document.getElementById(colorName) as HTMLInputElement;

    if (colorPicker) {
      // 设置初始颜色
      const color = shaderParams[colorName as keyof typeof shaderParams];

      colorPicker.value = rgbToHex(color.x, color.y, color.z);

      colorPicker.addEventListener('input', e => {
        const hex = (e.target as HTMLInputElement).value;
        const rgb = hexToRgb(hex);

        if (rgb) {
          shaderParams[colorName as keyof typeof shaderParams] = { x: rgb.r, y: rgb.g, z: rgb.b };

          materials.forEach(material => {
            material.setVector3(colorName, new math.Vector3(rgb.r, rgb.g, rgb.b));
          });
        }
      });
    }
  });
}

// 重置为默认值，支持uFadeOffset
function resetToDefaults () {
  const defaults = {
    _Amplitude: 0.150,
    _Blend: 1.250,
    _MidPoint: 0.860,
    _IntensityMultiplier: 1.500,
    _YOffset: 0.480,
    _HeightPower: 0.580,
    _HeightMultiplier: 3.900,
    _NoiseScale: 0.900,
    _ColorStops0: { x: 0.00, y: 0.15, z: 1.0 },
    _ColorStops1: { x: 0.49, y: 1.0, z: 0.40 },
    _ColorStops2: { x: 0.32, y: 0.15, z: 1.0 },
    _FadeProgressGlobal: 0.0,
    _FadeProgressMask: 0.0,
    _FadeOffset: 0.230,
    _AudioBrightness: 1.000,
    _AudioSensitivity: 2.0,
    _FadeStart: 0.000,
    _FadeEnd: 0.780,
    _MinIntensity: 0.330,
    _MaxIntensity: 1.050,
    _AudioMin: 0.0,
    _AudioMax: 1.0,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = value.toString();
      valueDisplay.textContent = Number(value).toFixed(3);

      // 统一生成 uniform 名称
      const uniformName = key.startsWith('u') ? key : `u${key.charAt(1).toUpperCase() + key.slice(2)}`;

      if (key !== '_FadeProgressGlobal' && key !== '_FadeProgressMask') {
        materials.forEach(material => {
          material.setFloat(uniformName, value);
        });
      }

      // 更新本地参数，确保 shaderParams 也同步
      (shaderParams as any)[key] = value;
    }
  });

  // 重置颜色
  const defaultColors = [
    '#00FFBF', '#00FF04', '#00FFBF',
  ];

  defaultColors.forEach((hex, index) => {
    const colorPicker = document.getElementById(`_ColorStops${index}`) as HTMLInputElement;

    if (colorPicker) {
      colorPicker.value = hex;
      const rgb = hexToRgb(hex);

      if (rgb) {
        shaderParams[`_ColorStops${index}` as keyof typeof shaderParams] = { x: rgb.r, y: rgb.g, z: rgb.b };
        materials.forEach(material => {
          material.setVector3(`_ColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
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

  jsonValue.materials[0].floats = jsonValue.materials[0].floats || {};
  jsonValue.materials[0].vector3s = jsonValue.materials[0].vector3s || {};
  jsonValue.materials[0].textures = jsonValue.materials[0].textures || {};

  Object.entries(shaderParams).forEach(([key, value]) => {
    if (typeof value === 'number') {
      jsonValue.materials[0].floats[key] = value;
    }
  });

  ['_ColorStops0', '_ColorStops1', '_ColorStops2'].forEach((colorName, index) => {
    jsonValue.materials[0].vector3s[colorName] = shaderParams[colorName as keyof typeof shaderParams];
  });

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;

  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_3');

  const audioStateMachine: AudioStateMachine = new AudioStateMachine(64);

  const engine = composition.renderer.engine;

  let audioTexture: Texture;

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    for (const component of rendererComponents) {
      const { materials: componentMaterials } = component;

      for (const material of componentMaterials) {
        setBlendMode(material, spec.BlendingMode.ADD);
        material.depthMask = false;

        Object.entries(shaderParams).forEach(([key, value]) => {
          if (typeof value === 'number') {
            material.setFloat(key, value);
          }
        });

        ['_ColorStops0', '_ColorStops1', '_ColorStops2'].forEach((colorName, index) => {
          const color = shaderParams[colorName as keyof typeof shaderParams];

          material.setVector3(colorName, new math.Vector3(color.x, color.y, color.z));
        });

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

  createControlPanel();
  initializeControls();

  // 消隐动画变量
  const isSpeaking = false;
  //let wasSpeaking = false;
  let fadeProgressGlobal = 0;
  let fadeProgressMask = 0;
  const fadeThreshold = 0.2;
  const speakState: AudioStage = AudioStage.Idle;

  audioStateMachine.setUseRealData(true);

  audioStateMachine.start((audioData: AudioData) => {
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
      //console.log(`Average Amplitude: ${avgAmplitude.toFixed(3)}`);
      // 状态判断
      const envLevel = 0.05; // 环境底噪值

      //设置每个状态持续时间
      audioStateMachine.setStageDuration(AudioStage.Idle, 2.5);
      audioStateMachine.setStageDuration(AudioStage.FadeIn, 3.0);
      audioStateMachine.setStageDuration(AudioStage.Speaking, 3.0);
      audioStateMachine.setStageDuration(AudioStage.FadeOut, 2.0);

      // 例如，t 是时间（单位可以是秒、毫秒等），speed 控制周期快慢
      const t = Date.now() / 10000;
      const speed = 1; // 1 表示完整周期为2秒（如果t单位是秒）
      let volume = (Math.sin(Math.PI * 2 * speed * t)) ;

      volume = Math.max(0, Math.min(1, volume));//音量大小数据

      //console.log(`Volume: ${volume.toFixed(3)}}`);
      //打印状态
      //console.log(`Current Stage: ${audioStateMachine.getStage()}`);

      // 状态判断与切换，全部交给类内部
      audioStateMachine.updateSpeakState(
        volume,
        envLevel,
        fadeThreshold
      );

      // 状态机驱动（消隐动画推进）
      const driveResult = audioStateMachine.driveState(
        fadeProgressGlobal,
        fadeProgressMask,
        { fadeSpeedGlobal: shaderParams.fadeSpeedGlobal, fadeSpeedMask: shaderParams.fadeSpeedMask },
        volume,      // 音量均值
        fadeThreshold      // 阈值
      );

      fadeProgressGlobal = driveResult.fadeProgressGlobal;
      fadeProgressMask = driveResult.fadeProgressMask;
      //打印driveResult三个数据
      //console.log(`Fade Progress Global: ${fadeProgressGlobal.toFixed(3)}, Fade Progress Mask: ${fadeProgressMask.toFixed(3)}, Stage: ${audioSimulator.getStage()}`);
      // 设置shader参数
      materials.forEach((material: Material) => {
        // 传递你设定的最大/最小音量和当前音量到shader
        const minVolume = shaderParams._AudioMin !== undefined ? shaderParams._AudioMin : 0.0;
        const maxVolume = shaderParams._AudioMax !== undefined ? shaderParams._AudioMax : 1.0;
        const currentVolume = volume; // 当前音量

        material.setFloat('_AudioMin', minVolume);
        material.setFloat('_AudioMax', maxVolume);
        material.setFloat('_AudioCurrent', currentVolume);

        material.setFloat('_FadeMode', audioStateMachine.getStage());
        material.setFloat('_Amplitude', shaderParams._Amplitude);
        // material.setFloat('uAudioInfluence', volume); // 已被uAudioCurrent替代
        //material.setFloat('_ColorStops0', shaderParams._ColorStops0);
        material.setFloat('_FadeProgressGlobal', fadeProgressGlobal);
        material.setFloat('_FadeProgressMask', fadeProgressMask);
        material.setFloat('_FadeOffset', shaderParams._FadeOffset);
      });
    }
  }, 60);

  player.play();

  window.addEventListener('beforeunload', () => {
    audioStateMachine.stop();
  });
})();

function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}