/* eslint-disable no-console */
/**
 * 音频可视化效果核心实现
 * 功能：
 * 1. 监听阶段：单纹理移动和透明度变化
 * 2. 输入阶段：双纹理混合移动
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
  console.log('Custom Shader Initializing...');
}

// 核心Shader参数
interface ShaderParams {
  _OffsetA: number,  // 纹理A的水平偏移
  _OffsetB: number,  // 纹理B的水平偏移
  _AlphaA: number,   // 纹理A的透明度
  _AlphaB: number,   // 纹理B的透明度
  _CanvasAspect: number, // 画布宽高比
  _TextureAspect: number, // 纹理宽高比
}

const shaderParams: ShaderParams = {
  _OffsetA: 0,
  _OffsetB: 0,
  _AlphaA: 0,
  _AlphaB: 0,
  _CanvasAspect: 1,
  _TextureAspect: 1,
};

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
 * 实现双纹理混合效果：
 * 1. 根据偏移量计算两个纹理的UV
 * 2. 应用透明度混合
 * 3. 确保纹理在有效范围内显示
 */
const fragment = /*glsl*/ `
#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec2 uv;                  // 从顶点Shader传递的UV坐标
uniform float _OffsetA, _OffsetB;  // 纹理A和B的水平偏移(像素单位)
uniform float _AlphaA, _AlphaB;    // 纹理A和B的透明度
uniform float _CanvasAspect, _TextureAspect; // 画布和纹理宽高比
uniform sampler2D uTexA, uTexB;    // 纹理A和B

void main() {
  // 计算归一化的偏移量(假设画布宽度为1000像素)
  float normOffsetA = _OffsetA / 1000.0;
  float normOffsetB = _OffsetB / 1000.0;
  
  // 计算带偏移的UV坐标(从右向左移动)
  vec2 tuvA = vec2(uv.x - normOffsetA, 1.0 - uv.y);
  vec2 tuvB = vec2(uv.x - normOffsetB, 1.0 - uv.y);
  
  // 采样纹理A
  vec4 colorA = texture2D(uTexA, tuvA);
  colorA.a *= _AlphaA;
  
  // 采样纹理B
  vec4 colorB = texture2D(uTexB, tuvB);
  colorB.a *= _AlphaB;
  
  // 预乘alpha并加法混合
  colorA.rgb *= colorA.a;
  colorB.rgb *= colorB.a;
  gl_FragColor = colorA + colorB;
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
  console.log('1. Starting initialization...');
  const player = new Player({
    container,
    interactive: true,
    onError: (err: Error, ...args: any[]) => {
      // eslint-disable-next-line no-console
      console.error('Player error:', err.message);
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

  jsonValue.shaders[0].vertex = vertex;
  jsonValue.shaders[0].fragment = fragment;
  const composition = await player.loadScene(jsonValue);
  const item = composition.getItemByName('effect_4');

  const controller = new TextureController();
  const engine = composition.renderer.engine;

  // 初始化时重置到监听状态
  controller.resetToListening(performance.now());
  console.log('Initialized controller with textures:', controller.textures);

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
        console.log(`Texture loaded: ${path}, size: ${img.width}x${img.height}`);
        resolve(imageData);
      };
      img.onerror = err => {
        console.error(`Failed to load texture: ${path}`, err);
        reject(err);
      };
      img.src = path;
    });
  };

  // eslint-disable-next-line no-console
  console.log('3. Loading texture...');
  const imageData = await loadLocalImageData('/assets/cloud.png');

  // eslint-disable-next-line no-console
  console.log('4. Texture loaded, creating...');
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

  // 重新加载场景以应用纹理修改
  await player.loadScene(jsonValue);

  // 初始化材质参数
  function applyShaderParams (material: Material) {
    // eslint-disable-next-line no-console
    console.log('Applying shader params:', {
      _OffsetA: shaderParams._OffsetA,
      _AlphaA: shaderParams._AlphaA,
      _OffsetB: shaderParams._OffsetB,
      _AlphaB: shaderParams._AlphaB,
    });

    material.setFloat('_OffsetA', shaderParams._OffsetA);
    material.setFloat('_OffsetB', shaderParams._OffsetB);
    material.setFloat('_AlphaA', shaderParams._AlphaA);
    material.setFloat('_AlphaB', shaderParams._AlphaB);
    material.setFloat('_CanvasAspect', shaderParams._CanvasAspect);
    material.setFloat('_TextureAspect', shaderParams._TextureAspect);
    material.setTexture('uTexA', cloudTexture);
    material.setTexture('uTexB', cloudTexture);

    // eslint-disable-next-line no-console
    console.log('Actual material values:', {
      _OffsetA: material.getFloat('_OffsetA'),
      _AlphaA: material.getFloat('_AlphaA'),
      _OffsetB: material.getFloat('_OffsetB'),
      _AlphaB: material.getFloat('_AlphaB'),
    });
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
    console.log('Controller stage:', controller.mainStage);
    // eslint-disable-next-line no-console
    console.log('Textures array:', controller.textures);

    if (material) {
      // eslint-disable-next-line no-console
      // 调试输出材质参数
      if (DEBUG) {
        console.log('Material uniforms:', {
          _OffsetA: material?.getFloat('_OffsetA')?.toFixed(2),
          _AlphaA: material?.getFloat('_AlphaA')?.toFixed(2),
          _OffsetB: material?.getFloat('_OffsetB')?.toFixed(2),
          _AlphaB: material?.getFloat('_AlphaB')?.toFixed(2),
        });
      }
      if (controller.textures.length > 0) {
        const texA = controller.textures[0];

        shaderParams._OffsetA = texA.x;
        shaderParams._AlphaA = texA.alpha;
        if (material) {
          console.log(`Setting params: _OffsetA=${texA.x}, _AlphaA=${texA.alpha.toFixed(2)}`);
          material.setFloat('_OffsetA', texA.x);
          material.setFloat('_AlphaA', texA.alpha);
          console.log(`After set: _OffsetA=${material?.getFloat('_OffsetA')?.toFixed(2)}, _AlphaA=${material?.getFloat('_AlphaA')?.toFixed(2)}`);
        }
      }

      if (controller.textures.length > 1) {
        const texB = controller.textures[1];

        shaderParams._OffsetB = texB.x;
        shaderParams._AlphaB = texB.alpha;
        if (material) {
          console.log(`Setting params: _OffsetB=${texB.x}, _AlphaB=${texB.alpha.toFixed(2)}`);
          material.setFloat('_OffsetB', texB.x);
          material.setFloat('_AlphaB', texB.alpha);
          console.log(`After set: _OffsetB=${material?.getFloat('_OffsetB')?.toFixed(2)}, _AlphaB=${material?.getFloat('_AlphaB')?.toFixed(2)}`);
        }
      }
    }

    // 调试信息
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('Material params:', {
        alphaA: shaderParams._AlphaA.toFixed(2),
        alphaB: shaderParams._AlphaB.toFixed(2),
        offsetA: shaderParams._OffsetA.toFixed(2),
        offsetB: shaderParams._OffsetB.toFixed(2),
      });
    }
    requestAnimationFrame(updateLoop);
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
