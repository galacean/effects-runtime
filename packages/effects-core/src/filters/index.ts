import type { FilterDefineFunc, FilterShaderFunc } from '../filter';
import { createDistortionShader, registerDistortionFilter } from './distortion';
import { createGaussianShader, registerGaussianFilter } from './gaussian';
import { createBloomShader, registerBloomFilter } from './bloom';
import { createDelayShader, registerDelayFilter } from './delay';
import { createAlphaFrameShader, registerAlphaFrameFilter } from './alpha-frame';
import { createAlphaMaskShader, registerAlphaMaskFilter } from './alpha-mask';
import { createCameraMoveShader, registerCameraMoveFilter } from './camera-move';
import { createLumShader, registerLumFilter } from './lum';

export const filters: Record<string, [x: FilterDefineFunc, y: FilterShaderFunc]> = {
  lum: [registerLumFilter, createLumShader],
  // 透明视频
  alphaFrame: [registerAlphaFrameFilter, createAlphaFrameShader],
  // 移动镜头
  cameraMove: [registerCameraMoveFilter, createCameraMoveShader],
  // 渐变滤镜
  alphaMask: [registerAlphaMaskFilter, createAlphaMaskShader],
  // 扭曲滤镜
  distortion: [registerDistortionFilter, createDistortionShader],
  // 发光
  bloom: [registerBloomFilter, createBloomShader],
  // 高斯模糊
  gaussian: [registerGaussianFilter, createGaussianShader],
  // 动作延迟
  delay: [registerDelayFilter, createDelayShader],
};
