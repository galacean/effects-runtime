import type { ProParameterStore } from './parameter-store';

/**
 * 把一个变量名解析成稳定的 offset，避免每帧字符串查找。
 *
 * 注意：绑定的 buffer 引用会在 ParameterStore 增长时失效。Phase 1 通过
 * lazy refresh 在每次访问时回取一次 buffer 引用解决；后续如果切到固定预
 * 分配的 store，可以省掉这次查询。
 */
export class ProFloatBinding {
  constructor (private store: ProParameterStore, private offset: number) {}

  get (): number {
    return this.store.getFloatBuffer()[this.offset];
  }

  set (value: number): void {
    this.store.getFloatBuffer()[this.offset] = value;
  }
}

export class ProInt32Binding {
  constructor (private store: ProParameterStore, private offset: number) {}

  get (): number {
    return this.store.getInt32Buffer()[this.offset];
  }

  set (value: number): void {
    this.store.getInt32Buffer()[this.offset] = value | 0;
  }
}

export function bindFloat (store: ProParameterStore, name: string): ProFloatBinding | null {
  const entry = store.getEntry(name);

  if (!entry || entry.variable.type.floatComponents === 0) {
    return null;
  }

  return new ProFloatBinding(store, entry.floatOffset);
}

export function bindInt32 (store: ProParameterStore, name: string): ProInt32Binding | null {
  const entry = store.getEntry(name);

  if (!entry || entry.variable.type.int32Components === 0) {
    return null;
  }

  return new ProInt32Binding(store, entry.int32Offset);
}
