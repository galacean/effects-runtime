import type { FancyConfig } from './fancy-text/fancy-types';
import { BUILTIN_FANCY_PRESETS } from './fancy-text/fancy-presets';

/** 仅供 demo/editor 根据当前层参数生成控件的临时参数描述，不写入 FancyConfig。 */
export interface PresetParameterMeta {
  path: string,
  label: string,
  type: 'color' | 'number' | 'angle' | 'select',
  min?: number,
  max?: number,
  step?: number,
  options?: { label: string, value: unknown }[],
  group?: string,
}

export interface PresetParameter extends PresetParameterMeta {
  value: unknown,
}

/**
 * 花字预设管理器
 *
 * 提供预设注册、JSON 深拷贝和路径修改等能力。
 * 参数控件描述由当前配置临时推导，不属于 FancyConfig，也不会参与序列化。
 * 所有静态方法均为纯函数式设计，不依赖上下文状态。
 */
export class PresetManager {

  /** 自定义预设注册表 */
  private static customPresets = new Map<string, FancyConfig>();

  // ========== 预设注册 ==========

  /**
   * 获取所有内置预设（深拷贝）
   */
  static getBuiltinPresets (): Record<string, FancyConfig> {
    const result: Record<string, FancyConfig> = {};
    const keys = Object.keys(BUILTIN_FANCY_PRESETS);

    for (let i = 0; i < keys.length; i++) {
      const name = keys[i];
      const config = BUILTIN_FANCY_PRESETS[name];

      result[name] = PresetManager.deepClone(config);
    }

    return result;
  }

  /**
   * 按名称获取预设（优先自定义，回退内置），返回深拷贝
   */
  static getPreset (name: string): FancyConfig | undefined {
    if (PresetManager.customPresets.has(name)) {
      return PresetManager.deepClone(PresetManager.customPresets.get(name)!);
    }

    const builtin = BUILTIN_FANCY_PRESETS[name];

    if (builtin) {
      return PresetManager.deepClone(builtin);
    }

    return undefined;
  }

  /**
   * 注册自定义预设（同名覆盖）
   */
  static registerPreset (name: string, config: FancyConfig): void {
    PresetManager.customPresets.set(name, PresetManager.deepClone(config));
  }

  /**
   * 移除自定义预设
   */
  static unregisterPreset (name: string): void {
    PresetManager.customPresets.delete(name);
  }

  /**
   * 清除所有自定义预设（主要用于测试）
   */
  static clearCustomPresets (): void {
    PresetManager.customPresets.clear();
  }

  // ========== 序列化/反序列化 ==========

  /**
   * 序列化 FancyConfig 为纯 JSON 兼容对象
   * 去除 undefined 属性，确保 JSON.stringify 安全
   */
  static serializeConfig (config: FancyConfig): Record<string, unknown> {
    return JSON.parse(JSON.stringify(config));
  }

  /** 反序列化 JSON 对象为 FancyConfig，不做版本迁移或额外补字段。 */
  static deserializeConfig (data: Record<string, unknown>): FancyConfig {
    return PresetManager.deepClone(data as unknown as FancyConfig);
  }

  // ========== 调参接口 ==========

  /**
   * 提取可调参数列表
   *
   * 根据当前 layers 临时推断参数，不读取或写入 FancyConfig 的额外字段。
   */
  static getAdjustableParams (config: FancyConfig): PresetParameter[] {
    return PresetManager.inferAdjustableParams(config);
  }

  /**
   * 按点号路径修改参数，返回新的 FancyConfig（不可变）
   *
   * 路径示例：
   * - 'layers.0.params.color' → config.layers[0].params.color
   * - 'layers.0.decorations.1.params.blur' → config.layers[0].decorations[1].params.blur
   */
  static updateParamByPath (config: FancyConfig, path: string, value: unknown): FancyConfig {
    const result = PresetManager.deepClone(config);
    const segments = path.split('.');
    const lastKey = segments.pop();

    if (!lastKey) {
      console.warn(`[PresetManager] updateParamByPath: invalid path "${path}"`);

      return result;
    }

    let target: Record<string, unknown> = result as unknown as Record<string, unknown>;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const next = target[seg];

      if (next === undefined || next === null) {
        console.warn(`[PresetManager] updateParamByPath: path segment "${seg}" not found at "${path}"`);

        return result;
      }

      // 数组索引访问
      if (Array.isArray(next) && /^\d+$/.test(seg)) {
        // 当前段虽然是数组索引，但 target 已经通过 Record 访问拿到了数组元素
        // 继续走 Record 访问逻辑
      }

      target = next as Record<string, unknown>;
    }

    if (!(lastKey in target)) {
      console.warn(`[PresetManager] updateParamByPath: property "${lastKey}" not found at "${path}"`);

      return result;
    }

    target[lastKey] = value;

    return result;
  }

  // ========== 内部工具方法 ==========

  /**
   * 启发式推断可调参数
   * 扫描 layers 中的参数，按语义自动推断类型和范围
   */
  private static inferAdjustableParams (config: FancyConfig): PresetParameter[] {
    const params: PresetParameter[] = [];

    const layers = config.layers ?? [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const layerPrefix = `layers.${i}`;
      const groupLabel = PresetManager.getLayerGroupLabel(layer.kind);

      // 处理 params 下的属性
      const paramsObj = layer.params as Record<string, unknown>;
      const paramKeys = Object.keys(paramsObj);

      for (let k = 0; k < paramKeys.length; k++) {
        const key = paramKeys[k];
        const value = paramsObj[key];

        if (key === 'pattern') {
          // 纹理 pattern 不作为可调参数
          continue;
        }

        const paramPath = `${layerPrefix}.params.${key}`;
        const meta = PresetManager.inferParamMeta(key, value, paramPath, groupLabel);

        if (meta) {
          params.push({ ...meta, value });
        }
      }

      // 处理 decorations 下的属性
      if (layer.decorations?.length) {
        for (let j = 0; j < layer.decorations.length; j++) {
          const dec = layer.decorations[j];
          const decPrefix = `${layerPrefix}.decorations.${j}`;
          const decGroupLabel = dec.kind === 'glow' ? '发光' : '阴影';
          const decParams = dec.params as Record<string, unknown>;
          const decParamKeys = Object.keys(decParams);

          for (let k = 0; k < decParamKeys.length; k++) {
            const key = decParamKeys[k];
            const value = decParams[key];
            const paramPath = `${decPrefix}.params.${key}`;
            const meta = PresetManager.inferParamMeta(key, value, paramPath, decGroupLabel);

            if (meta) {
              params.push({ ...meta, value });
            }
          }
        }
      }
    }

    return params;
  }

  /**
   * 根据属性名和值推断参数元信息
   */
  private static inferParamMeta (
    key: string,
    value: unknown,
    path: string,
    group: string,
  ): PresetParameterMeta | null {
    // 颜色属性：名为 color 且为长度≥3的数组
    if (key === 'color' && Array.isArray(value) && value.length >= 3) {
      return { path, label: `${group}颜色`, type: 'color', group };
    }

    // 渐变色数组：名为 colors 且为嵌套数组
    if (key === 'colors' && Array.isArray(value)) {
      // colors 数组整体不作为单个控件。
      return null;
    }

    // 角度属性
    if (key === 'angle') {
      return { path, label: `${group}角度`, type: 'angle', min: 0, max: 360, step: 1, group };
    }

    // 描边宽度
    if (key === 'width') {
      return { path, label: `${group}宽度`, type: 'number', min: 1, max: 25, step: 0.5, group };
    }

    // 模糊值
    if (key === 'blur') {
      return { path, label: `${group}模糊`, type: 'number', min: 0, max: 40, step: 1, group };
    }

    // 发光强度
    if (key === 'intensity') {
      return { path, label: `${group}强度`, type: 'number', min: 1, max: 10, step: 1, group };
    }

    // 偏移量
    if (key === 'offsetX') {
      return { path, label: `${group}水平偏移`, type: 'number', min: -30, max: 30, step: 1, group };
    }

    if (key === 'offsetY') {
      return { path, label: `${group}垂直偏移`, type: 'number', min: -30, max: 30, step: 1, group };
    }

    // 透明度
    if (key === 'opacity') {
      return { path, label: `${group}透明度`, type: 'number', min: 0, max: 1, step: 0.1, group };
    }

    return null;
  }

  /**
   * 根据层 kind 获取 UI 分组标签
   */
  private static getLayerGroupLabel (kind: string): string {
    switch (kind) {
      case 'single-stroke': return '描边';
      case 'solid-fill': return '填充';
      case 'gradient': return '填充';
      case 'texture': return '填充';
      case 'shadow': return '阴影';
      case 'glow': return '发光';
      default: return '其他';
    }
  }

  /**
   * 深拷贝（FancyConfig 为纯数据树，无循环引用）
   */
  private static deepClone<T> (obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
