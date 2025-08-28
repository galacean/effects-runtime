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

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*Rjb_SoNgcv8AAAAAQMAAAAgAelB4AQ';
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
  _TextureCount: number, // 当前活动纹理数量
}

const shaderParams: ShaderParams = {
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
 * 1. 基于统一时间_Now计算位移和透明度
 * 2. 应用透明度混合
 * 3. 确保纹理在有效范围内显示
 * 4. 按从后向前顺序混合纹理
 */
const fragment = /*glsl*/ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec2 uv;
uniform float _Now; // 统一时间（秒）
uniform vec4 _Time; // 时间向量 (t/20, t, t*2, t*3)
uniform float _TextureCount;
uniform float _CurrentVolume; // 当前音量 [minVolume,maxVolume]
uniform float _MinVolume; // 最小音量
uniform float _MaxVolume; // 最大音量

// 纹理采样器
uniform sampler2D _Tex0; // 第一阶段蓝
uniform sampler2D _Tex1; // 第一阶段绿
uniform sampler2D _Tex2; // 第二阶段

// 噪声纹理和参数
uniform sampler2D _NoiseTex; // 大尺度噪声纹理
uniform sampler2D _T_NoiseTex; // 小尺度细节噪声纹理
uniform float _DetailNoiseScale; // 细节噪声强度 [0,1]
uniform float _NoiseScaleX; // 水平噪点放大系数 [0,1]
uniform float _NoiseScaleY; // 垂直噪点放大系数 [0,1]
uniform float _NoiseSpeedX; // 水平扰动速度 [0,10]
uniform float _NoiseSpeedY; // 垂直扰动速度 [0,10]
uniform float _NoiseUVScaleX; // 噪声贴图水平缩放 [0.1,10]
uniform float _NoiseUVScaleY; // 噪声贴图垂直缩放 [0.1,10]
uniform float _DetailNoiseScaleX; // 水平细节噪点放大系数 [0,1]
uniform float _DetailNoiseScaleY; // 垂直细节噪点放大系数 [0,1]
uniform float _DetailNoiseSpeedX; // 水平细节扰动速度 [0,10]
uniform float _DetailNoiseSpeedY; // 垂直细节扰动速度 [0,10]
uniform float _DetailNoiseUVScaleX; // 细节噪声贴图水平缩放 [0.1,10]
uniform float _DetailNoiseUVScaleY; // 细节噪声贴图垂直缩放 [0.1,10]
uniform float _Strength; // 整体强度

// 新增参数
uniform float _VerticalOffset;     // 垂直偏移量 [-1.0,1.0]
uniform float _VolumeCurve;        // 音量响应曲线 [0.1,2.0]
uniform float _BrightnessCurve;    // 亮度曲线指数 [0.5,3.0]
uniform float _MaxBrightness;      // 最大亮度增强值 [1.0,3.0]

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

// 第一阶段蓝/绿时序常量
uniform float _BlueFadeInEnd;
uniform float _BlueMove1End;
uniform float _BlueMove2End;
uniform float _BlueFadeOutStart;
uniform float _BlueFadeOutEnd;
uniform float _BlueMove1TargetU;
uniform float _BlueMove1TargetV;
uniform float _BlueMove2TargetU;
uniform float _BlueMove2TargetV;
uniform float _BlueFadeInDeltaV;

uniform float _GreenFadeInEnd;
uniform float _GreenMoveEnd;
uniform float _GreenFadeOutStart;
uniform float _GreenFadeOutEnd;
uniform float _GreenMoveTargetU;
uniform float _GreenMoveTargetV;
uniform float _GreenFadeInDeltaV;

// 每纹理参数（0-3）
uniform float _TexStartedAt0; uniform float _TexStartedAt1; uniform float _TexStartedAt2; uniform float _TexStartedAt3;
uniform float _TexDuration0;  uniform float _TexDuration1;  uniform float _TexDuration2;  uniform float _TexDuration3;
uniform float _TexFadeIn0;    uniform float _TexFadeIn1;    uniform float _TexFadeIn2;    uniform float _TexFadeIn3;
uniform float _TexFadeOutStart0; uniform float _TexFadeOutStart1; uniform float _TexFadeOutStart2; uniform float _TexFadeOutStart3;
uniform float _TexFadeOutEnd0;   uniform float _TexFadeOutEnd1;   uniform float _TexFadeOutEnd2;   uniform float _TexFadeOutEnd3;
uniform float _TexDistance0;  uniform float _TexDistance1;  uniform float _TexDistance2;  uniform float _TexDistance3;
uniform float _TexInitU0;     uniform float _TexInitU1;     uniform float _TexInitU2;     uniform float _TexInitU3;
uniform float _TexInitV0;     uniform float _TexInitV1;     uniform float _TexInitV2;     uniform float _TexInitV3;
uniform float _TexType0;      uniform float _TexType1;      uniform float _TexType2;      uniform float _TexType3; // 0=listening,1=input
uniform float _TexKind0;      uniform float _TexKind1;      uniform float _TexKind2;      uniform float _TexKind3; // listening:0=blue,1=green
uniform float _IsSecond0;     uniform float _IsSecond1;     uniform float _IsSecond2;     uniform float _IsSecond3;

// ACES Filmic Tonemapping函数
vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// 确保UV在有效范围内采样
vec2 clampUV(vec2 uv) {
  return clamp(uv, vec2(0.01), vec2(0.99));
}

vec4 safeTexture2D(sampler2D tex, vec2 uv) {
  // 使用edgeFactor方案实现自然边缘淡出
  vec4 color = texture2D(tex, clamp(uv, vec2(0.0), vec2(1.0)));
  float edgeFactor = smoothstep(0.0, 0.1, min(uv.x, 1.0 - uv.x)) *
                     smoothstep(0.0, 0.001, min(uv.y, 1.0 - uv.y));
  color.a *= edgeFactor;
  return color;
}

// 根据type和kind选择采样纹理
vec4 sampleTexByType(float typeV, float kindV, vec2 uv) {
  // type=0: listening; 1: input
  if (int(typeV) == 0) {
    if (int(kindV) == 0) return safeTexture2D(_Tex0, uv); // blue
    else return safeTexture2D(_Tex1, uv);                  // green
  } else {
    return safeTexture2D(_Tex2, uv);                       // input
  }
}

// 计算第一阶段蓝色位置与alpha
void calcListeningBlue(float elapsed, float initU, float initV,
                       out float ox, out float oy, out float a) {
  // 位置
  if (elapsed < _BlueFadeInEnd) {
    float p = elapsed / _BlueFadeInEnd;
    ox = initU;
    oy = initV + _BlueFadeInDeltaV * p;
  } else if (elapsed < _BlueMove1End) {
    float p = (elapsed - _BlueFadeInEnd) / (_BlueMove1End - _BlueFadeInEnd);
    ox = initU + _BlueMove1TargetU * p;
    oy = initV + _BlueFadeInDeltaV + _BlueMove1TargetV * p;
  } else if (elapsed < _BlueMove2End) {
    float p = (elapsed - _BlueMove1End) / (_BlueMove2End - _BlueMove1End);
    ox = initU + _BlueMove1TargetU + (_BlueMove2TargetU - _BlueMove1TargetU) * p;
    oy = initV + _BlueFadeInDeltaV + _BlueMove1TargetV + (_BlueMove2TargetV - _BlueMove1TargetV) * p;
  } else {
    ox = initU + _BlueMove2TargetU;
    oy = initV + _BlueFadeInDeltaV + _BlueMove2TargetV;
  }
  // alpha
  if (elapsed < _BlueFadeInEnd) {
    a = elapsed / _BlueFadeInEnd;
  } else if (elapsed >= _BlueFadeOutStart) {
    if (elapsed < _BlueFadeOutEnd) {
      a = 1.0 - (elapsed - _BlueFadeOutStart) / (_BlueFadeOutEnd - _BlueFadeOutStart);
    } else {
      a = 0.0;
    }
  } else {
    a = 1.0;
  }
}

// 计算第一阶段绿色位置与alpha
void calcListeningGreen(float elapsed, float initU, float initV,
                        out float ox, out float oy, out float a) {
  if (elapsed < _GreenFadeInEnd) {
    float p = elapsed / _GreenFadeInEnd;
    ox = initU;
    oy = initV + _GreenFadeInDeltaV * p;
  } else if (elapsed < _GreenMoveEnd) {
    float p = (elapsed - _GreenFadeInEnd) / (_GreenMoveEnd - _GreenFadeInEnd);
    ox = initU + _GreenMoveTargetU * p;
    oy = initV + _GreenFadeInDeltaV + _GreenMoveTargetV * p;
  } else {
    ox = initU + _GreenMoveTargetU;
    oy = initV + _GreenFadeInDeltaV + _GreenMoveTargetV;
  }
  if (elapsed < _GreenFadeInEnd) {
    a = elapsed / _GreenFadeInEnd;
  } else if (elapsed >= _GreenFadeOutStart) {
    if (elapsed < _GreenFadeOutEnd) {
      a = 1.0 - (elapsed - _GreenFadeOutStart) / (_GreenFadeOutEnd - _GreenFadeOutStart);
    } else {
      a = 0.0;
    }
  } else {
    a = 1.0;
  }
}

// 计算第二阶段位置与alpha
void calcInput(float elapsed, float duration, float initU, float initV, float distance, float isSecond,
               float fadeIn, float fadeOutStart, float fadeOutEnd,
               out float ox, out float oy, out float a) {
  float lifeP = duration > 0.0 ? clamp(elapsed / duration, 0.0, 1.0) : 0.0;
  ox = initU + distance * lifeP;
  if (isSecond > 0.5) {
    ox -= 0.235; // 和 CPU 保持一致
  }
  oy = initV;
  if (elapsed < fadeIn) {
    a = elapsed / max(0.0001, fadeIn);
  } else if (elapsed < fadeOutStart) {
    a = 1.0;
  } else if (elapsed < fadeOutEnd) {
    a = 1.0 - (elapsed - fadeOutStart) / max(0.0001, (fadeOutEnd - fadeOutStart));
  } else {
    a = 0.0;
  }
}

// 获取纹理参数
void fetchTexParams(int idx,
  out float startedAt, out float duration, out float fadeIn, out float fadeOutStart, out float fadeOutEnd,
  out float distance, out float initU, out float initV, out float typeV, out float kindV, out float isSecond
) {
  if (idx == 0) {
    startedAt = _TexStartedAt0; duration = _TexDuration0; fadeIn = _TexFadeIn0; fadeOutStart = _TexFadeOutStart0; fadeOutEnd = _TexFadeOutEnd0;
    distance = _TexDistance0; initU = _TexInitU0; initV = _TexInitV0; typeV = _TexType0; kindV = _TexKind0; isSecond = _IsSecond0;
  } else if (idx == 1) {
    startedAt = _TexStartedAt1; duration = _TexDuration1; fadeIn = _TexFadeIn1; fadeOutStart = _TexFadeOutStart1; fadeOutEnd = _TexFadeOutEnd1;
    distance = _TexDistance1; initU = _TexInitU1; initV = _TexInitV1; typeV = _TexType1; kindV = _TexKind1; isSecond = _IsSecond1;
  } else if (idx == 2) {
    startedAt = _TexStartedAt2; duration = _TexDuration2; fadeIn = _TexFadeIn2; fadeOutStart = _TexFadeOutStart2; fadeOutEnd = _TexFadeOutEnd2;
    distance = _TexDistance2; initU = _TexInitU2; initV = _TexInitV2; typeV = _TexType2; kindV = _TexKind2; isSecond = _IsSecond2;
  } else {
    startedAt = _TexStartedAt3; duration = _TexDuration3; fadeIn = _TexFadeIn3; fadeOutStart = _TexFadeOutStart3; fadeOutEnd = _TexFadeOutEnd3;
    distance = _TexDistance3; initU = _TexInitU3; initV = _TexInitV3; typeV = _TexType3; kindV = _TexKind3; isSecond = _IsSecond3;
  }
}

void main() {
  // 使用 _Time.y 用于噪声计算以保持与之前一致
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
  verticalOffset = min(max(verticalOffset, -0.2), 0.0);
  
  // 计算y轴mask(底部不扰动，顶部完全扰动)
  vec2 yMask = vec2(0.0, -0.35);

  // 最终扰动偏移，受音量和alpha值影响
  vec2 finalOffset = -vec2(mixedNoise.x, mixedNoise.y) * _Strength * (normalizedVolume)  + vec2(0.0, verticalOffset);

  // 记录每个纹理的 layer
  float layers[4];
  layers[0] = _Tex0Layer;
  layers[1] = _Tex1Layer;
  layers[2] = _Tex2Layer;
  layers[3] = _Tex3Layer;

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

  vec4 finalColor = vec4(0.0);
  int textureCount = int(_TextureCount);

  // 按 layer 顺序混合
  for (int k = 0; k < 4; k++) {
    if (k >= textureCount) break;

    int i = indices[k];

    float startedAt, duration, fadeIn, fadeOutStart, fadeOutEnd, distance, initU, initV, typeV, kindV, isSecond;
    fetchTexParams(i, startedAt, duration, fadeIn, fadeOutStart, fadeOutEnd, distance, initU, initV, typeV, kindV, isSecond);
    float elapsed = _Now - startedAt;

    float ox = 0.0; float oy = 0.0; float a = 0.0;
    if (int(typeV) == 0) { // listening
      if (int(kindV) == 0) {
        calcListeningBlue(elapsed, initU, initV, ox, oy, a);
      } else {
        calcListeningGreen(elapsed, initU, initV, ox, oy, a);
      }
    } else { // input
      calcInput(elapsed, duration, initU, initV, distance, isSecond, fadeIn, fadeOutStart, fadeOutEnd, ox, oy, a);
    }

    // 采样索引根据 type/kind 自动选择
    vec2 sampleUV = vec2(uv.x + ox, 1.0 - uv.y + oy) + finalOffset;
    vec4 color = sampleTexByType(typeV, kindV, clamp(sampleUV, vec2(0.0), vec2(1.0)));

    // 上色：使用 _Colori（JS 每帧下发）
    if (i == 0) { color.rgb = _Color0.rgb; a *= _Color0.a; }
    else if (i == 1) { color.rgb = _Color1.rgb; a *= _Color1.a; }
    else if (i == 2) { color.rgb = _Color2.rgb; a *= _Color2.a; }
    else { color.rgb = _Color3.rgb; a *= _Color3.a; }

    color.a *= a;

    // 按从后到前混合
    finalColor.rgb = finalColor.rgb * (1.0 - color.a) + color.rgb * color.a;
    finalColor.a   = finalColor.a   * (1.0 - color.a) + color.a;
  }

  // 亮度增强与音量曲线逻辑同现有
  finalColor.rgb *= 1.3; // 增强亮度
  float brightnessBoost = pow(normalizedVolume, _BrightnessCurve) * _MaxBrightness + 1.0;
  finalColor.rgb *= brightnessBoost;

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
  jsonValue.materials[0].floats['_VerticalOffset'] = -0.50;
  jsonValue.materials[0].floats['_VolumeCurve'] = 0.70; // 默认音量曲线
  jsonValue.materials[0].floats['_BrightnessCurve'] = 1.5;
  jsonValue.materials[0].floats['_MaxBrightness'] = 0.30;

  for (let i = 0; i < MAX_TEXTURES; i++) {
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
        <input type="range" id="noiseScaleX" min="0" max="1" step="0.01" value="0.10" style="width:100%"/>
        <span id="noiseScaleXValue">0.10</span>
      </div>
      <div style="width:48%">
        <label>噪声UV水平缩放:</label>
        <input type="range" id="noiseUVScaleX" min="0.0" max="1" step="0.001" value="0.081" style="width:100%"/>
        <span id="noiseUVScaleXValue">0.081</span>
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
        <input type="range" id="noiseUVScaleY" min="0.0" max="1.0" step="0.01" value="0.040" style="width:100%"/>
        <span id="noiseUVScaleYValue">0.040</span>
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
        <input type="range" id="noiseSpeedY" min="0" max="10" step="0.001" value="0.111" style="width:100%"/>
        <span id="noiseSpeedYValue">0.111</span>
      </div>
    </div>
    
    <div style="margin-bottom:6px;">
      <label>噪点偏移:</label>
      <input type="range" id="noiseBrightOffset" min="0" max="0.9" step="0.001" value="0.34" style="width:100%"/>
      <span id="noiseBrightOffsetValue">0.34</span>
    </div>

    <h3 style="margin:8px 0;color:#029896">细节噪声</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>细节强度:</label>
        <input type="range" id="detailNoiseScale" min="0" max="1" step="0.01" value="0.03" style="width:100%"/>
        <span id="detailNoiseScaleValue">0.03</span>
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
        <input type="range" id="detailNoiseScaleY" min="0" max="1" step="0.01" value="0.55" style="width:100%"/>
        <span id="detailNoiseScaleYValue">0.55</span>
      </div>
      <div style="width:48%">
        <label>水平速度:</label>
        <input type="range" id="detailNoiseSpeedX" min="0" max="10" step="0.1" value="0.30" style="width:100%"/>
        <span id="detailNoiseSpeedXValue">0.30</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div style="width:48%">
        <label>垂直速度:</label>
        <input type="range" id="detailNoiseSpeedY" min="0" max="10" step="0.1" value="0.30" style="width:100%"/>
        <span id="detailNoiseSpeedYValue">0.30</span>
      </div>
      <div style="width:48%">
        <label>UV水平缩放:</label>
        <input type="range" id="detailNoiseUVScaleX" min="0.1" max="10" step="0.1" value="1.10" style="width:100%"/>
        <span id="detailNoiseUVScaleXValue">1.10</span>
      </div>
    </div>
    <div style="margin-bottom:6px;">
      <label>UV垂直缩放:</label>
      <input type="range" id="detailNoiseUVScaleY" min="0.1" max="10" step="0.1" value="3.00" style="width:100%"/>
      <span id="detailNoiseUVScaleYValue">3.00</span>
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
     <input type="range" id="verticalOffset" min="-1.0" max="0.0" step="0.01" value="-0.50" style="width:100%"/>
     <span id="verticalOffsetValue">-0.50</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>音量响应曲线:</label>
     <input type="range" id="volumeCurve" min="0.1" max="2.0" step="0.05" value="0.70" style="width:100%"/>
     <span id="volumeCurveValue">0.70</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>亮度曲线:</label>
     <input type="range" id="brightnessCurve" min="0.5" max="3.0" step="0.1" value="1.5" style="width:100%"/>
     <span id="brightnessCurveValue">1.5</span>
   </div>
   <div style="margin-bottom:6px;">
     <label>亮度受音量影响程度:</label>
     <input type="range" id="maxBrightness" min="0.0" max="3.0" step="0.1" value="0.30" style="width:100%"/>
     <span id="maxBrightnessValue">0.30</span>
   </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', uiHtml);

  // 添加快照按钮和状态提示（固定在右下角）
  const snapshotContainer = document.createElement('div');
  snapshotContainer.style.position = 'fixed';
  snapshotContainer.style.bottom = '20px';
  snapshotContainer.style.right = '20px';
  snapshotContainer.style.zIndex = '10000';
  snapshotContainer.style.display = 'flex';
  snapshotContainer.style.flexDirection = 'column';
  snapshotContainer.style.alignItems = 'flex-end';
  snapshotContainer.style.gap = '10px';
  

  
  // 创建手动捕获快照按钮
  const captureButton = document.createElement('button');
  captureButton.textContent = '捕获快照';
  captureButton.style.padding = '8px 16px';
  captureButton.style.backgroundColor = '#136BCD';
  captureButton.style.color = 'white';
  captureButton.style.border = 'none';
  captureButton.style.borderRadius = '4px';
  captureButton.style.cursor = 'pointer';
  captureButton.style.marginBottom = '10px'; // 与链接保持间距
  captureButton.addEventListener('click', () => {
    captureButton.textContent = '捕获中...';
    captureButton.disabled = true;
    
    setTimeout(() => {
      controller.captureManualSnapshot();
      captureButton.textContent = '快照已保存';
      setTimeout(() => {
        captureButton.textContent = '捕获快照';
        captureButton.disabled = false;
      }, 2000);
    }, 500);
  });
  snapshotContainer.appendChild(captureButton);

  const openFolderLink = document.createElement('a');
  openFolderLink.id = 'open-folder-link';
  openFolderLink.textContent = '打开下载文件夹';
  openFolderLink.style.color = '#4fc3f7';
  openFolderLink.style.cursor = 'pointer';
  openFolderLink.style.fontSize = '14px';
  openFolderLink.style.textDecoration = 'underline';
  openFolderLink.onclick = () => {
    alert('请在浏览器的下载历史中查看文件位置');
  };
  
  snapshotContainer.appendChild(openFolderLink);
  document.body.appendChild(snapshotContainer);
  console.log('快照UI已添加到DOM');

  function hexToRgba (hex: string, alpha: number = 1): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    return [r, g, b, alpha];
  }

  // 初始化默认颜色
  // 第一阶段：蓝色和绿色
  controller.setFirstStageColors(
    hexToRgba('#559EF7',0.7), // 蓝色
    hexToRgba('#559EF7',0.7)  // 绿色
  );
  // 第二阶段：主色和副色
  controller.setSecondStageColors(
    hexToRgba('#559EF7'), // 主色
    hexToRgba('#55F7D8')  // 副色
  );

  //初始化  volumeThreshold ；
  controller.setVolumeThreshold(0.1);
  

  // 第一阶段蓝色
  const firstStageBlueInput = document.getElementById('listeningColor') as HTMLInputElement | null;
  if (firstStageBlueInput) {
    firstStageBlueInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;
      const blue = hexToRgba(target.value);
      const green = controller.firstStageGreenColor;
      
      controller.setFirstStageColors(blue, green);
    });
  }
  
  // 第一阶段绿色
  const firstStageGreenInput = document.getElementById('inputSecondaryColor') as HTMLInputElement | null;
  if (firstStageGreenInput) {
    firstStageGreenInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;
      const green = hexToRgba(target.value);
      const blue = controller.firstStageBlueColor;
      
      controller.setFirstStageColors(blue, green);
    });
  }
  
  // 第二阶段主色
  const secondStagePrimaryInput = document.getElementById('inputPrimaryColor') as HTMLInputElement | null;
  if (secondStagePrimaryInput) {
    secondStagePrimaryInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;
      const primary = hexToRgba(target.value);
      const secondary = controller.secondStageSecondaryColor;
      
      controller.setSecondStageColors(primary, secondary);
    });
  }
  
  // 第二阶段副色
  const secondStageSecondaryInput = document.getElementById('inputSecondaryColor') as HTMLInputElement | null;
  if (secondStageSecondaryInput) {
    secondStageSecondaryInput.addEventListener('input', e => {
      const target = e.target as HTMLInputElement;
      const secondary = hexToRgba(target.value);
      const primary = controller.secondStagePrimaryColor;
      
      controller.setSecondStageColors(primary, secondary);
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
  jsonValue.materials[0].floats['_DetailNoiseScale'] = 0.03;
  jsonValue.materials[0].floats['_DetailNoiseScaleX'] = 0.71;
  jsonValue.materials[0].floats['_DetailNoiseScaleY'] = 0.55;
  jsonValue.materials[0].floats['_DetailNoiseSpeedX'] = 0.30;
  jsonValue.materials[0].floats['_DetailNoiseSpeedY'] = 0.30;
  jsonValue.materials[0].floats['_DetailNoiseUVScaleX'] = 1.10;
  jsonValue.materials[0].floats['_DetailNoiseUVScaleY'] = 3.00;

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

  // 参数初始化移动到material创建后

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
  const SecondStageImageData = await loadLocalImageData('../public/拉伸绿光调整.png');
  const noiseimageData = await loadLocalImageData('../public/Perlin.png');
  const T_noiseimageData = await loadLocalImageData('../public/T_Noise.png');
  const FirstStageBlueImageData = await loadLocalImageData('../public/蓝光裁切.png');
  const FirstStageGreenImageData = await loadLocalImageData('../public/绿光裁切1.png');

  // eslint-disable-next-line no-console
  //console.log('4. Texture loaded, creating...');
  const cloudTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(SecondStageImageData.data),
      width: SecondStageImageData.width,
      height: SecondStageImageData.height,
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
  const FirstStageBlueTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(FirstStageBlueImageData.data),
      width: FirstStageBlueImageData.width,
      height: FirstStageBlueImageData.height,
    },
    {
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
    }
  );
  const FirstStageGreenTexture = Texture.createWithData(
    engine,
    {
      data: new Uint8Array(FirstStageGreenImageData.data),
      width: FirstStageGreenImageData.width,
      height: FirstStageGreenImageData.height,
    },
    {
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
    }
  );
  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    if (rendererComponents.length > 0) {
      const componentMaterials = rendererComponents[0].materials;

      if (componentMaterials.length > 0) {
        material = componentMaterials[0];
        setBlendMode(material, spec.BlendingMode.ALPHA);
        material.depthMask = false;

        // 初始化参数和纹理
        material.setFloat('_TextureCount', shaderParams._TextureCount);

        // 初始化时绑定三张纹理
        material.setTexture('_Tex0', FirstStageBlueTexture);
        material.setTexture('_Tex1', FirstStageGreenTexture);
        material.setTexture('_Tex2', cloudTexture);
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
          material.setFloat(`_Alpha${i}`, 0);
          // 设置默认颜色(白色)
          material.setVector4(`_Color${i}`, new Vector4(1, 1, 1, 1));
        }

        // 设置自定义shader参数的初始值
        material.setFloat('_NoiseScaleX', 0.10);
        material.setFloat('_NoiseScaleY', 0.74);
        material.setFloat('_NoiseSpeedX', 0.1);
        material.setFloat('_NoiseSpeedY', 0.111);
        material.setFloat('_NoiseUVScaleX', 0.081);
        material.setFloat('_NoiseUVScaleY', 0.040);
        material.setFloat('_VerticalOffset', -0.50);
        material.setFloat('_VolumeCurve', 0.70);
        material.setFloat('_BrightnessCurve', 1.5);
        material.setFloat('_MaxBrightness', 0.30);
        material.setFloat('_DetailNoiseScale', 0.03);
        material.setFloat('_DetailNoiseScaleX', 0.71);
        material.setFloat('_DetailNoiseScaleY', 0.55);
        material.setFloat('_DetailNoiseSpeedX', 0.30);
        material.setFloat('_DetailNoiseSpeedY', 0.30);
        material.setFloat('_DetailNoiseUVScaleX', 1.10);
        material.setFloat('_DetailNoiseUVScaleY', 3.00);

        // 设置第一阶段蓝色时序常量
        material.setFloat('_BlueFadeInEnd', 0.625);
        material.setFloat('_BlueMove1End', 2.375);
        material.setFloat('_BlueMove2End', 3.558);
        material.setFloat('_BlueFadeOutStart', 2.375);
        material.setFloat('_BlueFadeOutEnd', 3.417);
        material.setFloat('_BlueMove1TargetU', 0.1198);
        material.setFloat('_BlueMove1TargetV', -0.0);
        material.setFloat('_BlueMove2TargetU', 0.2382);
        material.setFloat('_BlueMove2TargetV', -0.0);
        material.setFloat('_BlueFadeInDeltaV', 0.0);

        // 设置第一阶段绿色时序常量
        material.setFloat('_GreenFadeInEnd', 1.292);
        material.setFloat('_GreenMoveEnd', 2.875);
        material.setFloat('_GreenFadeOutStart', 2.375);
        material.setFloat('_GreenFadeOutEnd', 3.458);
        material.setFloat('_GreenMoveTargetU', 0.266);
        material.setFloat('_GreenMoveTargetV', -0.0);
        material.setFloat('_GreenFadeInDeltaV', 0.0);

        // 立即更新UI显示为新设置的值
        const setSliderValue = (id: string, value: number, precision = 3) => {
          const input = document.getElementById(id) as HTMLInputElement | null;
          const valueSpan = document.getElementById(`${id}Value`);

          if (input && valueSpan) {
            input.value = value.toString();
            valueSpan.textContent = value.toFixed(precision);
          }
        };

        // 设置UI初始值
        setSliderValue('noiseScaleX', 0.10, 2);
        setSliderValue('noiseScaleY', 0.74, 2);
        setSliderValue('noiseSpeedX', 0.1, 1);
        setSliderValue('noiseSpeedY', 0.111, 3);
        setSliderValue('noiseBrightOffset', 0.34, 2);
        setSliderValue('noiseUVScaleX', 0.081, 3);
        setSliderValue('noiseUVScaleY', 0.040, 3);
        setSliderValue('verticalOffset', -0.50, 2);
        setSliderValue('volumeCurve', 0.70, 2);
        setSliderValue('brightnessCurve', 1.5, 1);
        setSliderValue('maxBrightness', 0.30, 2);
        setSliderValue('detailNoiseScale', 0.03, 2);
        setSliderValue('detailNoiseScaleX', 0.71, 2);
        setSliderValue('detailNoiseScaleY', 0.55, 2);
        setSliderValue('detailNoiseSpeedX', 0.30, 2);
        setSliderValue('detailNoiseSpeedY', 0.30, 2);
        setSliderValue('detailNoiseUVScaleX', 1.10, 2);
        setSliderValue('detailNoiseUVScaleY', 3.00, 2);

        // 初始化UI控件值
        // 删除这个会覆盖UI值的函数
        // const initUIControls = () => { ... };

        // 延迟一小段时间确保UI已加载，但不再更新UI值，因为已经在上面设置了
        setTimeout(() => {
          if (DEBUG) {console.log('Material and UI initialization complete');}
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
  const minVolume = 0.0; // 最小音量阈值
  const maxVolume = 1.0; // 最大音量阈值

  function getAudioVolume (): number {
    // 使用sin函数模拟0-1波动的音量
    const now = performance.now();
    const timeFactor = now * 0.0006; // 转换为秒
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

    if (timeFactor > 3000000) {return 0.8;} else if (timeFactor > 2000000) {return 0.6;} else if (timeFactor > 500000) {return 0.5;} else {return 1.00;}
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
      // 设置统一时间_Now
      material.setFloat('_Now', now);

      // 更新纹理数量
      const textureCount = Math.min(controller.textures.length, MAX_TEXTURES);
      const currentVolume = getAudioVolume();

      //console.log(textureCount);
      material.setFloat('_TextureCount', textureCount);
      // 传递音量参数
      material.setFloat('_CurrentVolume', currentVolume);
      material.setFloat('_MinVolume', minVolume);
      material.setFloat('_MaxVolume', maxVolume);


      // 更新每个纹理的参数
      for (let i = 0; i < textureCount; i++) {
        const texture = controller.textures[i];

        // 设置每纹理参数
        material.setFloat(`_TexStartedAt${i}`, texture.startedAt);
        material.setFloat(`_TexDuration${i}`, texture.duration);
        material.setFloat(`_TexFadeIn${i}`, texture.fadeIn);
        material.setFloat(`_TexFadeOutStart${i}`, texture.fadeOutStart);
        material.setFloat(`_TexFadeOutEnd${i}`, texture.fadeOutEnd);
        material.setFloat(`_TexDistance${i}`, texture.distance);
        material.setFloat(`_TexInitU${i}`, texture.initialOffsetU ?? 0);
        material.setFloat(`_TexInitV${i}`, texture.initialOffsetV ?? 0);
        material.setFloat(`_TexType${i}`, texture.type === 'listening' ? 0 : 1);
        material.setFloat(`_TexKind${i}`, texture.type === 'listening'
          ? (texture.textureType === 'blue' ? 0 : 1)
          : 2);
        material.setFloat(`_IsSecond${i}`, texture.isSecondTexture ? 1 : 0);
        
        // 设置纹理层级
        material.setFloat(`_Tex${i}Layer`, texture.layer);

        // 设置颜色
        if (texture.color) {
          material.setVector4(`_Color${i}`, new Vector4(...texture.color));
        }
      }
      // 对于未使用的纹理，重置参数
      for (let i = textureCount; i < MAX_TEXTURES; i++) {
        material.setFloat(`_TexStartedAt${i}`, 0);
        material.setFloat(`_TexDuration${i}`, 0);
        material.setFloat(`_TexFadeIn${i}`, 0);
        material.setFloat(`_TexFadeOutStart${i}`, 0);
        material.setFloat(`_TexFadeOutEnd${i}`, 0);
        material.setFloat(`_TexDistance${i}`, 0);
        material.setFloat(`_TexInitU${i}`, 0);
        material.setFloat(`_TexInitV${i}`, 0);
        material.setFloat(`_TexType${i}`, 0);
        material.setFloat(`_TexKind${i}`, 0);
        material.setFloat(`_IsSecond${i}`, 0);
        material.setFloat(`_Tex${i}Layer`, i);
        material.setVector4(`_Color${i}`, new Vector4(1, 1, 1, 0));
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
  { id: 'noiseScaleX', param: '_NoiseScaleX', value: 0.10, precision: 2 },
  { id: 'noiseScaleY', param: '_NoiseScaleY', value: 0.74, precision: 2 },
  { id: 'noiseSpeedX', param: '_NoiseSpeedX', value: 0.1, precision: 1 },
  { id: 'noiseSpeedY', param: '_NoiseSpeedY', value: 0.111, precision: 3 },
  { id: 'noiseBrightOffset', param: '_NoiseBrightOffset', value: 0.34, precision: 2 },
  { id: 'noiseUVScaleX', param: '_NoiseUVScaleX', value: 0.081, precision: 3 },
  { id: 'noiseUVScaleY', param: '_NoiseUVScaleY', value: 0.040, precision: 3 },
  { id: 'verticalOffset', param: '_VerticalOffset', value: -0.50, precision: 2 },
  { id: 'volumeCurve', param: '_VolumeCurve', value: 0.70, precision: 2 },
  { id: 'brightnessCurve', param: '_BrightnessCurve', value: 1.5, precision: 1 },
  { id: 'maxBrightness', param: '_MaxBrightness', value: 0.30, precision: 2 },
  { id: 'detailNoiseScale', param: '_DetailNoiseScale', value: 0.03, precision: 2 },
  { id: 'detailNoiseScaleX', param: '_DetailNoiseScaleX', value: 0.71, precision: 2 },
  { id: 'detailNoiseScaleY', param: '_DetailNoiseScaleY', value: 0.55, precision: 2 },
  { id: 'detailNoiseSpeedX', param: '_DetailNoiseSpeedX', value: 0.30, precision: 2 },
  { id: 'detailNoiseSpeedY', param: '_DetailNoiseSpeedY', value: 0.30, precision: 2 },
  { id: 'detailNoiseUVScaleX', param: '_DetailNoiseUVScaleX', value: 1.10, precision: 2 },
  { id: 'detailNoiseUVScaleY', param: '_DetailNoiseUVScaleY', value: 3.00, precision: 2 },
];


