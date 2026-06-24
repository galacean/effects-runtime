import { BUILTIN_FANCY_PRESETS } from '@galacean/effects-core';
import type { FancyConfig } from '@galacean/effects-core';

/**
 * Demo 花字预设配置集合
 * 统一从 effects-core 的内置预设库导入，不再独立维护
 */
export const demoFancyJsonConfigs: Record<string, FancyConfig> = BUILTIN_FANCY_PRESETS;

/**
 * 获取指定名称的花字预设配置
 * @param name - 预设名称
 * @returns 对应的花字配置
 */
export function getDemoFancyJsonConfig (name: string): FancyConfig {
  return demoFancyJsonConfigs[name] || demoFancyJsonConfigs['none'];
}