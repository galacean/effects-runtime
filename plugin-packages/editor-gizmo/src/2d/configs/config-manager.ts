import { EventEmitter } from '@galacean/effects';
import { cloneConfigValue, freezeConfigValue, type AnyConfigDefinition, type ConfigChange, type ConfigValue } from './config-definition';

/** 任意配置项的一次变更。 */
export type AnyConfigChange = {
  /** 配置唯一标识。 */
  id: string,
  /** 本次接受的增量配置。 */
  partial: Readonly<Record<string, unknown>>,
  /** 变更前的完整配置。 */
  previous: Readonly<Record<string, unknown>>,
  /** 变更后的完整配置。 */
  current: Readonly<Record<string, unknown>>,
};

/** 配置管理器事件参数。 */
export type ConfigManagerEvents = {
  /** 任意配置变更事件。 */
  configChange: [AnyConfigChange],
};

/**
 * 深度比较两个配置值。
 * @param left 左侧配置值
 * @param right 右侧配置值
 * @returns 两个配置值是否相等
 */
function configEqual (left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => configEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightRecord = right as Record<string, unknown>;

  return leftKeys.length === Object.keys(rightRecord).length
    && leftKeys.every(key => configEqual(leftRecord[key], rightRecord[key]));
}

/**
 * 创建可安全存储的不可变配置副本。
 * @param value 原始配置值
 * @returns 冻结后的配置副本
 */
function createStoredValue<T> (value: T): T {
  return freezeConfigValue(cloneConfigValue(value));
}

/** 管理配置定义、当前值和变更订阅。 */
export class ConfigManager extends EventEmitter<ConfigManagerEvents> {
  private readonly values = new Map<string, Record<string, unknown>>();
  private readonly definitions = new Map<string, AnyConfigDefinition>();

  /**
   * 获取配置当前值，首次读取时使用默认值初始化。
   * @param definition 配置定义
   * @returns 当前不可变配置
   */
  get<D extends AnyConfigDefinition> (
    definition: D,
  ): Readonly<ConfigValue<D>> {
    this.assertDefinition(definition);
    let value = this.values.get(definition.id);

    if (!value) {
      value = createStoredValue(definition.defaults);
      this.values.set(definition.id, value);
    }

    return value as ConfigValue<D>;
  }

  /**
   * 合并并保存增量配置。
   * @param definition 配置定义
   * @param partial 待合并的增量配置
   */
  set<D extends AnyConfigDefinition> (
    definition: D,
    partial: Partial<ConfigValue<D>>,
  ): void {
    this.assertDefinition(definition);
    const previous = this.get(definition);
    const validated = definition.validate?.(partial);

    if (definition.validate && !validated) {
      return;
    }
    const accepted = validated ?? partial;
    const current = createStoredValue({ ...previous, ...accepted }) as ConfigValue<D>;

    if (configEqual(previous, current)) {
      return;
    }

    this.values.set(definition.id, current);
    const change = {
      id: definition.id,
      partial: createStoredValue(accepted),
      previous,
      current,
    };

    this.emit('configChange', change);
  }

  /**
   * 将配置恢复为默认值。
   * @param definition 配置定义
   */
  reset (definition: AnyConfigDefinition): void {
    this.assertDefinition(definition);
    const previous = this.get(definition);
    const current = createStoredValue(definition.defaults);

    if (configEqual(previous, current)) {
      return;
    }
    this.values.set(definition.id, current);
    const change = {
      id: definition.id,
      partial: {},
      previous,
      current,
    };

    this.emit('configChange', change);
  }

  /**
   * 订阅指定配置的变更。
   * @param definition 配置定义
   * @param listener 配置变更回调
   * @returns 取消订阅函数
   */
  onChange<D extends AnyConfigDefinition> (
    definition: D,
    listener: (change: ConfigChange<ConfigValue<D>>) => void,
  ): () => void {
    this.assertDefinition(definition);
    /** @param change 任意配置的变更事件。 */
    const handler = (change: AnyConfigChange) => {
      if (change.id === definition.id) {
        listener({
          partial: change.partial,
          previous: change.previous,
          current: change.current,
        } as ConfigChange<ConfigValue<D>>);
      }
    };

    return this.on('configChange', handler);
  }

  /**
   * 注册配置定义并校验标识冲突。
   * @param definition 配置定义
   */
  private assertDefinition (definition: AnyConfigDefinition): void {
    const existing = this.definitions.get(definition.id);

    if (existing && existing !== definition) {
      throw new Error(`[ConfigManager] Duplicate config id "${definition.id}".`);
    }
    this.definitions.set(definition.id, definition);
  }
}
