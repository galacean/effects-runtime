import type { FancyTextStyle } from './fancy-types';

/**
 * 花字预设配置
 */
export const _fancyTextConfigs: Record<string, FancyTextStyle> = {
  // 无特效
  'none': {
    effects: [
      {
        type: 'solid-fill',
        params: { color: [1, 1, 1, 1] },
      },
    ],
    editableParams: ['stroke', 'shadow', 'fill', 'curve'],
    enablePreset: false,
    presetName: 'none',
  },

  // 单描边
  'single-stroke': {
    effects: [
      {
        type: 'single-stroke',
        params: { width: 3, color: [1, 0, 0, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [1, 1, 1, 1] },
      },
    ],
    editableParams: ['stroke', 'shadow', 'fill', 'curve'],
    enablePreset: true,
    presetName: 'single-stroke',
  },

  // 多描边（通过效果栈实现）
  'multi-stroke': {
    effects: [
      {
        type: 'single-stroke',
        params: { width: 15, color: [0.75, 0.28, 0.77, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [0.75, 0.28, 0.77, 1] },
      },
      {
        type: 'single-stroke',
        params: { width: 12, color: [0.44, 0.34, 0.81, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [0.44, 0.34, 0.81, 1] },
      },
      {
        type: 'single-stroke',
        params: { width: 9, color: [0.52, 0.89, 0.19, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [0.52, 0.89, 0.19, 1] },
      },
      {
        type: 'single-stroke',
        params: { width: 6, color: [1, 0.52, 0.36, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [1, 0.52, 0.36, 1] },
      },
      {
        type: 'single-stroke',
        params: { width: 3, color: [0.99, 0.19, 0.51, 1] },
      },
      {
        type: 'solid-fill',
        params: { color: [1, 1, 1, 1] },
      },
    ],
    editableParams: ['shadow', 'fill', 'curve'],
    enablePreset: true,
    presetName: 'multi-stroke',
  },

  // 渐变
  'gradient': {
    effects: [
      {
        type: 'gradient',
        params: {
          colors: [
            [1, 0, 0, 1],
            [1, 1, 0, 1],
            [0, 1, 0, 1],
            [0, 1, 1, 1],
            [0, 0, 1, 1],
          ],
          angle: 90,
        },
      },
    ],
    editableParams: ['stroke', 'shadow', 'curve'],
    enablePreset: true,
    presetName: 'gradient',
  },

  // 阴影
  'shadow': {
    effects: [
      {
        type: 'shadow',
        params: {
          color: [0, 0, 0, 0.8],
          blur: 10,
          offsetX: 5,
          offsetY: 5,
        },
      },
      {
        type: 'solid-fill',
        params: { color: [1, 1, 1, 1] },
      },
    ],
    editableParams: ['stroke', 'shadow', 'fill', 'curve'],
    enablePreset: true,
    presetName: 'shadow',
  },

  // 纹理（需要在运行时设置pattern）
  'texture': {
    effects: [
      {
        type: 'texture',
        params: { pattern: null },
      },
    ],
    editableParams: ['stroke', 'shadow', 'curve'],
    enablePreset: true,
    presetName: 'texture',
  },
};

/**
 * 获取花字预设配置
 */
export function getFancyTextConfig (presetName: string): FancyTextStyle {
  return _fancyTextConfigs[presetName] || _fancyTextConfigs['none'];
}
