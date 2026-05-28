import type { ProDataBuffer } from './data-buffer';
import type { ProDataSetLayout, ProVariableLayout } from './data-set-layout';

/**
 * 把一个变量名绑定到 component 起始偏移，避免每次访问都查表。
 *
 * 对齐 UE 的 FindParticleVariableIndex 返回 INDEX_NONE 模式：
 * 变量不存在时 isValid=false，get 返回 0（或填充 out 为 0），set 为 no-op。
 *
 * 注意：accessor 是层无关的——它只记录 layout 中的位置；buffer 的
 * stride（即 numAllocated）随时可能变化，每次读写都要从 buffer 取
 * 最新 stride 与 backing array。
 */
abstract class ProAccessor {
  protected layoutEntry: ProVariableLayout | null;

  constructor (layout: ProDataSetLayout, name: string) {
    this.layoutEntry = layout.getLayout(name) ?? null;
  }

  get isValid (): boolean {
    return this.layoutEntry !== null;
  }
}

export class ProFloatAccessor extends ProAccessor {
  get (buffer: ProDataBuffer, instance: number): number {
    if (!this.layoutEntry) { return 0; }

    return buffer.getFloatData()[this.layoutEntry.floatComponentStart * buffer.floatStride + instance];
  }

  set (buffer: ProDataBuffer, instance: number, value: number): void {
    if (!this.layoutEntry) { return; }
    buffer.getFloatData()[this.layoutEntry.floatComponentStart * buffer.floatStride + instance] = value;
  }
}

export class ProInt32Accessor extends ProAccessor {
  get (buffer: ProDataBuffer, instance: number): number {
    if (!this.layoutEntry) { return 0; }

    return buffer.getInt32Data()[this.layoutEntry.int32ComponentStart * buffer.int32Stride + instance];
  }

  set (buffer: ProDataBuffer, instance: number, value: number): void {
    if (!this.layoutEntry) { return; }
    buffer.getInt32Data()[this.layoutEntry.int32ComponentStart * buffer.int32Stride + instance] = value | 0;
  }
}

export class ProVec2Accessor extends ProAccessor {
  get (buffer: ProDataBuffer, instance: number, out: [number, number]): [number, number] {
    if (!this.layoutEntry) {
      out[0] = 0; out[1] = 0;

      return out;
    }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    out[0] = data[start * stride + instance];
    out[1] = data[(start + 1) * stride + instance];

    return out;
  }

  set (buffer: ProDataBuffer, instance: number, x: number, y: number): void {
    if (!this.layoutEntry) { return; }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    data[start * stride + instance] = x;
    data[(start + 1) * stride + instance] = y;
  }
}

export class ProVec3Accessor extends ProAccessor {
  get (buffer: ProDataBuffer, instance: number, out: [number, number, number]): [number, number, number] {
    if (!this.layoutEntry) {
      out[0] = 0; out[1] = 0; out[2] = 0;

      return out;
    }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    out[0] = data[start * stride + instance];
    out[1] = data[(start + 1) * stride + instance];
    out[2] = data[(start + 2) * stride + instance];

    return out;
  }

  set (buffer: ProDataBuffer, instance: number, x: number, y: number, z: number): void {
    if (!this.layoutEntry) { return; }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    data[start * stride + instance] = x;
    data[(start + 1) * stride + instance] = y;
    data[(start + 2) * stride + instance] = z;
  }
}

export class ProVec4Accessor extends ProAccessor {
  get (buffer: ProDataBuffer, instance: number, out: [number, number, number, number]): [number, number, number, number] {
    if (!this.layoutEntry) {
      out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;

      return out;
    }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    out[0] = data[start * stride + instance];
    out[1] = data[(start + 1) * stride + instance];
    out[2] = data[(start + 2) * stride + instance];
    out[3] = data[(start + 3) * stride + instance];

    return out;
  }

  set (buffer: ProDataBuffer, instance: number, x: number, y: number, z: number, w: number): void {
    if (!this.layoutEntry) { return; }
    const data = buffer.getFloatData();
    const stride = buffer.floatStride;
    const start = this.layoutEntry.floatComponentStart;

    data[start * stride + instance] = x;
    data[(start + 1) * stride + instance] = y;
    data[(start + 2) * stride + instance] = z;
    data[(start + 3) * stride + instance] = w;
  }
}
