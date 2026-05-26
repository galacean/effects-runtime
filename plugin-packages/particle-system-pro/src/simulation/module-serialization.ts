import type { ProModule, ProModuleProps } from '../modules/module';
import {
  findProModuleDescriptor, getProModuleTypeId,
} from '../modules/builtin/module-registry';

export interface ProModuleData {
  typeId: string,
  enabled?: boolean,
  props: ProModuleProps,
}

/**
 * 序列化一个 module 实例为 JSON 数据。
 * module 自身负责 toJSON：显式声明哪些字段、如何转 JSON。
 */
export function serializeProModule (module: ProModule): ProModuleData | null {
  const typeId = getProModuleTypeId(module);

  if (!typeId) {
    console.warn('[particle-system-pro] module not in registry, skipping serialize:', module.constructor.name);

    return null;
  }

  return {
    typeId,
    enabled: module.enabled,
    props: module.toJSON(),
  };
}

/**
 * 反序列化 module。typeId 未注册时返回 null（调用方决定是否跳过）。
 */
export function deserializeProModule (data: ProModuleData): ProModule | null {
  const desc = findProModuleDescriptor(data.typeId);

  if (!desc) {
    console.warn('[particle-system-pro] unknown module typeId, skipping:', data.typeId);

    return null;
  }
  const module = desc.create();

  if (data.enabled !== undefined) {
    module.enabled = !!data.enabled;
  }
  module.fromJSON(data.props ?? {});

  return module;
}

/**
 * 测试用：把一组 module 做一次 serialize → deserialize → serialize roundtrip，
 * 比对两次 JSON 字符串是否一致。一致返回 true；否则 console.warn 并返回 false。
 *
 * 不依赖 Engine，可在 dev console / 单测里直接调用。
 */
export function verifyRoundtripModules (modules: ProModule[]): boolean {
  const a: ProModuleData[] = [];

  for (const m of modules) {
    const d = serializeProModule(m);

    if (d) { a.push(d); }
  }
  const restored: ProModule[] = [];

  for (const d of a) {
    const m = deserializeProModule(d);

    if (m) { restored.push(m); }
  }
  const b: ProModuleData[] = [];

  for (const m of restored) {
    const d = serializeProModule(m);

    if (d) { b.push(d); }
  }
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);

  if (sa !== sb) {
    console.warn('[verifyRoundtripModules] mismatch:\n  original:', sa, '\n  restored:', sb);

    return false;
  }

  return true;
}
