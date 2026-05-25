import type { ProVariable } from '../types/variable';

interface StoredEntry {
  variable: ProVariable,
  floatOffset: number,
  int32Offset: number,
}

/**
 * 一个变量名到值的扁平存储。
 *
 * 内部按 component 拼接到两条 Float32Array / Int32Array 上，避免每个
 * 变量都装箱成对象。读写以变量名为 key，需要高频访问时用 ParameterBinding
 * 拿到稳定的 offset 后直接读 backing array。
 */
export class ProParameterStore {
  private entries = new Map<string, StoredEntry>();
  private floatBuffer: Float32Array = new Float32Array(0);
  private int32Buffer: Int32Array = new Int32Array(0);
  private floatLength = 0;
  private int32Length = 0;

  addParameter (variable: ProVariable): void {
    if (this.entries.has(variable.name)) {
      return;
    }

    const entry: StoredEntry = {
      variable,
      floatOffset: this.floatLength,
      int32Offset: this.int32Length,
    };

    this.floatLength += variable.type.floatComponents;
    this.int32Length += variable.type.int32Components;
    this.entries.set(variable.name, entry);

    this.growBuffers();
  }

  hasParameter (name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * @internal 暴露给 ParameterBinding 用。
   */
  getEntry (name: string): StoredEntry | undefined {
    return this.entries.get(name);
  }

  /**
   * @internal 暴露给 ParameterBinding 用。
   */
  getFloatBuffer (): Float32Array {
    return this.floatBuffer;
  }

  /**
   * @internal 暴露给 ParameterBinding 用。
   */
  getInt32Buffer (): Int32Array {
    return this.int32Buffer;
  }

  setFloat (name: string, value: number): void {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.floatComponents === 0) {
      return;
    }
    this.floatBuffer[entry.floatOffset] = value;
  }

  getFloat (name: string): number {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.floatComponents === 0) {
      return 0;
    }

    return this.floatBuffer[entry.floatOffset];
  }

  setInt32 (name: string, value: number): void {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.int32Components === 0) {
      return;
    }
    this.int32Buffer[entry.int32Offset] = value | 0;
  }

  getInt32 (name: string): number {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.int32Components === 0) {
      return 0;
    }

    return this.int32Buffer[entry.int32Offset];
  }

  setVec2 (name: string, x: number, y: number): void {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.floatComponents < 2) {
      return;
    }
    const offset = entry.floatOffset;

    this.floatBuffer[offset] = x;
    this.floatBuffer[offset + 1] = y;
  }

  setVec3 (name: string, x: number, y: number, z: number): void {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.floatComponents < 3) {
      return;
    }
    const offset = entry.floatOffset;

    this.floatBuffer[offset] = x;
    this.floatBuffer[offset + 1] = y;
    this.floatBuffer[offset + 2] = z;
  }

  setVec4 (name: string, x: number, y: number, z: number, w: number): void {
    const entry = this.entries.get(name);

    if (!entry || entry.variable.type.floatComponents < 4) {
      return;
    }
    const offset = entry.floatOffset;

    this.floatBuffer[offset] = x;
    this.floatBuffer[offset + 1] = y;
    this.floatBuffer[offset + 2] = z;
    this.floatBuffer[offset + 3] = w;
  }

  setColor (name: string, r: number, g: number, b: number, a: number): void {
    this.setVec4(name, r, g, b, a);
  }

  reset (): void {
    this.floatBuffer.fill(0);
    this.int32Buffer.fill(0);
  }

  private growBuffers (): void {
    if (this.floatBuffer.length < this.floatLength) {
      const next = new Float32Array(this.floatLength);

      next.set(this.floatBuffer);
      this.floatBuffer = next;
    }
    if (this.int32Buffer.length < this.int32Length) {
      const next = new Int32Array(this.int32Length);

      next.set(this.int32Buffer);
      this.int32Buffer = next;
    }
  }
}
