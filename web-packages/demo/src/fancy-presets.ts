import type { FancyConfigJSON } from '@galacean/effects-core';

export const demoFancyJsonConfigs: Record<string, FancyConfigJSON> = {
  none: {
    effects: [
      // 空数组，表示"没有额外 JSON 配置"
    ],
  },
  'single-stroke': {
    effects: [
      { type: 'single-stroke', width: 3, color: [1, 0, 0, 1] },
      { type: 'solid-fill', color: [1, 1, 1, 1] },
    ],
  },
  'multi-stroke': {
    effects: [
      { type: 'single-stroke', width: 15, color: [0.75, 0.28, 0.77, 1] },
      { type: 'single-stroke', width: 12, color: [0.44, 0.34, 0.81, 1] },
      { type: 'single-stroke', width: 9, color: [0.52, 0.89, 0.19, 1] },
      { type: 'single-stroke', width: 6, color: [1, 0.52, 0.36, 1] },
      { type: 'single-stroke', width: 3, color: [0.99, 0.19, 0.51, 1] },
      { type: 'solid-fill', color: [1, 1, 1, 1] },
    ],
  },
  gradient: {
    effects: [
      {
        type: 'shadow',
        color: [0, 0, 0, 0.6],
        blur: 8,
        offsetX: 4,
        offsetY: 4,
      },
      {
        type: 'single-stroke',
        width: 3,
        color: [0, 0, 0, 1],
      },
      {
        type: 'gradient',
        colors: [
          [1, 0, 0, 1],
          [0, 0, 1, 1],
        ],
        angle: 0,
      },
    ],
  },
  shadow: {
    effects: [
      {
        type: 'shadow',
        color: [0, 0, 0, 0.8],
        blur: 10,
        offsetX: 5,
        offsetY: 5,
      },
      {
        type: 'solid-fill',
        color: [0, 0, 0, 1],
      },

    ],
  },
  texture: {
    effects: [
      {
        type: 'texture',
        imageUrl: 'https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ',
      },
    ],
  },
};

export function getDemoFancyJsonConfig (name: string): FancyConfigJSON {
  return demoFancyJsonConfigs[name] || demoFancyJsonConfigs['none'];
}
