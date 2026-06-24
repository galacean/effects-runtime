import type { FancyConfig } from './fancy-types';

// ========== 基础预设（Demo 原有 7 种） ==========

/** 空预设，无花字层 */
export const NONE_PRESET: FancyConfig = { layers: [], presetName: 'none' };

/** 单描边 + 纯色填充 */
export const SINGLE_STROKE_PRESET: FancyConfig = {
  presetName: 'single-stroke',
  layers: [
    { kind: 'single-stroke', params: { width: 3, color: [1, 0, 0, 1] } },
    { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '描边颜色', type: 'color', group: '描边' },
    { path: 'layers.0.params.width', label: '描边宽度', type: 'number', min: 1, max: 20, step: 0.5, group: '描边' },
    { path: 'layers.1.params.color', label: '填充颜色', type: 'color', group: '填充' },
  ],
};

/** 多层彩虹描边 + 纯色填充 */
export const MULTI_STROKE_PRESET: FancyConfig = {
  presetName: 'multi-stroke',
  layers: [
    { kind: 'single-stroke', params: { width: 15, color: [0.75, 0.28, 0.77, 1] } },
    { kind: 'single-stroke', params: { width: 12, color: [0.44, 0.34, 0.81, 1] } },
    { kind: 'single-stroke', params: { width: 9, color: [0.52, 0.89, 0.19, 1] } },
    { kind: 'single-stroke', params: { width: 6, color: [1, 0.52, 0.36, 1] } },
    { kind: 'single-stroke', params: { width: 3, color: [0.99, 0.19, 0.51, 1] } },
    { kind: 'solid-fill', params: { color: [1, 1, 1, 1] } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '外描边颜色', type: 'color', group: '描边' },
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 5, max: 25, step: 1, group: '描边' },
    { path: 'layers.5.params.color', label: '填充颜色', type: 'color', group: '填充' },
  ],
};

/** 描边 + 阴影装饰 + 渐变填充 */
export const GRADIENT_PRESET: FancyConfig = {
  presetName: 'gradient',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 3, color: [0, 0, 0, 1] },
      decorations: [{ kind: 'shadow', params: { color: [0, 0, 0, 0.6], blur: 8, offsetX: 4, offsetY: 4 } }],
    },
    { kind: 'gradient', params: { colors: [[1, 0, 0, 1], [0, 0, 1, 1]], angle: 0 } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '描边颜色', type: 'color', group: '描边' },
    { path: 'layers.0.params.width', label: '描边宽度', type: 'number', min: 1, max: 15, step: 0.5, group: '描边' },
    { path: 'layers.0.decorations.0.params.color', label: '阴影颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '阴影模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
    { path: 'layers.1.params.colors.0', label: '渐变起始色', type: 'color', group: '填充' },
    { path: 'layers.1.params.colors.1', label: '渐变终止色', type: 'color', group: '填充' },
    { path: 'layers.1.params.angle', label: '渐变角度', type: 'angle', min: 0, max: 360, step: 1, group: '填充' },
  ],
};

/** 纯色填充 + 阴影装饰 */
export const SHADOW_PRESET: FancyConfig = {
  presetName: 'shadow',
  layers: [
    {
      kind: 'solid-fill',
      params: { color: [0, 0, 0, 1] },
      decorations: [{ kind: 'shadow', params: { color: [0, 0, 0, 0.8], blur: 10, offsetX: 5, offsetY: 5 } }],
    },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '填充颜色', type: 'color', group: '填充' },
    { path: 'layers.0.decorations.0.params.color', label: '阴影颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '阴影模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
  ],
};

/** 纹理填充 */
export const TEXTURE_PRESET: FancyConfig = {
  presetName: 'texture',
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
  adjustableParams: [
    { path: 'layers.0.params.opacity', label: '透明度', type: 'number', min: 0, max: 1, step: 0.1, group: '填充' },
  ],
};

/** 纯色填充 + 发光装饰 */
export const GLOW_PRESET: FancyConfig = {
  presetName: 'glow',
  layers: [
    {
      kind: 'solid-fill',
      params: { color: [1, 1, 1, 1] },
      decorations: [{ kind: 'glow', params: { color: [0, 0.8, 1, 1], blur: 12, intensity: 3 } }],
    },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '填充颜色', type: 'color', group: '填充' },
    { path: 'layers.0.decorations.0.params.color', label: '发光颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '发光模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
    { path: 'layers.0.decorations.0.params.intensity', label: '发光强度', type: 'number', min: 1, max: 10, step: 1, group: '效果' },
  ],
};

// ========== 示例预设（原 text-style.ts 3 种，已更新为 glow 装饰层） ==========

/** 示例：外发光 + 多重描边 + 渐变填充 */
export const GLOW_WITH_STROKE_AND_GRADIENT_SAMPLE: FancyConfig = {
  presetName: 'glow-stroke-gradient',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 8, color: [0.1, 0.1, 0.1, 1] },
      decorations: [{ kind: 'glow', params: { color: [0.3, 0.6, 1, 0.8], blur: 15, intensity: 2 } }],
    },
    { kind: 'single-stroke', params: { width: 5, color: [0.3, 0.3, 0.3, 1] } },
    {
      kind: 'single-stroke',
      params: { width: 2, color: [0.6, 0.6, 0.6, 1] },
      decorations: [{ kind: 'glow', params: { color: [1, 0.9, 0.5, 0.6], blur: 5, intensity: 1 } }],
    },
    { kind: 'gradient', params: { colors: [[1, 0.2, 0.5, 1], [0.2, 0.5, 1, 1], [0.3, 1, 0.4, 1]], angle: 45 } },
  ],
  adjustableParams: [
    { path: 'layers.0.decorations.0.params.color', label: '外发光颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '外发光模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 1, max: 15, step: 0.5, group: '描边' },
    { path: 'layers.3.params.colors.0', label: '渐变色1', type: 'color', group: '填充' },
    { path: 'layers.3.params.colors.1', label: '渐变色2', type: 'color', group: '填充' },
    { path: 'layers.3.params.colors.2', label: '渐变色3', type: 'color', group: '填充' },
  ],
};

/** 示例：金属质感效果 */
export const METALLIC_SAMPLE: FancyConfig = {
  presetName: 'metallic',
  layers: [
    { kind: 'gradient', params: { colors: [[0.9, 0.9, 0.9, 1], [0.7, 0.7, 0.7, 1], [0.9, 0.9, 0.9, 1], [0.6, 0.6, 0.6, 1]], angle: 0 } },
    {
      kind: 'single-stroke',
      params: { width: 3, color: [0.3, 0.3, 0.3, 1] },
      decorations: [{ kind: 'shadow', params: { color: [1, 1, 1, 0.4], blur: 2, offsetX: 0, offsetY: -2 } }],
    },
  ],
  adjustableParams: [
    { path: 'layers.0.params.colors.0', label: '渐变高光', type: 'color', group: '填充' },
    { path: 'layers.0.params.colors.3', label: '渐变暗部', type: 'color', group: '填充' },
    { path: 'layers.0.params.angle', label: '渐变角度', type: 'angle', min: 0, max: 360, step: 1, group: '填充' },
    { path: 'layers.1.params.color', label: '描边颜色', type: 'color', group: '描边' },
    { path: 'layers.1.decorations.0.params.color', label: '高光线颜色', type: 'color', group: '效果' },
  ],
};

/** 示例：霓虹灯效果 */
export const NEON_SAMPLE: FancyConfig = {
  presetName: 'neon',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 4, color: [0, 0.8, 0.8, 1] },
      decorations: [{ kind: 'glow', params: { color: [0, 1, 1, 0.8], blur: 20, intensity: 2 } }],
    },
    { kind: 'single-stroke', params: { width: 2, color: [1, 1, 1, 1] } },
    { kind: 'solid-fill', params: { color: [0, 0.6, 0.6, 1] } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '管壁颜色', type: 'color', group: '描边' },
    { path: 'layers.0.decorations.0.params.color', label: '发光颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '发光模糊', type: 'number', min: 0, max: 40, step: 1, group: '效果' },
    { path: 'layers.0.decorations.0.params.intensity', label: '发光强度', type: 'number', min: 1, max: 5, step: 1, group: '效果' },
    { path: 'layers.2.params.color', label: '管内填充色', type: 'color', group: '填充' },
  ],
};

// ========== 新增预设（4 种） ==========

/** 彩虹效果：多层光谱描边 + 全光谱渐变填充 */
export const RAINBOW_PRESET: FancyConfig = {
  presetName: 'rainbow',
  layers: [
    { kind: 'single-stroke', params: { width: 15, color: [1, 0, 0, 1] } },
    { kind: 'single-stroke', params: { width: 12, color: [1, 1, 0, 1] } },
    { kind: 'single-stroke', params: { width: 9, color: [0, 1, 0, 1] } },
    { kind: 'single-stroke', params: { width: 6, color: [0, 1, 1, 1] } },
    { kind: 'single-stroke', params: { width: 3, color: [0, 0.5, 1, 1] } },
    {
      kind: 'gradient',
      params: {
        colors: [
          [1, 0, 0, 1], [1, 0.5, 0, 1], [1, 1, 0, 1], [0, 1, 0, 1],
          [0, 1, 1, 1], [0, 0.5, 1, 1], [0.5, 0, 1, 1],
        ],
        angle: 0,
      },
    },
  ],
  adjustableParams: [
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 5, max: 25, step: 1, group: '描边' },
    { path: 'layers.0.params.color', label: '最外层颜色', type: 'color', group: '描边' },
    { path: 'layers.5.params.angle', label: '渐变角度', type: 'angle', min: 0, max: 360, step: 1, group: '填充' },
  ],
};

/** 冰霜效果：冰蓝描边 + glow 装饰 + 冰蓝渐变填充 */
export const FROST_PRESET: FancyConfig = {
  presetName: 'frost',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 6, color: [0.4, 0.6, 0.9, 1] },
      decorations: [{ kind: 'glow', params: { color: [0.6, 0.85, 1, 0.7], blur: 12, intensity: 2 } }],
    },
    {
      kind: 'single-stroke',
      params: { width: 3, color: [0.85, 0.92, 1, 1] },
      decorations: [{ kind: 'glow', params: { color: [0.7, 0.9, 1, 0.5], blur: 6, intensity: 1 } }],
    },
    { kind: 'gradient', params: { colors: [[0.9, 0.95, 1, 1], [0.6, 0.8, 0.95, 1]], angle: 180 } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '外描边颜色', type: 'color', group: '描边' },
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 1, max: 15, step: 0.5, group: '描边' },
    { path: 'layers.0.decorations.0.params.color', label: '外发光颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '外发光模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
    { path: 'layers.0.decorations.0.params.intensity', label: '外发光强度', type: 'number', min: 1, max: 5, step: 1, group: '效果' },
    { path: 'layers.2.params.colors.0', label: '渐变亮部', type: 'color', group: '填充' },
    { path: 'layers.2.params.colors.1', label: '渐变暗部', type: 'color', group: '填充' },
  ],
};

/** 火焰效果：火焰色描边 + glow 装饰 + 火焰渐变填充 */
export const FLAME_PRESET: FancyConfig = {
  presetName: 'flame',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 10, color: [0.6, 0.05, 0, 1] },
      decorations: [{ kind: 'glow', params: { color: [1, 0.3, 0, 0.6], blur: 15, intensity: 2 } }],
    },
    {
      kind: 'single-stroke',
      params: { width: 7, color: [1, 0.3, 0, 1] },
      decorations: [{ kind: 'glow', params: { color: [1, 0.5, 0, 0.4], blur: 8, intensity: 1 } }],
    },
    { kind: 'single-stroke', params: { width: 3, color: [1, 0.7, 0, 1] } },
    { kind: 'gradient', params: { colors: [[1, 0.9, 0.2, 1], [1, 0.4, 0, 1], [0.7, 0.1, 0, 1]], angle: 90 } },
  ],
  adjustableParams: [
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 5, max: 20, step: 1, group: '描边' },
    { path: 'layers.0.decorations.0.params.color', label: '外发光颜色', type: 'color', group: '效果' },
    { path: 'layers.0.decorations.0.params.blur', label: '外发光模糊', type: 'number', min: 0, max: 30, step: 1, group: '效果' },
    { path: 'layers.0.decorations.0.params.intensity', label: '外发光强度', type: 'number', min: 1, max: 5, step: 1, group: '效果' },
    { path: 'layers.3.params.colors.0', label: '渐变亮部', type: 'color', group: '填充' },
    { path: 'layers.3.params.colors.2', label: '渐变暗部', type: 'color', group: '填充' },
  ],
};

/** 立体效果：多层 shadow + 描边 + 顶部高光纯色填充 */
export const STEREO_PRESET: FancyConfig = {
  presetName: 'stereo',
  layers: [
    {
      kind: 'single-stroke',
      params: { width: 5, color: [0.2, 0.2, 0.2, 1] },
      decorations: [
        { kind: 'shadow', params: { color: [0, 0, 0, 0.6], blur: 2, offsetX: 3, offsetY: 3 } },
        { kind: 'shadow', params: { color: [0, 0, 0, 0.3], blur: 8, offsetX: 6, offsetY: 6 } },
      ],
    },
    { kind: 'single-stroke', params: { width: 2, color: [0.4, 0.4, 0.4, 1] } },
    {
      kind: 'solid-fill',
      params: { color: [0.9, 0.9, 0.9, 1] },
      decorations: [{ kind: 'shadow', params: { color: [1, 1, 1, 0.3], blur: 1, offsetX: 0, offsetY: -2 } }],
    },
  ],
  adjustableParams: [
    { path: 'layers.0.params.color', label: '外描边颜色', type: 'color', group: '描边' },
    { path: 'layers.0.params.width', label: '外描边宽度', type: 'number', min: 1, max: 15, step: 0.5, group: '描边' },
    { path: 'layers.0.decorations.0.params.blur', label: '主投影模糊', type: 'number', min: 0, max: 15, step: 1, group: '效果' },
    { path: 'layers.0.decorations.1.params.blur', label: '扩散投影模糊', type: 'number', min: 0, max: 20, step: 1, group: '效果' },
    { path: 'layers.2.params.color', label: '填充颜色', type: 'color', group: '填充' },
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