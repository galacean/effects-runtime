import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';
import { Vector3 } from '@galacean/effects-plugin-model';
import type { AudioData } from './audio-state-machine';
import AudioStateMachine, { AudioStage } from './audio-state-machine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*piz4QagroQ0AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数，全部用shader里的uniform名字
type ShaderParams = {
  [key: string]: number | { x: number, y: number, z: number, a: number }[], // index signature for string keys
  _Amplitude: number,
  _Blend: number,
  _TimeSpeed: number,
  _NoiseScale: number,
  _HeightMultiplier: number,
  _MidPoint: number,
  _IntensityMultiplier: number,
  _YOffset: number,
  _HeightPower: number,
  _MinIntensity: number,
  _MaxIntensity: number,
  _AudioMin: number,
  _AudioMax: number,
  _FadeProgressGlobal: number,
  _FadeProgressMask: number,
  _FadeSpeedGlobal: number,
  _FadeSpeedMask: number,
  _FadeOffset: number,
  _AudioBrightness: number,
  _AudioSensitivity: number,
  _FadeStart: number,
  _FadeEnd: number,
  _ColorStops: { x: number, y: number, z: number, a: number }[],
};

const shaderParams: ShaderParams = {
  _Amplitude: 0.150,
  _Blend: 1.250,
  _TimeSpeed: 2.100,
  _NoiseScale: 0.900,
  _HeightMultiplier: 3.900,
  _MidPoint: 0.860,
  _IntensityMultiplier: 1.500,
  _YOffset: 0.480,
  _HeightPower: 0.580,
  _MinIntensity: 0.330,
  _MaxIntensity: 1.050,
  _AudioMin: 0.0,
  _AudioMax: 1.0,
  _FadeProgressGlobal: 0.0,
  _FadeProgressMask: 0.0,
  _FadeSpeedGlobal: 0.035,
  _FadeSpeedMask: 0.025,
  _FadeOffset: 0.230,
  _AudioBrightness: 1.000,
  _AudioSensitivity: 2.0,
  _FadeStart: 0.000,
  _FadeEnd: 0.780,
  _ColorStops: [
    { x: 0.00, y: 0.15, z: 1.0, a: 1.0 },
    { x: 0.49, y: 1.0, z: 0.40, a: 1.0 },
    { x: 0.32, y: 0.15, z: 1.0, a: 1.0 },
  ],
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
uniform float _Amplitude;
uniform vec4 _ColorStops0;
uniform vec4 _ColorStops1;
uniform vec4 _ColorStops2;
uniform float _Blend;
uniform float _MinIntensity;
uniform float _MaxIntensity;
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

  vec4 getColorFromGradient(float factor) {
  factor = fract(factor);
  const int stops = 3;
  vec4 colorStops[3];
  colorStops[0] = _ColorStops0;
  colorStops[1] = _ColorStops1;
  colorStops[2] = _ColorStops2;
  float scaled = factor * float(stops);
  int idx = int(floor(scaled)) % stops;
  float t = fract(scaled);
  vec4 c0 = colorStops[idx];
  vec4 c1 = colorStops[(idx + 1) % stops];
  return mix(c0, c1, t);
}

void main() {
  vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);
  
  float time = _Time.y * _TimeSpeed ; 

  float wavePhase = uvCoord.x * _NoiseScale + time * 0.1;
  
  float offset1 = 0.2;
  float offset2 = 0.4;
  vec4 colorA = getColorFromGradient(wavePhase);
  vec4 colorB = getColorFromGradient(wavePhase + offset1);
  vec4 colorC = getColorFromGradient(wavePhase + offset2);

  // 归一化音量
  float normalizedAudio = clamp((_AudioCurrent - _AudioMin) / max(0.0001, _AudioMax - _AudioMin), 0.0, 1.0);

  // 用 normalizedAudio 
  vec3 rampColor = mix(mix(colorA.rgb, colorB.rgb, normalizedAudio), colorC.rgb, normalizedAudio * 0.5);
  float auroraAlpha = colorA.a;

    // 添加亮度曲线控制，增加灵敏度参数
  float audioFactor = pow(normalizedAudio, _AudioSensitivity); // 灵敏度可调
  float brightness = mix(_MinIntensity, _MaxIntensity, audioFactor);

    // 保持颜色特征的同时提亮
  vec3 auroraColor = rampColor  * _AudioBrightness;

  float baseNoise = snoise(vec2(wavePhase, time * 0.25)) * 0.5 * _Amplitude;
  // 用normalizedAudio控制起伏幅度，0时无起伏，1时最大起伏
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
  auroraAlpha = smoothstep(edge0, edge1, intensity);
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
  // 右到左淡入遮罩（与淡出相反，_FadeProgressMask从1到0时显现）
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
    <h2 style="margin-top: 0; color: #4CAF50;">Shader Controls</h2>
    <div class="control-group">
      <h3>形态参数</h3>
      <div class="control-item">
        <label for="_Amplitude">_Amplitude（起伏幅度）</label>
        <input type="range" id="_Amplitude" min="0" max="3" step="0.01" value="${shaderParams._Amplitude}">
        <div class="value-display" id="_Amplitude-value">${shaderParams._Amplitude.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_Blend">_Blend（混合宽度）</label>
        <input type="range" id="_Blend" min="0" max="5" step="0.05" value="${shaderParams._Blend}">
        <div class="value-display" id="_Blend-value">${shaderParams._Blend.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_MidPoint">_MidPoint（中心线位置）</label>
        <input type="range" id="_MidPoint" min="0" max="2" step="0.01" value="${shaderParams._MidPoint}">
        <div class="value-display" id="_MidPoint-value">${shaderParams._MidPoint.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_IntensityMultiplier">_IntensityMultiplier（强度系数）</label>
        <input type="range" id="_IntensityMultiplier" min="0" max="2" step="0.1" value="${shaderParams._IntensityMultiplier}">
        <div class="value-display" id="_IntensityMultiplier-value">${shaderParams._IntensityMultiplier.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_YOffset">_YOffset（垂直偏移）</label>
        <input type="range" id="_YOffset" min="-1" max="1" step="0.01" value="${shaderParams._YOffset}">
        <div class="value-display" id="_YOffset-value">${shaderParams._YOffset.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_HeightPower">_HeightPower（高度变化幂次）</label>
        <input type="range" id="_HeightPower" min="0.1" max="10" step="0.01" value="${shaderParams._HeightPower}">
        <div class="value-display" id="_HeightPower-value">${shaderParams._HeightPower.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_HeightMultiplier">_HeightMultiplier（高度缩放）</label>
        <input type="range" id="_HeightMultiplier" min="0" max="5" step="0.1" value="${shaderParams._HeightMultiplier}">
        <div class="value-display" id="_HeightMultiplier-value">${shaderParams._HeightMultiplier.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_NoiseScale">_NoiseScale（噪声强度）</label>
        <input type="range" id="_NoiseScale" min="0.5" max="5" step="0.1" value="${shaderParams._NoiseScale}">
        <div class="value-display" id="_NoiseScale-value">${shaderParams._NoiseScale.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_AudioMin">_AudioMin（音量归一化下限）</label>
        <input type="range" id="_AudioMin" min="0" max="100" step="0.01" value="${shaderParams._AudioMin}">
        <div class="value-display" id="_AudioMin-value">${shaderParams._AudioMin.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_AudioMax">_AudioMax（音量归一化上限）</label>
        <input type="range" id="_AudioMax" min="0" max="100" step="0.01" value="${shaderParams._AudioMax}">
        <div class="value-display" id="_AudioMax-value">${shaderParams._AudioMax.toFixed(3)}</div>
      </div>
    </div>
    <div class="control-group">
      <h3>动画与消隐参数</h3>
      <div class="control-item">
        <label for="_TimeSpeed">_TimeSpeed（动画速度）</label>
        <input type="range" id="_TimeSpeed" min="0" max="10" step="0.1" value="${shaderParams._TimeSpeed}">
        <div class="value-display" id="_TimeSpeed-value">${shaderParams._TimeSpeed.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeSpeedGlobal">_FadeSpeedGlobal（整体消隐速度）</label>
        <input type="range" id="_FadeSpeedGlobal" min="0.001" max="0.05" step="0.001" value="${shaderParams._FadeSpeedGlobal}">
        <div class="value-display" id="_FadeSpeedGlobal-value">${shaderParams._FadeSpeedGlobal.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeSpeedMask">_FadeSpeedMask（横向消隐速度）</label>
        <input type="range" id="_FadeSpeedMask" min="0.001" max="0.05" step="0.001" value="${shaderParams._FadeSpeedMask}">
        <div class="value-display" id="_FadeSpeedMask-value">${shaderParams._FadeSpeedMask.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeOffset">_FadeOffset（消隐偏移）</label>
        <input type="range" id="_FadeOffset" min="0" max="0.95" step="0.01" value="${shaderParams._FadeOffset}">
        <div class="value-display" id="_FadeOffset-value">${shaderParams._FadeOffset.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_AudioBrightness">_AudioBrightness（音频亮度系数）</label>
        <input type="range" id="_AudioBrightness" min="0" max="5" step="0.01" value="${shaderParams._AudioBrightness}">
        <div class="value-display" id="_AudioBrightness-value">${shaderParams._AudioBrightness.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_AudioSensitivity">_AudioSensitivity（音量灵敏度）</label>
        <input type="range" id="_AudioSensitivity" min="1" max="3" step="0.01" value="${shaderParams._AudioSensitivity}">
        <div class="value-display" id="_AudioSensitivity-value">${shaderParams._AudioSensitivity.toFixed(2)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeStart">_FadeStart（消隐起始高度）</label>
        <input type="range" id="_FadeStart" min="0" max="1" step="0.01" value="${shaderParams._FadeStart}">
        <div class="value-display" id="_FadeStart-value">${shaderParams._FadeStart.toFixed(2)}</div>
      </div>
      <div class="control-item">
        <label for="_FadeEnd">_FadeEnd（消隐结束高度）</label>
        <input type="range" id="_FadeEnd" min="0" max="1" step="0.01" value="${shaderParams._FadeEnd}">
        <div class="value-display" id="_FadeEnd-value">${shaderParams._FadeEnd.toFixed(2)}</div>
      </div>
    </div>
    <div class="control-group">
      <h3>颜色</h3>
      <div class="control-item">
        <label for="colorStop0">_ColorStops0（颜色节点1）</label>
        <input type="color" id="colorStop0" class="color-input">
      </div>
      <div class="control-item">
        <label for="colorStop1">_ColorStops1（颜色节点2）</label>
        <input type="color" id="colorStop1" class="color-input">
      </div>
      <div class="control-item">
        <label for="colorStop2">_ColorStops2（颜色节点3）</label>
        <input type="color" id="colorStop2" class="color-input">
      </div>
    </div>
    <div class="control-group">
      <h3>强度参数</h3>
      <div class="control-item">
        <label for="_MinIntensity">_MinIntensity（最低响应亮度）</label>
        <input type="range" id="_MinIntensity" min="0" max="5" step="0.01" value="${shaderParams._MinIntensity}">
        <div class="value-display" id="_MinIntensity-value">${shaderParams._MinIntensity.toFixed(3)}</div>
      </div>
      <div class="control-item">
        <label for="_MaxIntensity">_MaxIntensity（最高响应亮度）</label>
        <input type="range" id="_MaxIntensity" min="0" max="5" step="0.01" value="${shaderParams._MaxIntensity}">
        <div class="value-display" id="_MaxIntensity-value">${shaderParams._MaxIntensity.toFixed(3)}</div>
      </div>
    </div>
    <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
  `;

  document.body.appendChild(panel);
}

// 初始化UI控制，支持uFadeOffset
function initializeControls () {
  const controls = [
    '_Amplitude', '_Blend', '_MidPoint', '_IntensityMultiplier', '_YOffset', '_HeightPower', '_HeightMultiplier', '_NoiseScale',
    '_MinIntensity', '_MaxIntensity', '_AudioMin', '_AudioMax',
    '_TimeSpeed', '_FadeSpeedGlobal', '_FadeSpeedMask', '_FadeOffset', '_AudioBrightness', '_AudioSensitivity', '_FadeStart', '_FadeEnd',
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      slider.value = String(shaderParams[controlName]);
      valueDisplay.textContent = Number(shaderParams[controlName]).toFixed(3);

      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(3);
        shaderParams[controlName] = value;
        if (material) {
          material.setFloat(controlName, value);
        }
      });
    }
  });

  // 颜色控制部分
  ['_ColorStops0', '_ColorStops1', '_ColorStops2'].forEach((uniformName, index) => {
    const colorPicker = document.getElementById(`colorStop${index}`) as HTMLInputElement;

    if (colorPicker) {
      const color = shaderParams._ColorStops[index];

      colorPicker.value = rgbToHex(color.x, color.y, color.z);
      colorPicker.addEventListener('input', e => {
        const hex = (e.target as HTMLInputElement).value;
        const rgb = hexToRgb(hex);

        if (rgb) {
          shaderParams._ColorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b, a: color.a ?? 1.0 };
          if (material) {
            material.setVector4(uniformName, new math.Vector4(rgb.r, rgb.g, rgb.b, color.a ?? 1.0));
          }
        }
      });
    }
  });
}

// 重置为默认值
function resetToDefaults () {
  const defaults = {
    _Amplitude: 0.150, _Blend: 1.250, _MidPoint: 0.860, _IntensityMultiplier: 1.500, _YOffset: 0.480,
    _HeightPower: 0.580, _HeightMultiplier: 3.900, _NoiseScale: 0.900, _TimeSpeed: 2.100,
    _FadeSpeedGlobal: 0.035, _FadeSpeedMask: 0.025, _FadeOffset: 0.230, _AudioBrightness: 1.000, _AudioSensitivity: 2.0, _FadeStart: 0.000, _FadeEnd: 0.780,
    _MinIntensity: 0.330, _MaxIntensity: 1.050, _AudioMin: 0.0, _AudioMax: 1.0,
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = String(value);
      valueDisplay.textContent = Number(value).toFixed(3);
      shaderParams[key] = value;
      if (material) {
        material.setFloat(key, value);
      }
    }
  });

  // 重置颜色
  const defaultColors = ['#00FFBF', '#00FF04', '#00FFBF'];

  defaultColors.forEach((hex, index) => {
    const colorPicker = document.getElementById(`colorStop${index}`) as HTMLInputElement;

    if (colorPicker) {
      colorPicker.value = hex;
      const rgb = hexToRgb(hex);

      if (rgb) {
        shaderParams._ColorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b, a: 1.0 };
        if (material) {
          material.setVector4(`_ColorStops${index}`, new math.Vector4(rgb.r, rgb.g, rgb.b, 1.0));
        }
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

let material: Material | undefined; // 声明为全局变量

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

  shaderParams._ColorStops.forEach((color, index) => {
    jsonValue.materials[0].vector4s = jsonValue.materials[0].vector4s || {};
    jsonValue.materials[0].vector4s[`_ColorStops${index}`] = color;
  });

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;

  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_3');

  const audioStateMachine: AudioStateMachine = new AudioStateMachine(64);

  const engine = composition.renderer.engine;

  // 初始化材质参数（只用第一个材质）
  function applyShaderParams (material: Material) {
    material.setFloat('_Amplitude', shaderParams._Amplitude);
    material.setFloat('_Blend', shaderParams._Blend);
    material.setFloat('_MidPoint', shaderParams._MidPoint);
    material.setFloat('_IntensityMultiplier', shaderParams._IntensityMultiplier);
    material.setFloat('_YOffset', shaderParams._YOffset);
    material.setFloat('_HeightPower', shaderParams._HeightPower);
    material.setFloat('_HeightMultiplier', shaderParams._HeightMultiplier);
    material.setFloat('_NoiseScale', shaderParams._NoiseScale);
    material.setFloat('_MinIntensity', shaderParams._MinIntensity);
    material.setFloat('_MaxIntensity', shaderParams._MaxIntensity);
    material.setFloat('_AudioMin', shaderParams._AudioMin);
    material.setFloat('_AudioMax', shaderParams._AudioMax);
    material.setFloat('_TimeSpeed', shaderParams._TimeSpeed);
    material.setFloat('_FadeOffset', shaderParams._FadeOffset);
    material.setFloat('_AudioBrightness', shaderParams._AudioBrightness);
    material.setFloat('_AudioSensitivity', shaderParams._AudioSensitivity);
    material.setFloat('_FadeStart', shaderParams._FadeStart);
    material.setFloat('_FadeEnd', shaderParams._FadeEnd);

    material.setFloat('_FadeStart', shaderParams._FadeStart);
    material.setFloat('_FadeEnd', shaderParams._FadeEnd);

    // 颜色节点
    material.setVector4('_ColorStops0', new math.Vector4(
      shaderParams._ColorStops[0].x,
      shaderParams._ColorStops[0].y,
      shaderParams._ColorStops[0].z,
      shaderParams._ColorStops[0].a
    ));
    material.setVector4('_ColorStops1', new math.Vector4(
      shaderParams._ColorStops[1].x,
      shaderParams._ColorStops[1].y,
      shaderParams._ColorStops[1].z,
      shaderParams._ColorStops[1].a
    ));
    material.setVector4('_ColorStops2', new math.Vector4(
      shaderParams._ColorStops[2].x,
      shaderParams._ColorStops[2].y,
      shaderParams._ColorStops[2].z,
      shaderParams._ColorStops[2].a
    ));
  }

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    if (rendererComponents.length > 0) {
      const componentMaterials = rendererComponents[0].materials;

      if (componentMaterials.length > 0) {
        material = componentMaterials[0]; // 赋值到全局变量

        setBlendMode(material, spec.BlendingMode.ADD);
        material.depthMask = false;

        applyShaderParams(material);
      }
    }
  }

  createControlPanel();
  initializeControls();
  // 初始化音频状态机
  let fadeProgressGlobal = 0;
  let fadeProgressMask = 0;

  // 环境音量阈值（建议参数化到编辑器）
  const envLevel = 0.05;
  // 消逝阈值（建议参数化到编辑器）
  const fadeThreshold = 0.2;

  // 音频状态机各阶段持续时间（建议参数化到编辑器）
  audioStateMachine.setStageDuration(AudioStage.Idle, 2.5);
  audioStateMachine.setStageDuration(AudioStage.FadeIn, 3.0);
  audioStateMachine.setStageDuration(AudioStage.Speaking, 3.0);
  audioStateMachine.setStageDuration(AudioStage.FadeOut, 2.0);

  audioStateMachine.setUseRealData(true);

  audioStateMachine.start(() => {
    if (material) {

      material.setFloat('_MinIntensity', shaderParams._MinIntensity);
      material.setFloat('_MaxIntensity', shaderParams._MaxIntensity);
      material.setFloat('_FadeStart', shaderParams._FadeStart);
      material.setFloat('_FadeEnd', shaderParams._FadeEnd);

      audioStateMachine.setStageDuration(AudioStage.Idle, 2.5);
      audioStateMachine.setStageDuration(AudioStage.FadeIn, 3.0);
      audioStateMachine.setStageDuration(AudioStage.Speaking, 3.0);
      audioStateMachine.setStageDuration(AudioStage.FadeOut, 2.0);

      const t = Date.now() / 10000;
      const speed = 1;
      let volume = (Math.sin(Math.PI * 2 * speed * t));

      //当前音量值（建议参数化到编辑器）
      volume = Math.max(0, Math.min(1, volume));

      audioStateMachine.updateSpeakState(volume, envLevel, fadeThreshold);

      const driveResult = audioStateMachine.driveState(
        fadeProgressGlobal,
        fadeProgressMask,
        { fadeSpeedGlobal: shaderParams._FadeSpeedGlobal, fadeSpeedMask: shaderParams._FadeSpeedMask },
        volume,
        fadeThreshold
      );

      fadeProgressGlobal = driveResult.fadeProgressGlobal;
      fadeProgressMask = driveResult.fadeProgressMask;

      // 传递音量和消隐参数
      material.setFloat('_AudioMin', shaderParams._AudioMin);
      material.setFloat('_AudioMax', shaderParams._AudioMax);
      material.setFloat('_AudioCurrent', volume);
      material.setFloat('_FadeMode', audioStateMachine.getStage());
      material.setFloat('_Amplitude', shaderParams._Amplitude);
      material.setFloat('_FadeProgressGlobal', fadeProgressGlobal);
      material.setFloat('_FadeProgressMask', fadeProgressMask);
      material.setFloat('_FadeOffset', shaderParams._FadeOffset);
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