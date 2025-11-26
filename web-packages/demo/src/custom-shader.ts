
import type { Material } from '@galacean/effects';
import { Player, RendererComponent, setBlendMode, spec } from '@galacean/effects';
import { math } from '@galacean/effects-core';
const { Vector4 } = math;

import { Texture, glContext } from '@galacean/effects-core';
import { TextureControllerNew } from './texture-controller-new.js';
enum MainStage { Listening, Input }

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*BnWQSaj0ghgAAAAAQaAAAAgAelB4AQ';
const container = document.getElementById('J-container');
const DEBUG = true; // 调试模式

// Shader参数接口
interface ShaderParams {
  _TextureCount: number, // 活动纹理数量
}

const shaderParams: ShaderParams = {
  _TextureCount: 0,
};

const MAX_TEXTURES = 4; // 最大纹理数量

// 顶点Shader - 基本顶点变换和UV传递
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

// 片段Shader - 多纹理混合和动画效果
const fragment = /*glsl*/ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec2 uv;
uniform float _Now;        // 统一时间（秒）
uniform vec4 _Time;        // 时间向量
uniform float _TextureCount;
uniform float _CurrentVolume; // 当前音量
uniform float _MinVolume;  // 最小音量
uniform float _MaxVolume;  // 最大音量
uniform float _BgIsWhite;  // 0: 黑底(原样), 1: 白底(增强对比)

// 纹理采样器
uniform sampler2D _Tex0;   // 第一阶段蓝
uniform sampler2D _Tex1;   // 第一阶段绿
uniform sampler2D _Tex2;   // 第二阶段

// 噪声纹理
uniform sampler2D _NoiseTex;   // 大尺度噪声
uniform sampler2D _T_NoiseTex; // 小尺度细节噪声
uniform float _Strength;       // 整体强度

// Stop信号参数
uniform float _StopSignal;         // 停止信号
uniform float _StopTime;           // 停止时间
uniform float _StopAffectListening;// 影响第一阶段
uniform float _StopAffectInput;    // 影响第二阶段

// 颜色参数
uniform vec4 _Color0;
uniform vec4 _Color1;
uniform vec4 _Color2;
uniform vec4 _Color3;

// 纹理参数
uniform float _TexStartedAt0; uniform float _TexStartedAt1; uniform float _TexStartedAt2; uniform float _TexStartedAt3;
uniform float _TexProfile0;   uniform float _TexProfile1;   uniform float _TexProfile2;   uniform float _TexProfile3;

// 硬编码动画参数
const float _BlueFadeInEnd = 0.625;
const float _BlueMove1End = 2.375;
const float _BlueMove2End = 3.558;
const float _BlueFadeOutStart = 2.375;
const float _BlueFadeOutEnd = 3.417;
const float _BlueMove1TargetU = 0.1198;
const float _BlueMove1TargetV = -0.0;
const float _BlueMove2TargetU = 0.2382;
const float _BlueMove2TargetV = -0.0;
const float _BlueFadeInDeltaV = 0.0;

const float _GreenFadeInEnd = 1.292;
const float _GreenMoveEnd = 2.875;
const float _GreenFadeOutStart = 2.375;
const float _GreenFadeOutEnd = 3.458;
const float _GreenMoveTargetU = 0.266;
const float _GreenMoveTargetV = -0.0;
const float _GreenFadeInDeltaV = 0.0;

// InputB 偏移常量
const float B_OFFSET_START = 0.06;   // 生命周期前/中段的偏移（更贴）
const float B_OFFSET_END   = 0.1775; // 生命周期末段的偏移（保证终点对齐）
const float B_OFFSET_POW   = 0.8;    // 插值曲线幂：0.6~1.2 可按观感微调

// 噪声参数
uniform float _NoiseScaleX;
uniform float _NoiseScaleY;
uniform float _NoiseSpeedX;
uniform float _NoiseSpeedY;
uniform float _NoiseUVScaleX;
uniform float _NoiseUVScaleY;
uniform float _DetailNoiseScale;
uniform float _DetailNoiseScaleX;
uniform float _DetailNoiseScaleY;
uniform float _DetailNoiseSpeedX;
uniform float _DetailNoiseSpeedY;
uniform float _DetailNoiseUVScaleX;
uniform float _DetailNoiseUVScaleY;

// 响应曲线参数
uniform float _VerticalOffset;
uniform float _VolumeCurve;
uniform float _BrightnessCurve;
uniform float _MaxBrightness;
uniform float _BrightnessGain; // 亮度增益

// ACES Filmic Tonemapping
vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// 透明度计算函数
float inputAlphaAt(float t, float fadeIn, float foStart, float foEnd){
  if (t < fadeIn) return t / max(0.0001, fadeIn);
  else if (t < foStart) return 1.0;
  else if (t < foEnd) return 1.0 - (t - foStart) / max(0.0001, (foEnd - foStart));
  else return 0.0;
}
float blueAlphaAt(float t){
  if (t < _BlueFadeInEnd) return t / max(0.0001, _BlueFadeInEnd);
  else if (t < _BlueFadeOutStart) return 1.0;
  else if (t < _BlueFadeOutEnd) return 1.0 - (t - _BlueFadeOutStart) / max(0.0001, (_BlueFadeOutEnd - _BlueFadeOutStart));
  else return 0.0;
}
float greenAlphaAt(float t){
  if (t < _GreenFadeInEnd) return t / max(0.0001, _GreenFadeInEnd);
  else if (t < _GreenFadeOutStart) return 1.0;
  else if (t < _GreenFadeOutEnd) return 1.0 - (t - _GreenFadeOutStart) / max(0.0001, (_GreenFadeOutEnd - _GreenFadeOutStart));
  else return 0.0;
}

// UV范围限制
vec2 clampUV(vec2 uv) {
  return clamp(uv, vec2(0.01), vec2(0.99));
}

// 安全纹理采样（边缘淡出）- 修复顶部断线问题
vec4 safeTexture2D(sampler2D tex, vec2 uv) {
  vec4 color = texture2D(tex, clamp(uv, vec2(0.0), vec2(1.0)));
  return color;
}

// 根据类型选择采样纹理
vec4 sampleTexByType(float typeV, float kindV, vec2 uv) {
  if (int(typeV) == 0) {
    if (int(kindV) == 0) return safeTexture2D(_Tex0, uv); // blue
    else return safeTexture2D(_Tex1, uv);                 // green
  } else {
    return safeTexture2D(_Tex2, uv);                      // input
  }
}

// 应用提前停止逻辑
void applyEarlyStop(float startedAt, float fadeOutStart, float fadeOutEnd, float typeV,
                    out float effStart, out float effEnd) {
  effStart = fadeOutStart;
  effEnd = fadeOutEnd;
  if (_StopSignal > 0.5) {
    if (_StopTime >= startedAt) {
      bool affect = (int(typeV) == 0) ? (_StopAffectListening > 0.5) : (_StopAffectInput > 0.5);
      if (affect) {
        float elapsedAtStop = _StopTime - startedAt;
        float outDur = max(0.0001, 0.3);
        effStart = elapsedAtStop;
        effEnd = effStart + outDur;
      }
    }
  }
}

// 计算蓝色纹理位置和透明度
void calcListeningBlue(float elapsed, float startedAt, float initU, float initV,
                       out float ox, out float oy, out float a) {
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
  
  float effS, effE;
  applyEarlyStop(startedAt, _BlueFadeOutStart, _BlueFadeOutEnd, 0.0, effS, effE);
  float baseA = blueAlphaAt(elapsed);
  if (_StopSignal > 0.5 && elapsed >= effS){
    // 从当前实际透明度开始淡出，而不是从aStop开始
    float k = clamp((elapsed - effS) / max(0.0001, (effE - effS)), 0.0, 1.0);
    a = mix(baseA, 0.0, k);  // 使用baseA而不是aStop
  }else{
    a = baseA;
  }
}

// 计算绿色纹理位置和透明度
void calcListeningGreen(float elapsed, float startedAt, float initU, float initV,
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
  
  float effS, effE;
  applyEarlyStop(startedAt, _GreenFadeOutStart, _GreenFadeOutEnd, 0.0, effS, effE);
  float baseA = greenAlphaAt(elapsed);
  if (_StopSignal > 0.5 && elapsed >= effS){
    // 从当前实际透明度开始淡出，而不是从aStop开始
    float k = clamp((elapsed - effS) / max(0.0001, (effE - effS)), 0.0, 1.0);
    a = mix(baseA, 0.0, k);  // 使用baseA而不是aStop
  }else{
    a = baseA;
  }
}

// 获取模板参数
void getProfileParams(float profile,
    out float duration, out float fadeIn, out float fadeOutStart, out float fadeOutEnd,
    out float distance, out float initU, out float initV, out float isSecond,
    out int samplerId, out int typeIsListening) {
  if (int(profile) == 0) { // ListeningBlue
    duration = 3.417; fadeIn = 0.625; fadeOutStart = 2.375; fadeOutEnd = 3.417;
    distance = 0.0; initU = -0.30; initV = 0.0; isSecond = 0.0;
    samplerId = 0; typeIsListening = 1;
  } else if (int(profile) == 1) { // ListeningGreen
    duration = 3.458; fadeIn = 1.292; fadeOutStart = 2.375; fadeOutEnd = 3.458;
    distance = 0.0; initU = -0.20; initV = -0.0; isSecond = 0.0;
    samplerId = 1; typeIsListening = 1;
  } else if (int(profile) == 2) { // InputA
    duration = 3.7; fadeIn = 0.533; fadeOutStart = 2.9333; fadeOutEnd = 3.6167;
    distance = 1.2315; initU = -0.48; initV = 0.0; isSecond = 0.0;
    samplerId = 2; typeIsListening = 0;
  } else { // InputB
    duration = 3.7;
    // 可选：把时间窗拉近 A，重叠更明显；若不想动时间，也可保留你原来的三项
    fadeIn = 0.60;             
    fadeOutStart = 2.9333;     
    fadeOutEnd   = 3.6167;     

    distance = 1.2315;         // 与 A 一致，减少"越走越开"
    initU = -0.48;
    initV = 0.02;              // 上下更贴（也可用 0.0）
    isSecond = 1.0;
    samplerId = 2; typeIsListening = 0;
  }
}

// 根据采样器ID选择纹理
vec4 sampleBySamplerId(int samplerId, vec2 uv) {
  if (samplerId == 0) return safeTexture2D(_Tex0, uv);
  else if (samplerId == 1) return safeTexture2D(_Tex1, uv);
  else return safeTexture2D(_Tex2, uv);
}

// 计算输入阶段纹理位置和透明度
void calcInput(float elapsed, float startedAt, float duration, float initU, float initV, float distance, float isSecond,
               float fadeIn, float fadeOutStart, float fadeOutEnd,
               out float ox, out float oy, out float a) {
  float lifeP = duration > 0.0 ? clamp(elapsed / duration, 0.0, 1.0) : 0.0;
  ox = initU + distance * lifeP;
  if (isSecond > 0.5) {
    float offsetU = mix(B_OFFSET_START, B_OFFSET_END, pow(lifeP, B_OFFSET_POW));
    ox -= offsetU;
  }
  oy = initV;

  float effS, effE;
  applyEarlyStop(startedAt, fadeOutStart, fadeOutEnd, 1.0, effS, effE);
  float baseA = inputAlphaAt(elapsed, fadeIn, fadeOutStart, fadeOutEnd);
  if (_StopSignal > 0.5 && elapsed >= effS){
    // 从当前实际透明度开始淡出，而不是从aStop开始
    float k = clamp((elapsed - effS) / max(0.0001, (effE - effS)), 0.0, 1.0);
    a = mix(baseA, 0.0, k);  // 使用baseA而不是aStop
  }else{
    a = baseA;
  }
}

// 获取纹理参数
void fetchTexParams(int idx,
  out float startedAt, out float duration, out float fadeIn, out float fadeOutStart, out float fadeOutEnd,
  out float distance, out float initU, out float initV, out float typeV, out float kindV, out float isSecond,
  out float profile
) {
  if (idx == 0) startedAt = _TexStartedAt0;
  else if (idx == 1) startedAt = _TexStartedAt1;
  else if (idx == 2) startedAt = _TexStartedAt2;
  else startedAt = _TexStartedAt3;

  if (idx == 0) profile = _TexProfile0;
  else if (idx == 1) profile = _TexProfile1;
  else if (idx == 2) profile = _TexProfile2;
  else profile = _TexProfile3;

  int samplerId;
  int typeIsListening;
  getProfileParams(profile, duration, fadeIn, fadeOutStart, fadeOutEnd, distance, initU, initV, isSecond, samplerId, typeIsListening);

  typeV = float(typeIsListening == 1 ? 0 : 1);
  if (typeIsListening == 1) {
    kindV = (int(profile) == 0) ? 0.0 : 1.0;
  } else {
    kindV = 2.0;
  }
}

void main() {
  // 使用 _Time.y 用于噪声计算以保持与之前一致
  float timeFactor = _Time.y;

  // 大尺度噪声计算
  vec2 largeNoiseUV = uv * vec2(_NoiseUVScaleX, _NoiseUVScaleY);
  vec2 largeNoise = vec2(
    texture2D(_NoiseTex, largeNoiseUV + vec2(timeFactor * _NoiseSpeedX, 0)).r,
    texture2D(_NoiseTex, largeNoiseUV + vec2(0, timeFactor * _NoiseSpeedY)).r
  );
  largeNoise = (largeNoise) * vec2(_NoiseScaleX, _NoiseScaleY);
  
  // 小尺度细节噪声计算
  vec2 detailNoiseUV = uv * vec2(_DetailNoiseUVScaleX, _DetailNoiseUVScaleY);
  vec2 detailNoise = vec2(
    texture2D(_T_NoiseTex, detailNoiseUV + vec2(timeFactor * _DetailNoiseSpeedX, 0)).r,
    texture2D(_T_NoiseTex, detailNoiseUV + vec2(0, timeFactor * _DetailNoiseSpeedY)).r
  );
  detailNoise = (detailNoise) * vec2(_DetailNoiseScaleX, _DetailNoiseScaleY) * _DetailNoiseScale;
  
  // 混合两种噪声
  vec2 mixedNoise = largeNoise + detailNoise;
  
  // 计算归一化音量(0-1)
  float normalizedVolume = clamp((_CurrentVolume - _MinVolume) / (_MaxVolume - _MinVolume), 0.0, 1.0);

  // 计算垂直偏移
  float verticalOffset = mix(_VerticalOffset, 0.0, pow(normalizedVolume, _VolumeCurve));
  verticalOffset = min(max(verticalOffset, -0.2), 0.0);

  // Y 方向 mask：0.2 以下为 0，以上从 0→1 且越上越快（写死参数）
  float y = uv.y;
  float start = 0.01;                         // 起始 Y，以下不受噪声影响
  float rawMask = clamp((y - start) / (1.0 - start), 0.0, 1.0);
  float power =  1.3;                         // >1 越靠上变化越快
  float yMask = pow(rawMask, power);

  // 最终扰动偏移，噪声部分乘以 yMask，verticalOffset 保持原逻辑
  vec2 finalOffset = -vec2(mixedNoise.x, mixedNoise.y) * _Strength * normalizedVolume * yMask
                     + vec2(0.0, verticalOffset);

  vec4 finalColor = vec4(0.0);
  int textureCount = int(_TextureCount);

  // 直接按顺序处理纹理，CPU 已经排序好了
  for (int i = 0; i < 4; i++) {
    if (i < textureCount){
        float startedAt, duration, fadeIn, fadeOutStart, fadeOutEnd, distance, initU, initV, typeV, kindV, isSecond, profile;
        fetchTexParams(i, startedAt, duration, fadeIn, fadeOutStart, fadeOutEnd, distance, initU, initV, typeV, kindV, isSecond, profile);
        float elapsed = _Now - startedAt;

        float ox = 0.0; float oy = 0.0; float a = 0.0;
        if (int(typeV) == 0) { // listening
          if (int(kindV) == 0) {
            calcListeningBlue(elapsed, startedAt, initU, initV, ox, oy, a);
          } else {
            calcListeningGreen(elapsed, startedAt, initU, initV, ox, oy, a);
          }
        } else { // input
          calcInput(elapsed, startedAt, duration, initU, initV, distance, isSecond, fadeIn, fadeOutStart, fadeOutEnd, ox, oy, a);
        }

        // ---- 统一整体下移 + 顶部渐隐 ----
        // 写死的常量：整体下移/顶部淡出范围
        const float GLOBAL_Y_OFFSET = 0.11; // 负值往下，按效果可微调 -0.01 ~ -0.05
        const float TOP_FADE_START  = 0.95;  // 顶部从哪里开始淡出（0~1，越接近1越靠上）
        const float TOP_FADE_END    = 1.0;   // 顶部完全透明的位置（必须 > START）

        // 应用动画偏移
        vec2 sampleUV = vec2(uv.x, uv.y) + vec2(ox, oy) - finalOffset;

        // 整体往下移一点，避免采到纹理最上沿的硬边
        sampleUV.y += GLOBAL_Y_OFFSET;

        // clamp UV 避免越界
        //sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));

        // 采样纹理
        vec4 color = sampleTexByType(typeV, kindV, sampleUV);

        // 根据profile编号选择预设颜色
        if (int(profile) == 0) { // listeningBlue
          color.rgb = _Color0.rgb;
          a *= _Color0.a;
        } else if (int(profile) == 1) { // listeningGreen
          color.rgb = _Color1.rgb;
          a *= _Color1.a;
        } else if (int(profile) == 2) { // inputA
          color.rgb = _Color2.rgb;
          a *= _Color2.a;
        } else { // inputB
          color.rgb = _Color3.rgb;
          a *= _Color3.a;
        }

        color.a *= a;

        // 顶部渐隐：让靠近纹理上边缘的区域 alpha 逐渐变为 0，消掉"割裂边"
        float topMask = 1.0;
        if (TOP_FADE_END > TOP_FADE_START) {
          float t = (sampleUV.y - TOP_FADE_START) / max(1e-4, (TOP_FADE_END - TOP_FADE_START));
          // t < 0 => 还没到顶部淡出区，mask=1
          // t in [0,1] => 从1线性降到0
          // t > 1 => 顶部以外，mask=0
          topMask = 1.0 - clamp(t, 0.0, 1.0);
          // 稍微软一点的曲线
          topMask = pow(topMask, 1.5);
        }
        color.a *= topMask;

        // 按从后到前混合
        finalColor.rgb = finalColor.rgb * (1.0 - color.a) + color.rgb * color.a;
        finalColor.a   = finalColor.a   * (1.0 - color.a) + color.a;
    }

  
  }

  if (_BgIsWhite > 0.5) {
    vec3 c = clamp(finalColor.rgb, 0.0, 1.0);
    float L = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 gray = vec3(L);

    // 音量映射
    float v = clamp(normalizedVolume, 0.0, 1.0);
    float lvlSat = pow(v, 0.55);           // 饱和度响应（<1 提升低中段灵敏度）
    float lvlLum = pow(v, _BrightnessCurve); // 亮度响应，和黑底保持一致的曲线风格

    // Vibrance：只改饱和度，不改亮度和透明度
    float satApprox = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float vibMask = 1.0 - clamp(satApprox / (L + 1e-3), 0.0, 1.0);
    float satBase = 0.22;
    float satRange = 0.45;
    float satBoost = (satBase + satRange * lvlSat) * clamp(finalColor.a, 0.0, 1.0);
    vec3 col = gray + (c - gray) * (1.0 + satBoost * (0.6 + 0.4 * vibMask));

    // 亮度反向缩放：音量低更亮，音量高回到 1.0（不改透明度）
    float brightRange = 0.2;              // v=0 时最多 +20% 亮度
    float brightnessScale = 0.95 + brightRange * (1.0 - lvlLum);
    finalColor.rgb = clamp(col * brightnessScale, 0.0, 1.0);
    // finalColor.a 不变
  } else {
    finalColor.rgb *= _BrightnessGain;
    float brightnessBoost = pow(normalizedVolume, _BrightnessCurve) * _MaxBrightness + 1.0;
    finalColor.rgb *= brightnessBoost;
  }

  gl_FragColor = vec4(finalColor.rgb, finalColor.a);
}
`;

let material: Material | undefined;

// 主入口函数 - 初始化播放器和场景
(async () => {
  const player = new Player({
    container,
    interactive: true,
    onError: (err: Error) => {
      console.error('Player error:', err);
    },
  });

  if (DEBUG) {
    console.log('Player created');
  }

  const jsonValue = await getJSON(json);

  jsonValue.materials[0].floats = jsonValue.materials[0].floats || {};
  jsonValue.materials[0].vector3s = jsonValue.materials[0].vector3s || {};
  jsonValue.materials[0].textures = jsonValue.materials[0].textures || {};

  Object.entries(shaderParams).forEach(([key, value]) => {
    if (typeof value === 'number') {
      jsonValue.materials[0].floats[key] = value;
    }
  });

  for (let i = 0; i < MAX_TEXTURES; i++) {
    jsonValue.materials[0].vector4s[`_Color${i}`] = [1, 1, 1, 1];
  }

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;
  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_2');

  const controller = new TextureControllerNew(0.1);

  const engine = composition.renderer.engine;

  // 加载本地图片数据
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

        resolve(imageData);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = path;
    });
  };

  const SecondStageImageData = await loadLocalImageData('../public/拉伸绿光调整.png');
  const noiseimageData = await loadLocalImageData('../public/Perlin.png');
  const T_noiseimageData = await loadLocalImageData('../public/T_Noise.png');
  const FirstStageBlueImageData = await loadLocalImageData('../public/蓝光裁切.png');
  const FirstStageGreenImageData = await loadLocalImageData('../public/绿光裁切1.png');
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
      flipY: true,
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
      flipY: true,
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
      wrapS: glContext.CLAMP_TO_EDGE,
      wrapT: glContext.CLAMP_TO_EDGE,
      flipY: true,
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
        // material.setTexture('_Tex0', FirstStageBlueTexture);
        // material.setTexture('_Tex1', FirstStageGreenTexture);
        // material.setTexture('_Tex2', cloudTexture);
        // // 设置噪声纹理
        // material.setTexture('_NoiseTex', noiseTexture);
        // // 设置T噪声纹理
        // material.setTexture('_T_NoiseTex', T_noiseTexture);
        // 设置噪声强度
        material.setFloat('_Strength', 1.0);
        // 纹理层级已在shader中硬编码，不再需要设置

        // 初始化颜色参数 - 直接在初始化时设置预设颜色
        material.setVector4('_Color0', new Vector4(0.333, 0.619, 0.968, 0.7)); // listeningBlue
        material.setVector4('_Color1', new Vector4(0.333, 0.619, 0.968, 0.7)); // listeningGreen
        material.setVector4('_Color2', new Vector4(0.333, 0.619, 0.968, 1.0)); // inputA
        material.setVector4('_Color3', new Vector4(0.333, 0.968, 0.847, 1.0)); // inputB

        // material.setVector4('_Color0', new Vector4(142/255, 208/255, 1, 1)); // listeningBlue
        // material.setVector4('_Color1', new Vector4(142/255, 208/255, 1, 1)); // listeningGreen
        // material.setVector4('_Color2', new Vector4(142/255, 208/255, 1, 1)); // inputA
        // material.setVector4('_Color3', new Vector4(69/255, 234/255, 193/255, 1.0)); // inputB

        // 初始化噪声参数（使用之前硬编码的值）
        material.setFloat('_NoiseScaleX', 0.1);
        material.setFloat('_NoiseScaleY', -0.19);
        material.setFloat('_NoiseSpeedX', 0.1);
        material.setFloat('_NoiseSpeedY', 0.1);
        material.setFloat('_NoiseUVScaleX', 0.35);
        material.setFloat('_NoiseUVScaleY', 0.1);

        // 初始化细节噪声参数
        material.setFloat('_DetailNoiseScale', 0.05);
        material.setFloat('_DetailNoiseScaleX', 0.35);
        material.setFloat('_DetailNoiseScaleY', 0.55);
        material.setFloat('_DetailNoiseSpeedX', 0.30);
        material.setFloat('_DetailNoiseSpeedY', 0.30);
        material.setFloat('_DetailNoiseUVScaleX', 1.0);
        material.setFloat('_DetailNoiseUVScaleY', 1.500);

        // 初始化响应曲线参数
        material.setFloat('_VerticalOffset', -0.15);
        material.setFloat('_VolumeCurve', 0.3);
        material.setFloat('_BrightnessCurve', 2.0);
        material.setFloat('_MaxBrightness', 0.3);
        material.setFloat('_BrightnessGain', 1.3);

        // 初始化白底检测参数 - 默认黑底（0），白底为（1）
        material.setFloat('_BgIsWhite', isWhiteBackground(container!) ? 1 : 0);

        // 延迟一小段时间确保UI已加载
        setTimeout(() => {
          if (DEBUG) {console.log('Material and UI initialization complete');}
        }, 100);
      }
    }
  }

  const minVolume = 0.0; // 最小音量
  const maxVolume = 1.0; // 最大音量

  // 获取滑条控制的音量值
  function getSliderVolume (): number {
    const slider = document.getElementById('volume-slider') as HTMLInputElement;

    if (slider) {
      return parseFloat(slider.value) / 100;
    }

    return 0.5; // 默认值
  }

  // 数值范围限制函数
  function clamp (value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  let lastTime = performance.now() / 1000;

  controller.setVolumeThreshold(0.2);
  // 更新循环 - 每帧更新状态和Shader参数
  function updateLoop () {
    const now = performance.now() / 1000;
    const delta = (now - lastTime);

    lastTime = now;

    const volume = getSliderVolume();

    if (DEBUG) {
      console.log(`Current volume: ${volume}`);
    }

    controller.update(delta, volume, now);

    if (material) {
      material.setFloat('_Now', now);

      const currentVolume = getSliderVolume();

      material.setFloat('_CurrentVolume', currentVolume);
      material.setFloat('_MinVolume', minVolume);
      material.setFloat('_MaxVolume', maxVolume);

      // 使用新的 params 接口一次性应用所有参数
      const params = controller.getParams();

      material.setFloat('_TextureCount', params.textureCount);
      for (let i = 0; i < params.textureCount; i++) {
        material.setFloat(`_TexStartedAt${i}`, params.slots[i].startedAt);
        material.setFloat(`_TexProfile${i}`, params.slots[i].profile);
      }
      for (let i = params.textureCount; i < 4; i++) {
        material.setFloat(`_TexStartedAt${i}`, 0);
        material.setFloat(`_TexProfile${i}`, 0);
      }

      if (params.stop?.active) {
        material.setFloat('_StopSignal', 1);
        material.setFloat('_StopTime', params.stop.time);
        material.setFloat('_StopAffectListening', params.stop.affectListening ? 1 : 0);
        material.setFloat('_StopAffectInput', params.stop.affectInput ? 1 : 0);
      } else {
        material.setFloat('_StopSignal', 0);
        material.setFloat('_StopTime', 0);
        material.setFloat('_StopAffectListening', 0);
        material.setFloat('_StopAffectInput', 0);
      }
    }
    requestAnimationFrame(updateLoop);
  }

  // 添加按钮事件监听器
  setTimeout(() => {
    const stopBtn = document.getElementById('stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
    const volumeValue = document.getElementById('volume-value');

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        controller.requestStop();
        if (DEBUG) {
          console.log('Stop button clicked');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        controller.reset();
        if (DEBUG) {
          console.log('Reset button clicked');
        }
      });
    }

    if (volumeSlider && volumeValue) {
      volumeSlider.addEventListener('input', e => {
        const value = parseFloat((e.target as HTMLInputElement).value);

        volumeValue.textContent = `${value}%`;
        if (DEBUG) {
          console.log(`Volume slider changed to: ${value / 100}`);
        }
      });
    }
  }, 100);

  updateLoop();
  player.play();
})();

// 获取JSON数据
function getJSON (json: string): Promise<any> {
  return fetch(json).then(res => res.json());
}

// 自动判断容器背景是否偏白
function isWhiteBackground (el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);

  if (!m) {return false;}
  const parts = m[1].split(',').map(v => parseFloat(v));
  const r = parts[0], g = parts[1], b = parts[2];
  // 使用线性亮度估算
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luma > 0.85; // 阈值可改
}
