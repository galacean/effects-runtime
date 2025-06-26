import type { Material } from '@galacean/effects';
import { Player, RendererComponent, Texture, glContext, setBlendMode, spec, math } from '@galacean/effects';
import { Vector3 } from '@galacean/effects-plugin-model';
import type { AudioData } from './audio-state-machine';
import AudioStateMachine, { AudioStage } from './audio-state-machine';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*piz4QagroQ0AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');

// UI控制参数，新增消隐速度和uFadeOffset
const shaderParams = {
  amplitude: 1.0,
  blend: 0.5,
  audioInfluence: 1.0,
  audioMultiplier: 2.0,
  timeSpeed: 0.5,
  noiseScale: 2.0,
  heightMultiplier: 0.5,
  midPoint: 0.20,
  intensityMultiplier: 0.6,
  yOffset: 0.2,
  heightPower: 1.0,
  minIntensity: 0.0,
  maxIntensity: 1.0,
  uRevealEdge: 0.05,
  colorStops: [
    { x: 0.32, y: 0.15, z: 1.0 },
    { x: 0.49, y: 1.0, z: 0.40 },
    { x: 0.32, y: 0.15, z: 1.0 },
  ],
  uFadeProgressGlobal: 0.0, // 新增
  uFadeProgressMask: 0.0,   // 新增
  fadeSpeedGlobal: 0.005,   // 新增
  fadeSpeedMask: 0.008,     // 新增
  uFadeOffset: 0.0,         // 新增
  uAudioBrightness: 1.0,     // 新增
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
uniform float uAmplitude;
uniform vec3 uColorStops0;
uniform vec3 uColorStops1;
uniform vec3 uColorStops2;
uniform float uBlend;
uniform float minIntensity;
uniform float maxIntensity;
uniform sampler2D uAudioTexture;
uniform float uAudioInfluence;
uniform float uAudioMultiplier;
uniform float uTimeSpeed;
uniform float uNoiseScale;
uniform float uHeightMultiplier;
uniform float uMidPoint;
uniform float uIntensityMultiplier;
uniform float uYOffset;
uniform float uHeightPower;
uniform float uRevealEdge;
uniform float uFadeProgressGlobal; // 新增
uniform float uFadeProgressMask;   // 新增
uniform float uFadeOffset; // 控制消隐横坐标偏移
uniform float uFadeMode; // 0: 淡入, 1: 淡出, 2: 全显
uniform float uAudioBrightness; // 

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
    colorStops[0] = uColorStops0;
    colorStops[1] = uColorStops1;
    colorStops[2] = uColorStops2;

    // 用 stops 替换为 stops 数量，避免 idx 越界
    float scaled = factor * float(stops);
    int idx = int(floor(scaled)) % stops;
    float t = fract(scaled);

    // 环形渐变，最后一个和第一个插值
    vec3 c0 = colorStops[idx];
    vec3 c1 = colorStops[(idx + 1) % stops];

    return mix(c0, c1, t);
}

void main() {
  vec2 uvCoord = vec2(uv.x, 1.0 - uv.y);
  
  float audioData = texture2D(uAudioTexture, vec2(uvCoord.x, 0.5)).r;
  

  //float edge = min(uRevealEdge, uAudioInfluence );
  //float revealMask = smoothstep(1.0 - uAudioInfluence - edge, 1.0 - uAudioInfluence, uvCoord.x);
  
  //float dynamicTimeSpeed = mix(0.1, 1.0, uAudioInfluence); // revealMask 越大，速度越快
  float time = _Time.y * uTimeSpeed ; 

  float wavePhase = uvCoord.x * uNoiseScale + time * 0.1;
  
  float offset1 = 0.2;
  float offset2 = 0.4;
  vec3 colorA = getColorFromGradient(wavePhase);
  vec3 colorB = getColorFromGradient(wavePhase + offset1);
  vec3 colorC = getColorFromGradient(wavePhase + offset2);

  vec3 rampColor = mix(mix(colorA, colorB, uAudioInfluence), colorC, uAudioInfluence * 0.5);

  float baseNoise = snoise(vec2(wavePhase, time * 0.25)) * 0.5 * uAmplitude;
  // 用uAudioInfluence控制起伏幅度，0时无起伏，1时最大起伏
  float height = mix(0.5*baseNoise, baseNoise, uAudioInfluence);

  float normHeight = (height + uAmplitude * 0.5) / uAmplitude;
  normHeight = pow(normHeight, 1.0 / uHeightPower);
  height = normHeight * uAmplitude - uAmplitude * 0.5;

  height += uYOffset;
  height = exp(height);
  height = (uvCoord.y * 2.0 - height + 0.2 )* uHeightMultiplier;

  float intensity = uIntensityMultiplier* height;

  float edge0 = min(uMidPoint - uBlend * 0.5, minIntensity);
  float edge1 = max(uMidPoint + uBlend * 0.5, maxIntensity);
  float auroraAlpha = smoothstep(edge0, edge1, intensity);
  
  vec3 auroraColor = rampColor * (1.0 + uAudioInfluence * uAudioBrightness);
  auroraColor = acesToneMapping(auroraColor); // 限制高亮，防止过曝

  //从右往左显现

  //auroraAlpha *= revealMask;
  // 用revealMask提亮auroraColor
  //auroraColor *= (1.0 + uAudioInfluence); // 亮度提升，revealMask越大越亮



  // 右到左淡出遮罩
  float fadeEdge = 0.2;
  //float fadeOutMask = 1.0 - smoothstep(1.0 + uFadeProgressMask - fadeEdge, 1.0 +  uFadeProgressMask, uvCoord.x);

  // 右到左淡入遮罩（与淡出相反，uFadeProgressMask从1到0时显现）
  float fadeInMask =1.0- smoothstep(1.0 - uFadeProgressMask - fadeEdge, 1.0 - uFadeProgressMask,1.0 - uvCoord.x- uFadeOffset);

  // 你可以选择用哪个mask，或两者结合
  // auroraAlpha *= fadeInMask; // 只用淡入
  // auroraAlpha *= fadeOutMask; // 只用淡出
  // auroraAlpha *= fadeInMask * fadeOutMask; // 叠加

  // 推荐：淡入淡出都支持
  //auroraAlpha *=  fadeOutMask;

  // 整体消隐（用uFadeProgressGlobal和uFadeOffset控制）
//float fadeCoord = clamp((uvCoord.x - uFadeOffset) / (1.0 - uFadeOffset), 0.0, 1.0);
  float fade = 1.0 - pow(mix(uFadeProgressGlobal, 1.0, uvCoord.x - uFadeOffset), 2.0);


    // 叠加遮罩
    //float totalfade = (1.0 - fade);

    //auroraAlpha *= totalfade;

    float mask = 1.0;
    if (uFadeMode == 0.0) {
      mask = 0.0;
    } else if (uFadeMode == 1.0) {
      mask = fadeInMask;
      }
      else if (uFadeMode == 2.0) {
      mask = 1.0;
    } else if (uFadeMode == 3.0) {
      mask = fade ;
    }

    auroraAlpha *= mask;

    gl_FragColor = vec4(auroraColor*auroraAlpha, auroraAlpha);
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
      <h3>音频效果</h3>
      <div class="control-item">
        <label for="amplitude">Amplitude (振幅)</label>
        <input type="range" id="amplitude" min="0" max="3" step="0.01" value="1.0">
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
      <div class="control-item">
        <label for="uAudioBrightness">Audio Brightness (音频亮度影响)</label>
        <input type="range" id="uAudioBrightness" min="0" max="5" step="0.01" value="1.0">
        <div class="value-display" id="uAudioBrightness-value">1.0</div>
      </div>
    </div>
    <div class="control-group">
      <h3>极光效果</h3>
      <div class="control-item">
        <label for="blend">Blend Factor (混合因子)</label>
        <input type="range" id="blend" min="0" max="5" step="0.05" value="0.5">
        <div class="value-display" id="blend-value">0.5</div>
      </div>
      <div class="control-item">
        <label for="midPoint">Mid Point (中点位置)</label>
        <input type="range" id="midPoint" min="0" max="2" step="0.01" value="0.20">
        <div class="value-display" id="midPoint-value">0.20</div>
      </div>
      <div class="control-item">
        <label for="intensityMultiplier">Intensity (强度倍数)</label>
        <input type="range" id="intensityMultiplier" min="0" max="2" step="0.1" value="0.6">
        <div class="value-display" id="intensityMultiplier-value">0.6</div>
      </div>
      <div class="control-item">
        <label for="yOffset">Y Offset (Y偏移)</label>
        <input type="range" id="yOffset" min="-1" max="1" step="0.01" value="0.2">
        <div class="value-display" id="yOffset-value">0.15</div>
      </div>
      <div class="control-item">
        <label for="uRevealEdge">Reveal Edge (显隐过渡宽度)</label>
        <input type="range" id="uRevealEdge" min="0.001" max="1.0" step="0.001" value="0.05">
        <div class="value-display" id="uRevealEdge-value">0.05</div>
      </div>
    </div>
    <div class="control-group">
      <h3>噪声动画</h3>
      <div class="control-item">
        <label for="timeSpeed">Time Speed (时间速度)</label>
        <input type="range" id="timeSpeed" min="0" max="10" step="0.1" value="0.5">
        <div class="value-display" id="timeSpeed-value">2.5</div>
      </div>
      <div class="control-item">
        <label for="noiseScale">Noise Scale (噪声缩放)</label>
        <input type="range" id="noiseScale" min="0.5" max="5" step="0.1" value="2.0">
        <div class="value-display" id="noiseScale-value">0.70</div>
      </div>
      <div class="control-item">
        <label for="heightMultiplier">Height Multiplier (高度倍数)</label>
        <input type="range" id="heightMultiplier" min="0" max="5" step="0.1" value="0.5">
        <div class="value-display" id="heightMultiplier-value">1.0</div>
      </div>
      <div class="control-item">
        <label for="heightPower">Height Power (高度幂次)</label>
        <input type="range" id="heightPower" min="0.1" max="10" step="0.01" value="1.0">
        <div class="value-display" id="heightPower-value">1.60</div>
      </div>
    </div>
    <div class="control-group">
      <h3>消隐速度</h3>
      <div class="control-item">
        <label for="fadeSpeedGlobal">整体消隐速度 (fadeSpeedGlobal)</label>
        <input type="range" id="fadeSpeedGlobal" min="0.001" max="0.05" step="0.001" value="0.005">
        <div class="value-display" id="fadeSpeedGlobal-value">0.035</div>
      </div>
      <div class="control-item">
        <label for="fadeSpeedMask">右到左消隐速度 (fadeSpeedMask)</label>
        <input type="range" id="fadeSpeedMask" min="0.001" max="0.05" step="0.001" value="0.008">
        <div class="value-display" id="fadeSpeedMask-value">0.025</div>
      </div>
      <div class="control-item">
        <label for="uFadeOffset">消隐横坐标偏移 (uFadeOffset)</label>
        <input type="range" id="uFadeOffset" min="0" max="0.95" step="0.01" value="0.0">
        <div class="value-display" id="uFadeOffset-value">0.00</div>
      </div>
    </div>
    <div class="control-item">
      <label for="minIntensity">Min Intensity (最小强度)</label>
      <input type="range" id="minIntensity" min="-2" max="2" step="0.01" value="0.0">
      <div class="value-display" id="minIntensity-value">0.00</div>
    </div>
    <div class="control-item">
      <label for="maxIntensity">Max Intensity (最大强度)</label>
      <input type="range" id="maxIntensity" min="-2" max="2" step="0.01" value="1.0">
      <div class="value-display" id="maxIntensity-value">1.00</div>
    </div>
    <div class="control-group">
      <h3>极光颜色</h3>
      <div class="control-item">
        <label for="colorStop0">Color Stop 0</label>
        <input type="color" id="colorStop0" class="color-input">
      </div>
      <div class="control-item">
        <label for="colorStop1">Color Stop 1</label>
        <input type="color" id="colorStop1" class="color-input">
      </div>
      <div class="control-item">
        <label for="colorStop2">Color Stop 2</label>
        <input type="color" id="colorStop2" class="color-input">
      </div>
    </div>
    <button class="reset-btn" onclick="resetToDefaults()">重置为默认值</button>
  `;

  document.body.appendChild(panel);
}

// 初始化UI控制，支持uFadeOffset
function initializeControls () {
  const controls = [
    'amplitude', 'audioInfluence', 'audioMultiplier', 'blend', 'timeSpeed',
    'noiseScale', 'heightMultiplier', 'midPoint', 'intensityMultiplier', 'yOffset',
    'heightPower', 'minIntensity', 'maxIntensity', 'uRevealEdge',
    'fadeSpeedGlobal', 'fadeSpeedMask', 'uFadeOffset', // 新增
    'uAudioBrightness', // 新增
  ];

  controls.forEach(controlName => {
    const slider = document.getElementById(controlName) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${controlName}-value`);

    if (slider && valueDisplay) {
      slider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        valueDisplay.textContent = value.toFixed(3);

        // 更新材质参数
        const uniformName = controlName.startsWith('u') ? controlName : `u${controlName.charAt(0).toUpperCase() + controlName.slice(1)}`;

        // 只对shader uniform的参数设置
        if (controlName !== 'fadeSpeedGlobal' && controlName !== 'fadeSpeedMask') {
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
  ['colorStop0', 'colorStop1', 'colorStop2'].forEach((colorName, index) => {
    const colorPicker = document.getElementById(colorName) as HTMLInputElement;

    if (colorPicker) {
      // 设置初始颜色
      const color = shaderParams.colorStops[index];

      colorPicker.value = rgbToHex(color.x, color.y, color.z);

      colorPicker.addEventListener('input', e => {
        const hex = (e.target as HTMLInputElement).value;
        const rgb = hexToRgb(hex);

        if (rgb) {
          shaderParams.colorStops[index] = { x: rgb.r, y: rgb.g, z: rgb.b };

          materials.forEach(material => {
            material.setVector3(`uColorStops${index}`, new math.Vector3(rgb.r, rgb.g, rgb.b));
          });
        }
      });
    }
  });
}

// 重置为默认值，支持uFadeOffset
function resetToDefaults () {
  const defaults = {
    amplitude: 0.150,
    audioInfluence:1.10,
    audioMultiplier: 4.0,
    blend: 3.70,
    timeSpeed: 2.1,
    noiseScale: 0.90,
    heightMultiplier: 3.9,
    midPoint: 0.86,
    intensityMultiplier: 1.5,
    yOffset: 0.48,
    heightPower: 0.58,
    uRevealEdge: 0.299,
    fadeSpeedGlobal: 0.035,
    fadeSpeedMask: 0.025,
    uFadeOffset: 0.0, // 新增
    uAudioBrightness: 1.0, // 新增
  };

  Object.entries(defaults).forEach(([key, value]) => {
    const slider = document.getElementById(key) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${key}-value`);

    if (slider && valueDisplay) {
      slider.value = value.toString();
      valueDisplay.textContent = Number(value).toFixed(3);

      // 统一生成 uniform 名称
      const uniformName = key.startsWith('u') ? key : `u${key.charAt(0).toUpperCase() + key.slice(1)}`;

      if (key !== 'fadeSpeedGlobal' && key !== 'fadeSpeedMask') {
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

  shaderParams.colorStops.forEach((color, index) => {
    jsonValue.materials[0].vector3s[`uColorStops${index}`] = color;
  });

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;

  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_3');

  const audioStateMachine: AudioStateMachine = new AudioStateMachine(64);

  // 可自定义每个阶段的时长（单位：秒）
  //audioSimulator.setStageDuration(AudioStage.Idle, 2.0);
  //audioSimulator.setStageDuration(AudioStage.FadeIn, 5.5);
  //audioSimulator.setStageDuration(AudioStage.Speaking, 5.0);
  //audioSimulator.setStageDuration(AudioStage.FadeOut, 3.5);

  //audioSimulator.start(callback, 60);
  // 不需要 startAutoLoop，也不需要外部 setStage

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

        shaderParams.colorStops.forEach((color, index) => {
          material.setVector3(`uColorStops${index}`, new math.Vector3(color.x, color.y, color.z));
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
  let fadeProgressGlobal = 0; // 0~1
  let fadeProgressMask = 0;   // 0~1
  const fadeThreshold = 0.2;
  const speakState: AudioStage = AudioStage.Idle;

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
      // 状态判断
      const envLevel = 0; // 新增：环境底噪值（如无特殊需求可设为0）

      //设置每个状态持续时间
      audioStateMachine.setStageDuration(AudioStage.Idle, 2.0);
      audioStateMachine.setStageDuration(AudioStage.FadeIn, 1.5);
      audioStateMachine.setStageDuration(AudioStage.Speaking, 5.0);
      audioStateMachine.setStageDuration(AudioStage.FadeOut, 1.5);

      // 状态判断与切换，全部交给类内部
      audioStateMachine.updateSpeakState(
        avgAmplitude,
        envLevel,
        fadeThreshold
      );

      // 状态机驱动（消隐动画推进），用实例方法
      const driveResult = audioStateMachine.driveState(
        fadeProgressGlobal,
        fadeProgressMask,
        { fadeSpeedGlobal: shaderParams.fadeSpeedGlobal, fadeSpeedMask: shaderParams.fadeSpeedMask }
      );

      fadeProgressGlobal = driveResult.fadeProgressGlobal;
      fadeProgressMask = driveResult.fadeProgressMask;
      //打印driveResult三个数据
      //console.log(`Fade Progress Global: ${fadeProgressGlobal.toFixed(3)}, Fade Progress Mask: ${fadeProgressMask.toFixed(3)}, Stage: ${audioSimulator.getStage()}`);
      // 设置shader参数
      materials.forEach((material: Material) => {
        material.setFloat('uFadeMode', audioStateMachine.getStage()); // 用 getStage() 替代 .stage
        material.setFloat('uAmplitude', shaderParams.amplitude);
        material.setFloat('uAudioInfluence', avgAmplitude);
        material.setFloat('uRevealEdge', shaderParams.uRevealEdge);
        material.setFloat('uFadeProgressGlobal', fadeProgressGlobal);
        material.setFloat('uFadeProgressMask', fadeProgressMask);
        material.setFloat('uFadeOffset', shaderParams.uFadeOffset);
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