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
import { Texture, glContext } from '@galacean/effects-core';
import { TextureController } from './texture-controller.js';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*Ad0nS4KNtEMAAAAAQDAAAAgAelB4AQ';
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
uniform float _CanvasAspect;
uniform float _TextureAspect;
uniform int _TextureCount;
uniform float _Offsets[4];
uniform float _Alphas[4];
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;

// 确保UV在有效范围内采样
vec2 clampUV(vec2 uv) {
  return clamp(uv, vec2(0.01), vec2(0.99));
}

void main() {
  vec4 finalColor = vec4(0.0);
  
  if (_TextureCount > 0) {
    float offset = _Offsets[0];
    float alpha = _Alphas[0];
    vec2 tuv = clampUV(vec2(uv.x - offset, uv.y)); // 移除Y翻转

    vec4 color = texture2D(uTex0, tuv);
    color.a *= alpha;
    
    // 简化边缘处理
    float edgeFactor = smoothstep(0.0, 0.2, min(tuv.x, 1.0-tuv.x)) *
                       smoothstep(0.0, 0.2, min(tuv.y, 1.0-tuv.y));
    color.a *= edgeFactor;
    
    finalColor += color * color.a; // 改为加法混合
  }
  
  if (_TextureCount > 1) {
    float offset = _Offsets[1];
    float alpha = _Alphas[1];
    vec2 tuv = clampUV(vec2(uv.x - offset, uv.y));
    vec4 color = texture2D(uTex1, tuv);
    color.a *= alpha;
    
    float edgeFactor = smoothstep(0.0, 0.2, min(tuv.x, 1.0-tuv.x)) *
                       smoothstep(0.0, 0.2, min(tuv.y, 1.0-tuv.y));
    color.a *= edgeFactor;
    
    finalColor += color * color.a;
  }
  
  if (_TextureCount > 2) {
    float offset = _Offsets[2];
    float alpha = _Alphas[2];
    vec2 tuv = clampUV(vec2(uv.x - offset, uv.y));
    vec4 color = texture2D(uTex2, tuv);
    color.a *= alpha;
    
    float edgeFactor = smoothstep(0.0, 0.2, min(tuv.x, 1.0-tuv.x)) *
                       smoothstep(0.0, 0.2, min(tuv.y, 1.0-tuv.y));
    color.a *= edgeFactor;
    
    finalColor += color * color.a;
  }
  
  if (_TextureCount > 3) {
    float offset = _Offsets[3];
    float alpha = _Alphas[3];
    vec2 tuv = clampUV(vec2(uv.x - offset, uv.y));
    vec4 color = texture2D(uTex3, tuv);
    color.a *= alpha;
    
    float edgeFactor = smoothstep(0.0, 0.2, min(tuv.x, 1.0-tuv.x)) *
                       smoothstep(0.0, 0.2, min(tuv.y, 1.0-tuv.y));
    color.a *= edgeFactor;
    
    finalColor += color * color.a;
  }

  gl_FragColor = finalColor;
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

  // 添加偏移和透明度数组参数
  for (let i = 0; i < MAX_TEXTURES; i++) {
    jsonValue.materials[0].floats[`_Offsets[${i}]`] = 0;
    jsonValue.materials[0].floats[`_Alphas[${i}]`] = 0;
  }

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;
  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_4');

  const controller = new TextureController();
  const engine = composition.renderer.engine;

  // 初始化时重置到监听状态
  controller.resetToListening(performance.now());
  //console.log('Initialized controller with textures:', controller.textures);

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

  // 设置宽高比参数
  if (container) {
    shaderParams._CanvasAspect = container.clientWidth / container.clientHeight;
  }
  shaderParams._TextureAspect = imageData.width / imageData.height;

  if (item) {
    const rendererComponents = item.getComponents(RendererComponent);

    if (rendererComponents.length > 0) {
      const componentMaterials = rendererComponents[0].materials;

      if (componentMaterials.length > 0) {
        material = componentMaterials[0];
        setBlendMode(material, spec.BlendingMode.ALPHA);
        material.depthMask = false;

        // 初始化参数和纹理
        material.setFloat('_CanvasAspect', shaderParams._CanvasAspect);
        material.setFloat('_TextureAspect', shaderParams._TextureAspect);
        material.setInt('_TextureCount', shaderParams._TextureCount);

        // 分别设置四个独立纹理
        material.setTexture('uTex0', cloudTexture);
        material.setTexture('uTex1', cloudTexture);
        material.setTexture('uTex2', cloudTexture);
        material.setTexture('uTex3', cloudTexture);

        // 初始化偏移和透明度数组
        for (let i = 0; i < MAX_TEXTURES; i++) {
          material.setFloat(`_Offsets[${i}]`, 0);
          material.setFloat(`_Alphas[${i}]`, 0);
        }
      }
    }
  }

  /**
   * 获取当前音量(模拟)
   * 实际项目中应替换为真实音频分析
   * @returns 模拟音量值(0-1)
   */
  function getAudioVolume () {
    return Math.random(); // 模拟音量
  }

  let lastTime = performance.now();

  /**
   * 更新循环
   * 每帧更新纹理控制器状态和Shader参数
   */
  function updateLoop () {
    const now = performance.now();
    const delta = (now - lastTime) / 1000;

    lastTime = now;

    const volume = getAudioVolume();

    console.log(`Current volume: ${volume}`);

    controller.update(delta, volume, now);

    // eslint-disable-next-line no-console
    //console.log('Controller stage:', controller.mainStage);
    //console.log('Textures:', controller.textures);

    if (material) {
      // 更新纹理数量
      const textureCount = Math.min(controller.textures.length, MAX_TEXTURES);

      material.setInt('_TextureCount', textureCount);

      // 更新每个纹理的参数
      for (let i = 0; i < textureCount; i++) {
        const texture = controller.textures[i];

        material.setFloat(`_Offsets[${i}]`, texture.x);
        material.setFloat(`_Alphas[${i}]`, texture.alpha);

        // 调试日志
        if (DEBUG && i === 0) {
          console.log(`Texture ${i} - x: ${texture.x.toFixed(2)}, alpha: ${texture.alpha.toFixed(2)}`);
        }
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
