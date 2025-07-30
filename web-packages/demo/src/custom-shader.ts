/* eslint-disable no-console */
/**
 * 音频可视化效果核心实现
 * 功能：
 * 1. 监听阶段：单纹理移动和透明度变化
 * 2. 输入阶段：多纹理混合移动
 * 3. 基于音量检测的状态切换
 */
import type { Material } from '@galacean/effects';
import { Player, RendererComponent, setBlendMode, spec } from '@galacean/effects';
import { math } from '@galacean/effects-core';
const { Vector4 } = math;

import { Texture, glContext } from '@galacean/effects-core';
import { TextureController } from './texture-controller.js';
enum MainStage { Listening, Input, Stop }

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*h_BxQYS9C30AAAAAQDAAAAgAelB4AQ';
const container = document.getElementById('J-container');
// 调试模式开关
const DEBUG = true; // 调试模式开关

// 确保Shader参数范围正确
function clampOffset (value: number): number {
  return Math.max(-1000, Math.min(1000, value));
}

// 初始化日志
if (DEBUG) {
  // eslint-disable-next-line no-console
  //console.log('Custom Shader Initializing...');
}

// 核心Shader参数
interface ShaderParams {
  _CanvasAspect: number, // 画布宽高比
  _TextureAspect: number, // 纹理宽高比
  _TextureCount: number, // 当前活动纹理数量
}

const shaderParams: ShaderParams = {
  _CanvasAspect: 1,
  _TextureAspect: 1,
  _TextureCount: 0,
};

// 最大支持的纹理数量
const MAX_TEXTURES = 4;

/**
 * 顶点Shader
 * 基本顶点变换，传递UV坐标
 */
const vertex = `
precision highp float;

attribute vec3 aPos;       // 顶点位置
attribute vec2 aUV;        // UV坐标
varying vec2 uv;           // 传递给片段Shader的UV
uniform mat4 effects_ObjectToWorld; // 模型矩阵
uniform mat4 effects_MatrixVP;      // 视图投影矩阵

void main(){
  uv = aUV;
  gl_Position = effects_MatrixVP * effects_ObjectToWorld * vec4(aPos, 1.0);
}
`;

/**
 * 片段Shader
 * 实现多纹理混合效果：
 * 1. 根据偏移量计算多个纹理的UV
 * 2. 应用透明度混合
 * 3. 确保纹理在有效范围内显示
 * 4. 按从后向前顺序混合纹理
 */
const fragment = /*glsl*/ `
precision highp float;
varying vec2 uv;
uniform vec4 _Time; // 时间变量
uniform float _TextureCount;
uniform float _CurrentVolume; // 当前音量 [minVolume,maxVolume]
uniform float _MinVolume; // 最小音量
uniform float _MaxVolume; // 最大音量
uniform float _Offset0;
uniform float _Offset1;
uniform float _Offset2;
uniform float _Offset3;
uniform float _Alpha0;
uniform float _Alpha1;
uniform float _Alpha2;
uniform float _Alpha3;
uniform sampler2D _Tex0;
uniform sampler2D _Tex1;
uniform sampler2D _Tex2;
uniform sampler2D _Tex3;

uniform float _ExposureType; 

uniform sampler2D _NoiseTex; // 大尺度噪声纹理
uniform sampler2D _T_NoiseTex; // 小尺度细节噪声纹理
uniform float _DetailNoiseScale; // 细节噪声强度 [0,1]
// 大尺度噪声参数
uniform float _NoiseScaleX; // 水平噪点放大系数 [0,1]
uniform float _NoiseScaleY; // 垂直噪点放大系数 [0,1]
uniform float _NoiseSpeedX; // 水平扰动速度 [0,10]
uniform float _NoiseSpeedY; // 垂直扰动速度 [0,10]
uniform float _NoiseUVScaleX; // 噪声贴图水平缩放 [0.1,10]
uniform float _NoiseUVScaleY; // 噪声贴图垂直缩放 [0.1,10]
// 小尺度噪声参数
uniform float _DetailNoiseScaleX; // 水平细节噪点放大系数 [0,1]
uniform float _DetailNoiseScaleY; // 垂直细节噪点放大系数 [0,1]
uniform float _DetailNoiseSpeedX; // 水平细节扰动速度 [0,10]
uniform float _DetailNoiseSpeedY; // 垂直细节扰动速度 [0,10]
uniform float _DetailNoiseUVScaleX; // 细节噪声贴图水平缩放 [0.1,10]
uniform float _DetailNoiseUVScaleY; // 细节噪声贴图垂直缩放 [0.1,10]
uniform float _Strength; // 整体强度
uniform float _Brightness; // 镜面光泽度 [0,1]

uniform float _NoiseBrightOffset; // 噪声亮度偏移 [0,0.9]
// 新增参数
uniform float _VerticalOffset;     // 垂直偏移量 [-1.0,1.0]
uniform float _VolumeCurve;        // 音量响应曲线 [0.1,2.0] 值越小低音量越不敏感
uniform float _BrightnessCurve;    // 亮度曲线指数 [0.5,3.0]
uniform float _MaxBrightness;      // 最大亮度增强值 [1.0,3.0]

// ACES Filmic Tonemapping函数
vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// 纹理的layer
uniform float _Tex0Layer; 
uniform float _Tex1Layer; 
uniform float _Tex2Layer; 
uniform float _Tex3Layer;

// 颜色uniform
uniform vec4 _Color0;
uniform vec4 _Color1;
uniform vec4 _Color2;
uniform vec4 _Color3;


// 确保UV在有效范围内采样
vec2 clampUV(vec2 uv) {
  return clamp(uv, vec2(0.01), vec2(0.99));
}

vec4 safeTexture2D(sampler2D tex, vec2 uv) {
  // 使用edgeFactor方案实现自然边缘淡出
  vec4 color = texture2D(tex, clamp(uv, vec2(0.0), vec2(1.0)));
  float edgeFactor = smoothstep(0.0, 0.1, min(uv.x, 1.0 - uv.x)) *
                     smoothstep(0.0, 0.1, min(uv.y, 1.0 - uv.y));
  color.a *= edgeFactor;
  return color;
}

void main() {
  vec4 finalColor = vec4(0.0);

  // 记录每个纹理的 layer
  float layers[4];
  layers[0] = _Tex0Layer;
  layers[1] = _Tex1Layer;
  layers[2] = _Tex2Layer;
  layers[3] = _Tex3Layer;

  // 完全按照参考Shader实现
  float timeFactor = _Time.y;
  
  // 大尺度噪声计算(使用_NoiseTex纹理)
  vec2 largeNoiseUV = uv * vec2(_NoiseUVScaleX, _NoiseUVScaleY);
  vec2 largeNoise = vec2(
    texture2D(_NoiseTex, largeNoiseUV + vec2(timeFactor * _NoiseSpeedX, 0)).r,
    texture2D(_NoiseTex, largeNoiseUV + vec2(0, timeFactor * _NoiseSpeedY)).r
  );
  largeNoise = (largeNoise ) * vec2(_NoiseScaleX, _NoiseScaleY);
  
  // 小尺度细节噪声计算(使用_T_NoiseTex纹理)
  vec2 detailNoiseUV = uv * vec2(_DetailNoiseUVScaleX, _DetailNoiseUVScaleY);
  vec2 detailNoise = vec2(
    texture2D(_T_NoiseTex, detailNoiseUV + vec2(timeFactor * _DetailNoiseSpeedX, 0)).r,
    texture2D(_T_NoiseTex, detailNoiseUV + vec2(0, timeFactor * _DetailNoiseSpeedY)).r
  );
  detailNoise = (detailNoise ) * vec2(_DetailNoiseScaleX, _DetailNoiseScaleY) * _DetailNoiseScale;
  
  // 混合两种噪声
  vec2 mixedNoise = largeNoise + detailNoise;
  
  // 计算归一化音量(0-1)
  float normalizedVolume = (_CurrentVolume - _MinVolume) / (_MaxVolume - _MinVolume);
  
  // 采样主纹理alpha值
  vec4 texColor = safeTexture2D(_Tex0, vec2(uv.x, 1.0 - uv.y));
  float alphaAttenuation = 1.0 - texColor.a * 0.8; // alpha越大扰动越小
  
  // 计算垂直偏移（音量低时下移图片）
  // 使用pow曲线实现非线性响应：低音量变化平缓，高音量变化灵敏
  float verticalOffset = mix(_VerticalOffset, 0.0, pow(normalizedVolume, _VolumeCurve));
  verticalOffset = min(max(verticalOffset, -0.7), -0.2);
  
  // 计算y轴mask(底部不扰动，顶部完全扰动)
  //float yMask = smoothstep(0.0, 0.1, uv.y);

  // 最终扰动偏移，受音量和alpha值影响
  vec2 finalOffset = -vec2(mixedNoise.x, mixedNoise.y) * _Strength * (normalizedVolume) * alphaAttenuation ;

  // 记录每个纹理的索引
  int indices[4];
  indices[0] = 0;
  indices[1] = 1;
  indices[2] = 2;
  indices[3] = 3;

  // 简单选择排序，按 layer 从小到大排列 indices
  for (int i = 0; i < 4; i++) {
    for (int j = i + 1; j < 4; j++) {
      if (layers[indices[i]] > layers[indices[j]]) {
        int tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
      }
    }
  }

  int textureCount = int(_TextureCount);

  // 按 layer 顺序混合
  for (int k = 0; k < textureCount; k++) {
    int i = indices[k];
    float offset, alpha;
    vec4 color;
    vec2 sampleUV;

    if (i == 0) {
      offset = _Offset0 /200.0;
      alpha = _Alpha0;
      sampleUV = vec2(uv.x - offset, 1.0 - (uv.y - verticalOffset)) + finalOffset;
      color = safeTexture2D(_Tex0, sampleUV);
      color.rgb = _Color0.rgb;
    } else if (i == 1) {
      offset = _Offset1 / 200.0;
      alpha = _Alpha1;
      sampleUV = vec2(uv.x - offset, 1.0 - (uv.y - verticalOffset)) + finalOffset;
      color = safeTexture2D(_Tex1, sampleUV);
      color.rgb = _Color1.rgb;
    } else if (i == 2) {
      offset = _Offset2 / 200.0;
      alpha = _Alpha2;
      sampleUV = vec2(uv.x - offset, 1.0 - (uv.y - verticalOffset)) + finalOffset;
      color = safeTexture2D(_Tex2, sampleUV);
      color.rgb = _Color2.rgb;
    } else if (i == 3) {
      offset = _Offset3 / 200.0;
      alpha = _Alpha3;
      sampleUV = vec2(uv.x - offset, 1.0 - (uv.y - verticalOffset)) + finalOffset;
      color = safeTexture2D(_Tex3, sampleUV);
      color.rgb = _Color3.rgb;
    }
    color.a *= alpha;
    finalColor.rgb = finalColor.rgb * (1.0 - color.a) + color.rgb * color.a;
    finalColor.a = finalColor.a * (1.0 - color.a) + color.a;
  }

  // 计算非线性亮度增强
  float brightnessBoost = pow(normalizedVolume, _BrightnessCurve) * _MaxBrightness + 1.0;
  finalColor.rgb *= brightnessBoost;

  // 应用音量控制的亮度增强和tonemapping
  //finalColor.rgb = ACESFilm(finalColor.rgb);
  //finalColor.rgb = finalColor.rgb / (finalColor.rgb + vec3(1.0));

  float exposure = 0.0;
  exposure = mix(0.3, 1.5, pow(normalizedVolume, 0.7));
  
  finalColor.rgb = 1.0 - exp(-finalColor.rgb * exposure);


  gl_FragColor = vec4(finalColor.rgb, finalColor.a);
}
`;

// 全局材质引用
let material: Material | undefined;

/**
 * 主入口函数
 * 初始化播放器、加载场景、设置控制器
 */
(async () => {
  // eslint-disable-next-line no-console
  // console.log('1. Starting initialization...');
  const player = new Player({
    container,
    interactive: true,
    onError: (err: Error) => {
      console.error('Player error:', err);
    },
  });

  // eslint-disable-next-line no-console
  console.log('2. Player created');

  const jsonValue = await getJSON(json);

  jsonValue.materials[0].floats = jsonValue.materials[0].floats || {};
  jsonValue.materials[0].vector3s = jsonValue.materials[0].vector3s || {};
  jsonValue.materials[0].textures = jsonValue.materials[0].textures || {};

  Object.entries(shaderParams).forEach(([key, value]) => {
    if (typeof value === 'number') {
      jsonValue.materials[0].floats[key] = value;
    }
  });

  // 新增垂直偏移参数
  jsonValue.materials[0].floats['_VerticalOffset'] = -0.5;
  jsonValue.materials[0].floats['_VolumeCurve'] = 0.7; // 默认音量曲线
  jsonValue.materials[0].floats['_BrightnessCurve'] = 1.5;
  jsonValue.materials[0].floats['_MaxBrightness'] = 1.80;

  for (let i = 0; i < MAX_TEXTURES; i++) {
    jsonValue.materials[0].floats[`_Offset${i}`] = 0;
    jsonValue.materials[0].floats[`_Alpha${i}`] = 0;
    // 初始化颜色参数
    jsonValue.materials[0].vector4s[`_Color${i}`] = [1, 1, 1, 1];
    //初始化纹理层级
    jsonValue.materials[0].floats = jsonValue.materials[0].floats || {};
    jsonValue.materials[0].floats[`_Tex${i}Layer`] = i;
  }

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;
  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_4');

  const controller = new TextureController();

  // 添加颜色调试 UI
  const uiHtml = `
  <div style="position:fixed;top:10px;right:10px;z-index:999;background:#fff;padding:8px;border-radius:6px;box-shadow:0 2px 8px #0002;font-size:14px;width:320px;">
    <h3 style="margin:0 0 8px 0;color:#136BCD">大尺度噪声</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>扰动水平缩放:</label>
        <input type="range" id="noiseScaleX" min="0" max="1" step="0.01" value="0.28" style="width:100%"/>
        <span id="noiseScaleXValue">0.28</span>
      </div>
      <div style="width:48%">
        <label>噪声UV水平缩放:</label>
        <input type="range" id="noiseUVScaleX" min="0.0" max="1" step="0.001" value="0.302" style="width:100%"/>
        <span id="noiseUVScaleXValue">0.302</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>扰动垂直缩放:</label>
        <input type="range" id="noiseScaleY" min="0.0" max="1" step="0.001" value="0.74" style="width:100%"/>
        <span id="noiseScaleYValue">0.74</span>
      </div>
      <div style="width:48%">
        <label>噪声UV垂直缩放:</label>
        <input type="range" id="noiseUVScaleY" min="0.0" max="1.0" step="0.01" value="0.320" style="width:100%"/>
        <span id="noiseUVScaleYValue">0.320</span>
      </div>
    </div>
    
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>水平速度:</label>
        <input type="range" id="noiseSpeedX" min="0" max="10" step="0.001" value="0.1" style="width:100%"/>
        <span id="noiseSpeedXValue">0.1</span>
      </div>
      <div style="width:48%">
        <label>垂直速度:</label>
        <input type="range" id="noiseSpeedY" min="0" max="10" step="0.001" value="0.1" style="width:100%"/>
        <span id="noiseSpeedYValue">0.1000</span>
      </div>
    </div>
    
    <div style="margin-bottom:6px;">
      <label>噪点偏移:</label>
      <input type="range" id="noiseBrightOffset" min="0" max="0.9" step="0.001" value="0.25" style="width:100%"/>
      <span id="noiseBrightOffsetValue">0.25</span>
    </div>

    <h3 style="margin:8px 0;color:#029896">细节噪声</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>细节强度:</label>
        <input type="range" id="detailNoiseScale" min="0" max="1" step="0.01" value="0.24" style="width:100%"/>
        <span id="detailNoiseScaleValue">0.24</span>
      </div>
      <div style="width:48%">
        <label>水平缩放:</label>
        <input type="range" id="detailNoiseScaleX" min="0" max="1" step="0.01" value="0.71" style="width:100%"/>
        <span id="detailNoiseScaleXValue">0.71</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>垂直缩放:</label>
        <input type="range" id="detailNoiseScaleY" min="0" max="1" step="0.01" value="0.62" style="width:100%"/>
        <span id="detailNoiseScaleYValue">0.62</span>
      </div>
      <div style="width:48%">
        <label>水平速度:</label>
        <input type="range" id="detailNoiseSpeedX" min="0" max="10" step="0.1" value="0.10" style="width:100%"/>
        <span id="detailNoiseSpeedXValue">0.10</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>垂直速度:</label>
        <input type="range" id="detailNoiseSpeedY" min="0" max="10" step="0.1" value="0.10" style="width:100%"/>
        <span id="detailNoiseSpeedYValue">0.10</span>
      </div>
      <div style="width:48%">
        <label>UV水平缩放:</label>
        <input type="range" id="detailNoiseUVScaleX" min="0.1" max="10" step="0.1" value="0.40" style="width:100%"/>
        <span id="detailNoiseUVScaleXValue">0.40</span>
      </div>
    </div>
    <div style="margin-bottom:6px;">
      <label>UV垂直缩放:</label>
      <input type="range" id="detailNoiseUVScaleY" min="0.1" max="10" step="0.1" value="0.40" style="width:100%"/>
      <span id="detailNoiseUVScaleYValue">0.40</span>
    </div>
    
    
    <div style="margin-bottom:6px;">
      <label>聆听阶段颜色：</label>
      <input type="color" id="listeningColor" value="#136BCD" style="width:100%"/>
    </div>
    <div style="display:flex;justify-content:space-between">
      <div style="width:48%">
        <label>输入主色：</label>
        <input type="color" id="inputPrimaryColor" value="#136BCD" style="width:100%"/>
      </div>
      <div style="width:48%">
        <label>输入副色：</label>
        <input type="color" id="inputSecondaryColor" value="#029896" style="width:100%"/>
      </div>
    </div>
    <div style="margin-bottom:6px;">
     <label>垂直偏移:</label>
     <input type="range" id="verticalOffset" min="-1.0" max="0.0" step="0.01" value="-0.79" style="width:100%"/>
     <span id="verticalOffsetValue">-0.79</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>音量响应曲线:</label>
     <input type="range" id="volumeCurve" min="0.1" max="2.0" step="0.05" value="0.7" style="width:100%"/>
     <span id="volumeCurveValue">0.7</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>亮度曲线:</label>
     <input type="range" id="brightnessCurve" min="0.5" max="3.0" step="0.1" value="1.5" style="width:100%"/>
     <span id="brightnessCurveValue">1.5</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>最大亮度:</label>
     <input type="range" id="maxBrightness" min="1.0" max="3.0" step="0.1" value="1.80" style="width:100%"/>
     <span id="maxBrightnessValue">1.80</span>
   </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', uiHtml);

  function hexToRgba (hex: string): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    return [r, g, b, 1];
  }

  // 初始化默认颜色
  controller.setListeningColor(hexToRgba('#136BCD'));
  controller.setInputColors({
    primary: hexToRgba('#136BCD'),
    secondary: hexToRgba('#029896'),
  });

  const listeningColorInput = document.getElementById('listeningColor') as HTMLInputElement | null;

  if (listeningColorInput) {
    listeningColorInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;

      controller.setListeningColor(hexToRgba(target.value));
    });
  }
  const inputPrimaryColorInput = document.getElementById('inputPrimaryColor') as HTMLInputElement | null;

  if (inputPrimaryColorInput) {
    inputPrimaryColorInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;

      controller.setInputColors({ primary: hexToRgba(target.value) });
    });
  }
  const inputSecondaryColorInput = document.getElementById('inputSecondaryColor') as HTMLInputElement | null;

  if (inputSecondaryColorInput) {
    inputSecondaryColorInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;

      controller.setInputColors({ secondary: hexToRgba(target.value) });
    });
  }

  // 获取材质参数值，带默认值
  const getMaterialFloat = (param: string): number => {
    return material?.getFloat(param) ?? 0;
  };

  // 添加所有参数的事件监听和初始化
  const addSliderControl = (id: string, param: string, precision = 2) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    const valueSpan = document.getElementById(`${id}Value`);

    if (input && valueSpan) {
      // 初始化值
      const initialValue = getMaterialFloat(param);

      input.value = initialValue.toString();
      valueSpan.textContent = initialValue.toFixed(precision);

      // 添加事件监听
      input.addEventListener('input', e => {
        const target = e.target as HTMLInputElement;
        const value = parseFloat(target.value);

        valueSpan.textContent = value.toFixed(precision);
        if (material) { material.setFloat(param, value); }
      });
    }
  };

  addSliderControl('noiseScaleX', '_NoiseScaleX');
  addSliderControl('noiseScaleY', '_NoiseScaleY');
  addSliderControl('noiseSpeedX', '_NoiseSpeedX', 1);
  addSliderControl('noiseSpeedY', '_NoiseSpeedY', 3);
  addSliderControl('noiseBrightOffset', '_NoiseBrightOffset');
  addSliderControl('specularGlossy', '_SpecularGlossy');
  addSliderControl('specularIntensity', '_SpecularIntensity');
  addSliderControl('noiseUVScaleX', '_NoiseUVScaleX', 3);
  addSliderControl('noiseUVScaleY', '_NoiseUVScaleY', 3);
  // 添加细节噪声控制
  jsonValue.materials[0].floats['_DetailNoiseScale'] = 0.26;
  jsonValue.materials[0].floats['_DetailNoiseScaleX'] = 0.1;
  jsonValue.materials[0].floats['_DetailNoiseScaleY'] = 0.31;
  jsonValue.materials[0].floats['_DetailNoiseSpeedX'] = 0.70;
  jsonValue.materials[0].floats['_DetailNoiseSpeedY'] = 0.70;
  jsonValue.materials[0].floats['_DetailNoiseUVScaleX'] = 0.60;
  jsonValue.materials[0].floats['_DetailNoiseUVScaleY'] = 0.60;

  addSliderControl('detailNoiseScale', '_DetailNoiseScale');
  addSliderControl('detailNoiseScaleX', '_DetailNoiseScaleX');
  addSliderControl('detailNoiseScaleY', '_DetailNoiseScaleY');
  addSliderControl('detailNoiseSpeedX', '_DetailNoiseSpeedX');
  addSliderControl('detailNoiseSpeedY', '_DetailNoiseSpeedY');
  addSliderControl('detailNoiseUVScaleX', '_DetailNoiseUVScaleX');
  addSliderControl('detailNoiseUVScaleY', '_DetailNoiseUVScaleY');
  addSliderControl('brightness', '_Brightness', 1);
  // 新增垂直偏移参数控制
  addSliderControl('verticalOffset', '_VerticalOffset');
  addSliderControl('volumeCurve', '_VolumeCurve');
  addSliderControl('brightnessCurve', '_BrightnessCurve');
  addSliderControl('maxBrightness', '_MaxBrightness');

  // 初始化参数
  if (material) {
    material.setFloat('_NoiseScaleX', 0.28);
    material.setFloat('_NoiseScaleY', 0.74);
    material.setFloat('_NoiseSpeedX', 0.1);
    material.setFloat('_NoiseSpeedY', 0.1);
    material.setFloat('_NoiseBrightOffset', 0.25);
    material.setFloat('_SpecularGlossy', 0.16);
    material.setFloat('_SpecularIntensity', 0.5);
    material.setFloat('_NoiseUVScaleX', 0.302);
    material.setFloat('_NoiseUVScaleY', 0.320);
    // 设置新增参数的默认值
    material.setFloat('_VerticalOffset', -0.79);
    material.setFloat('_VolumeCurve', 0.7);
    material.setFloat('_BrightnessCurve', 1.5);
    material.setFloat('_MaxBrightness', 1.80);
    material.setFloat('_DetailNoiseScale', 0.24);
    material.setFloat('_DetailNoiseScaleX', 0.71);
    material.setFloat('_DetailNoiseScaleY', 0.62);
    material.setFloat('_DetailNoiseSpeedX', 0.10);
    material.setFloat('_DetailNoiseSpeedY', 0.10);
    material.setFloat('_DetailNoiseUVScaleX', 0.40);
    material.setFloat('_DetailNoiseUVScaleY', 0.40);

    // 同步设置UI滑块值并触发更新
    const setSliderValue = (id: string, value: number, precision = 3) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      const valueSpan = document.getElementById(`${id}Value`);

      if (input && valueSpan) {
        input.value = value.toString();
        valueSpan.textContent = value.toFixed(precision);
        input.dispatchEvent(new Event('input'));
      }
    };

    setSliderValue('noiseScaleX', 0.28);
    setSliderValue('noiseScaleY', 0.74);
    setSliderValue('noiseSpeedX', 0.1);
    setSliderValue('noiseSpeedY', 0.1);
    setSliderValue('noiseBrightOffset', 0.25);
    setSliderValue('noiseUVScaleX', 0.302);
    setSliderValue('noiseUVScaleY', 0.320);
    setSliderValue('verticalOffset', -0.79);
    setSliderValue('volumeCurve', 0.7);
    setSliderValue('brightnessCurve', 1.5);
    setSliderValue('maxBrightness', 1.80);
    setSliderValue('detailNoiseScale', 0.24);
    setSliderValue('detailNoiseScaleX', 0.71);
    setSliderValue('detailNoiseScaleY', 0.62);
    setSliderValue('detailNoiseSpeedX', 0.10);
    setSliderValue('detailNoiseSpeedY', 0.10);
    setSliderValue('detailNoiseUVScaleX', 0.40);
    setSliderValue('detailNoiseUVScaleY', 0.40);
  }
  const engine = composition.renderer.engine;

  // 初始化时重置到监听状态(转换为秒)
  controller.resetToListening(performance.now() / 1000);
  // if (DEBUG) {
  //   console.log('Initialized controller with textures:', controller.textures);
  // }

  // 手动加载本地图片并创建纹理
  const loadLocalImageData = (path: string): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {return reject(new Error('Could not get canvas context'));}

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        // eslint-disable-next-line no-console
        //console.log(`Texture loaded: ${path}, size: ${img.width}x${img.height}`);
        resolve(imageData);
      };
      img.onerror = err => {
        //console.error(`Failed to load texture: ${path}`, err);
        reject(err);
      };
      img.src = path;
    });
  };

  // eslint-disable-next-line no-console
  //console.log('3. Loading texture...');
  const imageData = await loadLocalImageData('../cloud.png');
  const noiseimageData = await loadLocalImageData('../Perlin.png');
  const T_noiseimageData = await loadLocalImageData('../T_Noise.png');

  // eslint-disable-next-line no-console
  //console.log('4. Texture loaded, creating...');
  const cloudTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(imageData.data),
      width: imageData.width,
      height: imageData.height,
    },
    {
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    }
  );
  const noiseTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(noiseimageData.data),
      width: noiseimageData.width,
      height: noiseimageData.height,
    },
    {
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
    },

  );
  const T_noiseTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(T_noiseimageData.data),
      width: T_noiseimageData.width,
      height: T_noiseimageData.height,
    },
    {
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
    },
  );

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    if (rendererComponents.length > 0) {
      const componentMaterials = rendererComponents[0].materials;

      if (componentMaterials.length > 0) {
        material = componentMaterials[0];
        setBlendMode(material, spec.BlendingMode.ADD);
        material.depthMask = false;

        // 初始化参数和纹理
        material.setFloat('_TextureCount', shaderParams._TextureCount);

        // 分别设置四个独立纹理
        material.setTexture('_Tex0', cloudTexture);
        material.setTexture('_Tex1', cloudTexture);
        material.setTexture('_Tex2', cloudTexture);
        material.setTexture('_Tex3', cloudTexture);
        // 设置噪声纹理
        material.setTexture('_NoiseTex', noiseTexture);
        // 设置T噪声纹理
        material.setTexture('_T_NoiseTex', T_noiseTexture);
        // 设置噪声强度
        material.setFloat('_Strength', 0.50);
        // 设置纹理层级
        material.setFloat('_Tex0Layer', 0);
        material.setFloat('_Tex1Layer', 1);
        material.setFloat('_Tex2Layer', 2);
        material.setFloat('_Tex3Layer', 3);

        // 初始化偏移、透明度和颜色矩阵参数
        for (let i = 0; i < MAX_TEXTURES; i++) {
          material.setFloat(`_Offset${i}`, 0.5);
          material.setFloat(`_Alpha${i}`, 0);
          // 设置默认颜色(白色)
          material.setVector4(`_Color${i}`, new Vector4(1, 1, 1, 1));
        }

        // 初始化UI控件值
        const initUIControls = () => {
          if (DEBUG) {console.log('Initializing UI controls...');}

          // 设置所有滑块控件的初始值
          const controls = [
            { id: 'noiseScaleX', param: '_NoiseScaleX', value: 0.28, precision: 2 },
            { id: 'noiseScaleY', param: '_NoiseScaleY', value: 0.74, precision: 2 },
            { id: 'noiseSpeedX', param: '_NoiseSpeedX', value: 0.1, precision: 1 },
            { id: 'noiseSpeedY', param: '_NoiseSpeedY', value: 0.1, precision: 3 },
            { id: 'noiseBrightOffset', param: '_NoiseBrightOffset', value: 0.25, precision: 2 },
            { id: 'noiseUVScaleX', param: '_NoiseUVScaleX', value: 0.302, precision: 3 },
            { id: 'noiseUVScaleY', param: '_NoiseUVScaleY', value: 0.320, precision: 3 },
            { id: 'verticalOffset', param: '_VerticalOffset', value: -0.79, precision: 2 },
            { id: 'volumeCurve', param: '_VolumeCurve', value: 0.7, precision: 2 },
            { id: 'brightnessCurve', param: '_BrightnessCurve', value: 1.5, precision: 1 },
            { id: 'maxBrightness', param: '_MaxBrightness', value: 1.80, precision: 2 },
            { id: 'detailNoiseScale', param: '_DetailNoiseScale', value: 0.24, precision: 2 },
            { id: 'detailNoiseScaleX', param: '_DetailNoiseScaleX', value: 0.71, precision: 2 },
            { id: 'detailNoiseScaleY', param: '_DetailNoiseScaleY', value: 0.62, precision: 2 },
            { id: 'detailNoiseSpeedX', param: '_DetailNoiseSpeedX', value: 0.10, precision: 2 },
            { id: 'detailNoiseSpeedY', param: '_DetailNoiseSpeedY', value: 0.10, precision: 2 },
            { id: 'detailNoiseUVScaleX', param: '_DetailNoiseUVScaleX', value: 0.40, precision: 2 },
            { id: 'detailNoiseUVScaleY', param: '_DetailNoiseUVScaleY', value: 0.40, precision: 2 },
          ];

          controls.forEach(control => {
            const input = document.getElementById(control.id) as HTMLInputElement;
            const valueSpan = document.getElementById(`${control.id}Value`);

            if (input && valueSpan) {
              const value = material?.getFloat(control.param) ?? control.value;

              input.value = value.toString();
              valueSpan.textContent = value.toFixed(control.precision);
              if (DEBUG) {console.log(`Initialized ${control.id} with value: ${value}`);}
            }
          });
        };

        // 延迟一小段时间确保UI已加载
        setTimeout(() => {
          initUIControls();
          // 新增：初始化时同步所有UI参数到材质，确保初始渲染参数生效
          if (material) {
            controls.forEach(control => {
              const input = document.getElementById(control.id) as HTMLInputElement;

              if (input) {
                material!.setFloat(control.param, parseFloat(input.value));
              }
            });
          }
        }, 100);
      }
    }
  }

  /**
   * 获取当前音量(模拟)
   * 实现状态循环：
   * 1. 状态1：3.4秒高音量(0.8)
   * 2. 状态2：2.4秒中等音量(0.6)
   * 3. 静谧状态：1秒静音
   * 循环往复
   */
  // 音量参数
  const minVolume = 0.1; // 最小音量阈值
  const maxVolume = 1.0; // 最大音量阈值

  function getAudioVolume (): number {
    // 使用sin函数模拟0-1波动的音量
    const now = performance.now();
    const timeFactor = now * 0.0001; // 转换为秒
    // 基础sin波(0.5振幅+0.5偏移)
    const baseWave = Math.sin(timeFactor) * 0.5 + 0.5;
    // 添加次级波动增加随机感
    const detailWave = Math.sin(timeFactor * 2.3) * 0.2;

    // 组合并确保0-1范围
    return clamp(baseWave + detailWave, 0.0, 1.0);
  }
  //新的模拟音量的方法，可以定时在某个值上
  function getSimulatedAudioVolume (): number {
    //定时器
    const now = performance.now();
    const timeFactor = now * 0.1; // 转换为秒

    if (timeFactor > 30000) {return 0.8;} else if (timeFactor > 20000) {return 0.6;} else if (timeFactor > 500) {return 1.0;} else {return 0.1;}
  }

  // 数值范围限制
  function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  let lastTime = performance.now();

  /**
   * 更新循环
   * 每帧更新纹理控制器状态和Shader参数
   */
  function updateLoop () {
    const now = performance.now() / 1000; // 转换为秒以匹配texture-controller
    const delta = (now - lastTime);

    lastTime = now;

    const volume = getAudioVolume();

    // if (DEBUG) {
    console.log(`Current volume: ${volume}`);
    //   console.log('Current textures:', controller.textures);
    // }

    controller.update(delta, volume, now);

    // eslint-disable-next-line no-console
    //console.log('Controller stage:', controller.mainStage);
    //console.log('Textures:', controller.textures);

    if (material) {
      // 更新纹理数量
      const textureCount = Math.min(controller.textures.length, MAX_TEXTURES);
      const currentVolume = getAudioVolume();

      //console.log(textureCount);
      material.setFloat('_TextureCount', textureCount);
      // 传递音量参数
      material.setFloat('_CurrentVolume', currentVolume);
      material.setFloat('_MinVolume', minVolume);
      material.setFloat('_MaxVolume', maxVolume);

      //设置exposureType
      material.setFloat('_ExposureType', controller.currentStage === MainStage.Input ? 1 : 0);

      // 更新每个纹理的参数
      for (let i = 0; i < textureCount; i++) {
        const texture = controller.textures[i];

        material.setFloat(`_Offset${i}`, texture.x);
        material.setFloat(`_Alpha${i}`, texture.alpha);
        // 设置纹理层级
        material.setFloat(`_Tex${i}Layer`, texture.layer);

        // 设置颜色
        if (texture.color) {
          material.setVector4(`_Color${i}`, new Vector4(...texture.color));
          //console.log(`Texture ${i} color:`, texture.color);
        }

        // 调试日志
        if (DEBUG && i === 0) {
          //console.log(`Texture ${i} - x: ${texture.x.toFixed(2)}, alpha: ${texture.alpha.toFixed(2)}`);
          //console.log('Color:', texture.color);
        }
      }
      // 对于未使用的纹理，重置参数
      for (let i = textureCount; i < MAX_TEXTURES; i++) {
        material.setFloat(`_Offset${i}`, 0.5);
        material.setFloat(`_Alpha${i}`, 0);
      }

      // 如有必要，强制刷新
      // material.markDirty?.();
    }
    requestAnimationFrame(updateLoop);
  }

  updateLoop();
  player.play();
})();

/**
 * 获取JSON数据
 * @param json JSON文件URL
 * @returns 解析后的JSON对象
 */
function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}

// 控件参数配置，提升到外部，便于多处使用
const controls: Array<{ id: string, param: string, value: number, precision: number }> = [
  { id: 'noiseScaleX', param: '_NoiseScaleX', value: 0.28, precision: 2 },
  { id: 'noiseScaleY', param: '_NoiseScaleY', value: 0.74, precision: 2 },
  { id: 'noiseSpeedX', param: '_NoiseSpeedX', value: 0.1, precision: 1 },
  { id: 'noiseSpeedY', param: '_NoiseSpeedY', value: 0.1, precision: 3 },
  { id: 'noiseBrightOffset', param: '_NoiseBrightOffset', value: 0.25, precision: 2 },
  { id: 'noiseUVScaleX', param: '_NoiseUVScaleX', value: 0.302, precision: 3 },
  { id: 'noiseUVScaleY', param: '_NoiseUVScaleY', value: 0.320, precision: 3 },
  { id: 'verticalOffset', param: '_VerticalOffset', value: -0.79, precision: 2 },
  { id: 'volumeCurve', param: '_VolumeCurve', value: 0.7, precision: 2 },
  { id: 'brightnessCurve', param: '_BrightnessCurve', value: 1.5, precision: 1 },
  { id: 'maxBrightness', param: '_MaxBrightness', value: 1.80, precision: 2 },
  { id: 'detailNoiseScale', param: '_DetailNoiseScale', value: 0.24, precision: 2 },
  { id: 'detailNoiseScaleX', param: '_DetailNoiseScaleX', value: 0.71, precision: 2 },
  { id: 'detailNoiseScaleY', param: '_DetailNoiseScaleY', value: 0.62, precision: 2 },
  { id: 'detailNoiseSpeedX', param: '_DetailNoiseSpeedX', value: 0.10, precision: 2 },
  { id: 'detailNoiseSpeedY', param: '_DetailNoiseSpeedY', value: 0.10, precision: 2 },
  { id: 'detailNoiseUVScaleX', param: '_DetailNoiseUVScaleX', value: 0.40, precision: 2 },
  { id: 'detailNoiseUVScaleY', param: '_DetailNoiseUVScaleY', value: 0.40, precision: 2 },
];