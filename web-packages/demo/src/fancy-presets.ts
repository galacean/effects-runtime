import type { FancyConfig } from '@galacean/effects-core';

/**
 * Demo 花字预设配置集合
 * 这些配置展示了各种花字层的组合方式
 */
export const demoFancyJsonConfigs: Record<string, FancyConfig> = {
  none: { layers: [] },
  'single-stroke': {
    layers: [
      { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
      { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
    ],
  },
  'multi-stroke': {
    layers: [
      { kind: 'single-stroke', params: { width: 15, color: [0.75, 0.28, 0.77, 1] } },
      { kind: 'single-stroke', params: { width: 12, color: [0.44, 0.34, 0.81, 1] } },
      { kind: 'single-stroke', params: { width: 9, color: [0.52, 0.89, 0.19, 1] } },
      { kind: 'single-stroke', params: { width: 6, color: [1, 0.52, 0.36, 1] } },
      { kind: 'single-stroke', params: { width: 3, color: [0.99, 0.19, 0.51, 1] } },
      { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
    ],
  },
  gradient: {
    layers: [
      {
        kind: 'single-stroke',
        params: {
          width: 3,
          color: [0, 0, 0, 1],
        },
        decorations: [
          {
            kind: 'shadow',
            params: {
              color: [0, 0, 0, 0.6],
              blur: 8,
              offsetX: 4,
              offsetY: 4,
            },
          },
        ],
      },
      {
        kind: 'gradient',
        params: {
          colors: [
            [1, 0, 0, 1],
            [0, 0, 1, 1],
          ],
          angle: 0,
        },
      },
    ],
  },
  shadow: {
    layers: [
      {
        kind: 'solid-fill',
        params: {
          color: [0, 0, 0, 1],
        },
        decorations: [
          {
            kind: 'shadow',
            params: {
              color: [0, 0, 0, 0.8],
              blur: 10,
              offsetX: 5,
              offsetY: 5,
            },
          },
        ],
      },
    ],
  },
  texture: {
    layers: [
      {
        kind: 'texture',
        params: {
          pattern: {
            imageUrl: 'https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ',
          },
        },
      },
    ],
  },
};

/**
 * 获取指定名称的花字预设配置
 * @param name - 预设名称
 * @returns 对应的花字配置
 */
export function getDemoFancyJsonConfig (name: string): FancyConfig {
  return demoFancyJsonConfigs[name] || demoFancyJsonConfigs['none'];
}
