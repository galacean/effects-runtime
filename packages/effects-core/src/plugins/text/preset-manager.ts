import type { AdjustableParam, AdjustableParamMeta, FancyConfig } from './fancy-text/fancy-types';
import { BUILTIN_FANCY_PRESETS } from './fancy-text/fancy-presets';

/** 当前预设数据格式的版本号 */
const CURRENT_PRESET_VERSION = 1;

/**
 * 花字预设管理器
 *
 * 提供预设注册、序列化/反序列化、版本迁移、可调参数查询与路径修改等能力。
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

  /**
   * 反序列化 JSON 对象为 FancyConfig（带版本迁移）
   */
  static deserializeConfig (data: Record<string, unknown>): FancyConfig {
    const config = data as unknown as FancyConfig;

    return PresetManager.migrateConfig(config);
  }

  // ========== 版本迁移 ==========

  /**
   * 版本迁移：将任意版本的 FancyConfig 迁移到当前版本
   * 无 version 字段视为 v1
   */
  static migrateConfig (config: FancyConfig): FancyConfig {
    const result = PresetManager.deepClone(config);
    const fromVersion = result.version ?? 1;

    if (fromVersion < CURRENT_PRESET_VERSION) {
      // v1 → v_CURRENT 的迁移逻辑
      // 当前 CURRENT_PRESET_VERSION = 1，无实际迁移步骤
      // 后续版本升级在此处添加迁移逻辑，例如：
      // if (fromVersion < 2) { migrateV1ToV2(result); }
    }

    result.version = CURRENT_PRESET_VERSION;

    return result;
  }

  // ========== 调参接口 ==========

  /**
   * 提取可调参数列表
   *
   * 如果 FancyConfig 上有 adjustableParams 元信息，则按声明提取；
   * 否则使用启发式策略自动推断。
   */
  static getAdjustableParams (config: FancyConfig): AdjustableParam[] {
    if (config.adjustableParams?.length) {
      return config.adjustableParams.map(meta => {
        const value = PresetManager.getValueByPath(config as unknown as Record<string, unknown>, meta.path);

        return { ...meta, value };
      });
    }

    // 启发式策略：自动扫描参数
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
   * 按点号路径读取值
   */
  private static getValueByPath (obj: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = obj;

    for (const seg of segments) {
      if (current === undefined || current === null) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[seg];
    }

    return current;
  }

  /**
   * 启发式推断可调参数
   * 扫描 layers 中的参数，按语义自动推断类型和范围
   */
  private static inferAdjustableParams (config: FancyConfig): AdjustableParam[] {
    const params: AdjustableParam[] = [];

    for (let i = 0; i < config.layers.length; i++) {
      const layer = config.layers[i];
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
  ): AdjustableParamMeta | null {
    // 颜色属性：名为 color 且为长度≥3的数组
    if (key === 'color' && Array.isArray(value) && value.length >= 3) {
      return { path, label: `${group}颜色`, type: 'color', group };
    }

    // 渐变色数组：名为 colors 且为嵌套数组
    if (key === 'colors' && Array.isArray(value)) {
      // colors 数组整体不作为单个可调参数
      // 在 adjustableParams 中应逐色声明（如 layers.0.params.colors.0）
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