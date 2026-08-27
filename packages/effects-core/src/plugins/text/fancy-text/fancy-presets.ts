import type { FancyConfig } from './fancy-types';

// ========== 基础预设（Demo 原有 7 种） ==========

/** 空预设，无花字层 */
export const NONE_PRESET: FancyConfig = { layers: [] };

/** 单描边 + 纯色填充 */
export const SINGLE_STROKE_PRESET: FancyConfig = {
  layers: [
    { kind: 'single-stroke', category: 'base', params: { width: 3, color: [1, 0, 0, 1] } },
    { kind: 'solid-fill', category: 'base', params: { color: [1, 1, 1, 1] } },
  ],
};

/** 多层彩虹描边 + 纯色填充 */
export const MULTI_STROKE_PRESET: FancyConfig = {
  layers: [
    { kind: 'single-stroke', category: 'base', params: { width: 15, color: [0.75, 0.28, 0.77, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 12, color: [0.44, 0.34, 0.81, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 9, color: [0.52, 0.89, 0.19, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 6, color: [1, 0.52, 0.36, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 3, color: [0.99, 0.19, 0.51, 1] } },
    { kind: 'solid-fill', category: 'base', params: { color: [1, 1, 1, 1] } },
  ],
};

/** 描边 + 阴影装饰 + 渐变填充 */
export const GRADIENT_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 3, color: [0, 0, 0, 1] },
      decorations: [{ kind: 'shadow', category: 'decorative', params: { color: [0, 0, 0, 0.6], blur: 8, offsetX: 4, offsetY: 4 } }],
    },
    { kind: 'gradient', category: 'base', params: { colors: [[1, 0, 0, 1], [0, 0, 1, 1]], angle: 0 } },
  ],
};

/** 纯色填充 + 阴影装饰 */
export const SHADOW_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'solid-fill',
      category: 'base',
      params: { color: [0, 0, 0, 1] },
      decorations: [{ kind: 'shadow', category: 'decorative', params: { color: [0, 0, 0, 0.8], blur: 10, offsetX: 5, offsetY: 5 } }],
    },
  ],
};

/** 纹理填充 */
export const TEXTURE_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'texture',
      category: 'base',
      params: {
        pattern: {
          imageUrl: 'https://gw.alipayobjects.com/mdn/rms_2e421e/afts/img/A*fRtNTKrsq3YAAAAAAAAAAAAAARQnAQ',
        },
      },
    },
  ],
};

/** 纯色填充 + 发光装饰 */
export const GLOW_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'solid-fill',
      category: 'base',
      params: { color: [1, 1, 1, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [0, 0.8, 1, 1], blur: 12, intensity: 3 } }],
    },
  ],
};

// ========== 示例预设（原 text-style.ts 3 种，已更新为 glow 装饰层） ==========

/** 示例：外发光 + 多重描边 + 渐变填充 */
export const GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 8, color: [0.1, 0.1, 0.1, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [0.3, 0.6, 1, 0.8], blur: 15, intensity: 2 } }],
    },
    { kind: 'single-stroke', category: 'base', params: { width: 5, color: [0.3, 0.3, 0.3, 1] } },
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 2, color: [0.6, 0.6, 0.6, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [1, 0.9, 0.5, 0.6], blur: 5, intensity: 1 } }],
    },
    { kind: 'gradient', category: 'base', params: { colors: [[1, 0.2, 0.5, 1], [0.2, 0.5, 1, 1], [0.3, 1, 0.4, 1]], angle: 45 } },
  ],
};

/** 示例：金属质感效果 */
export const METALLIC_SAMPLE: FancyConfig = {
  layers: [
    { kind: 'gradient', category: 'base', params: { colors: [[0.9, 0.9, 0.9, 1], [0.7, 0.7, 0.7, 1], [0.9, 0.9, 0.9, 1], [0.6, 0.6, 0.6, 1]], angle: 0 } },
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 3, color: [0.3, 0.3, 0.3, 1] },
      decorations: [{ kind: 'shadow', category: 'decorative', params: { color: [1, 1, 1, 0.4], blur: 2, offsetX: 0, offsetY: -2 } }],
    },
  ],
};

/** 示例：霓虹灯效果 */
export const NEON_SAMPLE: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 4, color: [0, 0.8, 0.8, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [0, 1, 1, 0.8], blur: 20, intensity: 2 } }],
    },
    { kind: 'single-stroke', category: 'base', params: { width: 2, color: [1, 1, 1, 1] } },
    { kind: 'solid-fill', category: 'base', params: { color: [0, 0.6, 0.6, 1] } },
  ],
};

// ========== 新增预设（4 种） ==========

/** 彩虹效果：多层光谱描边 + 全光谱渐变填充 */
export const RAINBOW_PRESET: FancyConfig = {
  layers: [
    { kind: 'single-stroke', category: 'base', params: { width: 15, color: [1, 0, 0, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 12, color: [1, 1, 0, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 9, color: [0, 1, 0, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 6, color: [0, 1, 1, 1] } },
    { kind: 'single-stroke', category: 'base', params: { width: 3, color: [0, 0.5, 1, 1] } },
    {
      kind: 'gradient',
      category: 'base',
      params: {
        colors: [
          [1, 0, 0, 1], [1, 0.5, 0, 1], [1, 1, 0, 1], [0, 1, 0, 1],
          [0, 1, 1, 1], [0, 0.5, 1, 1], [0.5, 0, 1, 1],
        ],
        angle: 0,
      },
    },
  ],
};

/** 冰霜效果：冰蓝描边 + glow 装饰 + 冰蓝渐变填充 */
export const FROST_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 6, color: [0.4, 0.6, 0.9, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [0.6, 0.85, 1, 0.7], blur: 12, intensity: 2 } }],
    },
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 3, color: [0.85, 0.92, 1, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [0.7, 0.9, 1, 0.5], blur: 6, intensity: 1 } }],
    },
    { kind: 'gradient', category: 'base', params: { colors: [[0.9, 0.95, 1, 1], [0.6, 0.8, 0.95, 1]], angle: 180 } },
  ],
};

/** 火焰效果：火焰色描边 + glow 装饰 + 火焰渐变填充 */
export const FLAME_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 10, color: [0.6, 0.05, 0, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [1, 0.3, 0, 0.6], blur: 15, intensity: 2 } }],
    },
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 7, color: [1, 0.3, 0, 1] },
      decorations: [{ kind: 'glow', category: 'decorative', params: { color: [1, 0.5, 0, 0.4], blur: 8, intensity: 1 } }],
    },
    { kind: 'single-stroke', category: 'base', params: { width: 3, color: [1, 0.7, 0, 1] } },
    { kind: 'gradient', category: 'base', params: { colors: [[1, 0.9, 0.2, 1], [1, 0.4, 0, 1], [0.7, 0.1, 0, 1]], angle: 90 } },
  ],
};

/** 立体效果：多层 shadow + 描边 + 顶部高光纯色填充 */
export const STEREO_PRESET: FancyConfig = {
  layers: [
    {
      kind: 'single-stroke',
      category: 'base',
      params: { width: 5, color: [0.2, 0.2, 0.2, 1] },
      decorations: [
        { kind: 'shadow', category: 'decorative', params: { color: [0, 0, 0, 0.6], blur: 2, offsetX: 3, offsetY: 3 } },
        { kind: 'shadow', category: 'decorative', params: { color: [0, 0, 0, 0.3], blur: 8, offsetX: 6, offsetY: 6 } },
      ],
    },
    { kind: 'single-stroke', category: 'base', params: { width: 2, color: [0.4, 0.4, 0.4, 1] } },
    {
      kind: 'solid-fill',
      category: 'base',
      params: { color: [0.9, 0.9, 0.9, 1] },
      decorations: [{ kind: 'shadow', category: 'decorative', params: { color: [1, 1, 1, 0.3], blur: 1, offsetX: 0, offsetY: -2 } }],
    },
  ],
};

// ========== 内置预设汇总表 ==========

/**
 * 获取所有内置花字预设
 * 返回的每个 FancyConfig 均为深拷贝，调用方可安全修改
 */
export const BUILTIN_FANCY_PRESETS: Record<string, FancyConfig> = {
  'none': NONE_PRESET,
  'single-stroke': SINGLE_STROKE_PRESET,
  'multi-stroke': MULTI_STROKE_PRESET,
  'gradient': GRADIENT_PRESET,
  'shadow': SHADOW_PRESET,
  'texture': TEXTURE_PRESET,
  'glow': GLOW_PRESET,
  'neon': NEON_SAMPLE,
  'metallic': METALLIC_SAMPLE,
  'glow-stroke-gradient': GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE,
  'rainbow': RAINBOW_PRESET,
  'frost': FROST_PRESET,
  'flame': FLAME_PRESET,
  'stereo': STEREO_PRESET,
};
