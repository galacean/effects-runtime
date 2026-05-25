import type { ProDataSetLayout } from './data-set-layout';

/**
 * 单个粒子模拟缓冲。
 *
 * SoA 布局：所有粒子的 component 0 排在一起，紧跟 component 1……
 * 这样 module 在循环 instance 时可以对每个 component 做近似连续访存，
 * 同时对 SIMD-friendly。
 *
 * 与 Niagara 的 FNiagaraDataBuffer 对应，但 Phase 1 不实现 Half 通道、
 * 不实现 GPU 路径，也不维护 IDToIndexTable（持久 ID 用 ProIdTable 单独
 * 在 emitter 侧管理）。
 */
export class ProDataBuffer {
  private floatData: Float32Array = new Float32Array(0);
  private int32Data: Int32Array = new Int32Array(0);

  private numInstancesValue = 0;
  private numAllocatedValue = 0;
  private floatStrideValue = 0;
  private int32StrideValue = 0;

  private numSpawnedInstancesValue = 0;

  constructor (private layout: ProDataSetLayout) {}

  get numInstances (): number {
    return this.numInstancesValue;
  }

  get numAllocated (): number {
    return this.numAllocatedValue;
  }

  get numSpawnedInstances (): number {
    return this.numSpawnedInstancesValue;
  }

  get floatStride (): number {
    return this.floatStrideValue;
  }

  get int32Stride (): number {
    return this.int32StrideValue;
  }

  setNumInstances (n: number): void {
    if (n > this.numAllocatedValue) {
      throw new Error(`ProDataBuffer.setNumInstances: ${n} exceeds allocated ${this.numAllocatedValue}`);
    }
    this.numInstancesValue = n;
  }

  setNumSpawnedInstances (n: number): void {
    this.numSpawnedInstancesValue = n;
  }

  /**
   * 分配空间。maintainExisting 为 true 时会尽量复制旧数据到新缓冲。
   *
   * stride 等于 numAllocated；分配只会增长，不会主动收缩。
   */
  allocate (numInstances: number, maintainExisting = false): void {
    if (numInstances <= this.numAllocatedValue && maintainExisting) {
      return;
    }
    const oldFloat = this.floatData;
    const oldInt32 = this.int32Data;
    const oldFloatStride = this.floatStrideValue;
    const oldInt32Stride = this.int32StrideValue;
    const oldNum = this.numInstancesValue;

    const newAllocated = Math.max(numInstances, this.numAllocatedValue);
    const newFloatSize = newAllocated * this.layout.totalFloatComponents;
    const newInt32Size = newAllocated * this.layout.totalInt32Components;

    if (newFloatSize !== oldFloat.length) {
      this.floatData = new Float32Array(newFloatSize);
    } else {
      this.floatData.fill(0);
    }
    if (newInt32Size !== oldInt32.length) {
      this.int32Data = new Int32Array(newInt32Size);
    } else {
      this.int32Data.fill(0);
    }

    this.numAllocatedValue = newAllocated;
    this.floatStrideValue = newAllocated;
    this.int32StrideValue = newAllocated;

    if (maintainExisting && oldNum > 0) {
      this.copyExisting(oldFloat, oldInt32, oldFloatStride, oldInt32Stride, oldNum);
    } else {
      this.numInstancesValue = 0;
    }
  }

  /**
   * 释放 CPU 缓冲。下次 allocate 会重新分配。
   */
  releaseCPU (): void {
    this.floatData = new Float32Array(0);
    this.int32Data = new Int32Array(0);
    this.numInstancesValue = 0;
    this.numAllocatedValue = 0;
    this.floatStrideValue = 0;
    this.int32StrideValue = 0;
    this.numSpawnedInstancesValue = 0;
  }

  /**
   * 把 newIndex 处的粒子覆盖到 oldIndex，并把 numInstances 减一（swap-back compaction）。
   *
   * 调用方需保证 oldIndex < numInstances。
   */
  killInstance (oldIndex: number): void {
    const last = this.numInstancesValue - 1;

    if (last < 0 || oldIndex > last) {
      return;
    }
    if (oldIndex !== last) {
      this.swapInstances(oldIndex, last);
    }
    this.numInstancesValue = last;
  }

  /**
   * 在所有 component 上交换两个粒子的数据。
   */
  swapInstances (a: number, b: number): void {
    if (a === b) {
      return;
    }
    const floatStride = this.floatStrideValue;
    const totalFloat = this.layout.totalFloatComponents;

    for (let c = 0; c < totalFloat; c++) {
      const base = c * floatStride;
      const tmp = this.floatData[base + a];

      this.floatData[base + a] = this.floatData[base + b];
      this.floatData[base + b] = tmp;
    }
    const int32Stride = this.int32StrideValue;
    const totalInt32 = this.layout.totalInt32Components;

    for (let c = 0; c < totalInt32; c++) {
      const base = c * int32Stride;
      const tmp = this.int32Data[base + a];

      this.int32Data[base + a] = this.int32Data[base + b];
      this.int32Data[base + b] = tmp;
    }
  }

  getFloat (componentIdx: number, instanceIdx: number): number {
    return this.floatData[componentIdx * this.floatStrideValue + instanceIdx];
  }

  setFloat (componentIdx: number, instanceIdx: number, value: number): void {
    this.floatData[componentIdx * this.floatStrideValue + instanceIdx] = value;
  }

  getInt32 (componentIdx: number, instanceIdx: number): number {
    return this.int32Data[componentIdx * this.int32StrideValue + instanceIdx];
  }

  setInt32 (componentIdx: number, instanceIdx: number, value: number): void {
    this.int32Data[componentIdx * this.int32StrideValue + instanceIdx] = value | 0;
  }

  /**
   * @internal Accessor 直接读 backing buffer 时用。
   */
  getFloatData (): Float32Array {
    return this.floatData;
  }

  /**
   * @internal Accessor 直接读 backing buffer 时用。
   */
  getInt32Data (): Int32Array {
    return this.int32Data;
  }

  private copyExisting (
    oldFloat: Float32Array,
    oldInt32: Int32Array,
    oldFloatStride: number,
    oldInt32Stride: number,
    oldNum: number,
  ): void {
    const copyCount = Math.min(oldNum, this.numAllocatedValue);
    const newFloatStride = this.floatStrideValue;
    const totalFloat = this.layout.totalFloatComponents;

    for (let c = 0; c < totalFloat; c++) {
      const srcBase = c * oldFloatStride;
      const dstBase = c * newFloatStride;

      for (let i = 0; i < copyCount; i++) {
        this.floatData[dstBase + i] = oldFloat[srcBase + i];
      }
    }
    const newInt32Stride = this.int32StrideValue;
    const totalInt32 = this.layout.totalInt32Components;

    for (let c = 0; c < totalInt32; c++) {
      const srcBase = c * oldInt32Stride;
      const dstBase = c * newInt32Stride;

      for (let i = 0; i < copyCount; i++) {
        this.int32Data[dstBase + i] = oldInt32[srcBase + i];
      }
    }
    this.numInstancesValue = copyCount;
  }
}
