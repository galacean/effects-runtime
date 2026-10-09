/** 带稳定标识、默认值和校验器的配置定义。 */
export type ConfigDefinition<Id extends string, T extends object> = {
  /** 配置唯一标识。 */
  readonly id: Id,
  /** 配置默认值。 */
  readonly defaults: Readonly<T>,
  /** 校验并归一化外部配置。 */
  readonly validate?: (input: unknown) => Partial<T> | undefined,
};

/** 任意配置定义的通用类型。 */
export type AnyConfigDefinition = ConfigDefinition<string, Record<string, unknown>>;

/** 提取配置定义对应的值类型。 */
export type ConfigValue<D> = D extends ConfigDefinition<string, infer T> ? T : never;

/** 一次配置变更的前后值。 */
export type ConfigChange<T extends object> = {
  /** 本次接受的增量配置。 */
  partial: Readonly<Partial<T>>,
  /** 变更前的完整配置。 */
  previous: Readonly<T>,
  /** 变更后的完整配置。 */
  current: Readonly<T>,
};

/**
 * 深拷贝由数组和普通对象组成的配置值。
 * @param value 待拷贝的配置值
 * @returns 配置值副本
 */
export function cloneConfigValue<T> (value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneConfigValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneConfigValue(item)]),
    ) as T;
  }

  return value;
}

/**
 * 递归冻结配置值。
 * @param value 待冻结的配置值
 * @returns 已冻结的原值
 */
export function freezeConfigValue<T> (value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      freezeConfigValue(item);
    }
    Object.freeze(value);
  }

  return value;
}

/**
 * 创建不可变的配置定义。
 * @param definition 配置标识、默认值和可选校验器
 * @returns 默认值已复制并冻结的配置定义
 */
export function defineConfig<const Id extends string, T extends object> (
  definition: ConfigDefinition<Id, T>,
): ConfigDefinition<Id, T> {
  return Object.freeze({
    ...definition,
    defaults: freezeConfigValue(cloneConfigValue(definition.defaults)),
  });
}
