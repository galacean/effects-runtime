import { ProDataBuffer } from './data-buffer';
import type { ProDataSetLayout } from './data-set-layout';

/**
 * 一对双缓冲（current + destination）的容器。
 *
 * BeginSimulate 拿到 destination buffer 用于写入新一帧的粒子状态，
 * EndSimulate 把 destination 提升为 current（next read source）。
 *
 * 与 Niagara 的 FNiagaraDataSet 对应。
 */
export class ProDataSet {
  readonly layout: ProDataSetLayout;

  private bufferA: ProDataBuffer;
  private bufferB: ProDataBuffer;
  private currentBuffer: ProDataBuffer | null = null;
  private destinationBuffer: ProDataBuffer | null = null;
  private initialized = false;

  constructor (layout: ProDataSetLayout) {
    this.layout = layout;
    this.bufferA = new ProDataBuffer(layout);
    this.bufferB = new ProDataBuffer(layout);
  }

  init (): void {
    this.currentBuffer = this.bufferA;
    this.destinationBuffer = null;
    this.initialized = true;
  }

  isInitialized (): boolean {
    return this.initialized;
  }

  /**
   * 拿到 destination buffer 开始写入。返回的 buffer 已就绪但未分配空间，
   * 调用方紧接着应调用 allocate()。
   */
  beginSimulate (resetDestination = true): ProDataBuffer {
    if (!this.initialized) {
      throw new Error('ProDataSet.beginSimulate called before init');
    }
    this.destinationBuffer = this.currentBuffer === this.bufferA ? this.bufferB : this.bufferA;
    if (resetDestination) {
      this.destinationBuffer.setNumInstances(0);
      this.destinationBuffer.setNumSpawnedInstances(0);
    }

    return this.destinationBuffer;
  }

  /**
   * 把 destination 提升为 current。如果 setCurrent 为 false 则只是清掉
   * destination 引用（用于丢弃这一帧的模拟结果）。
   */
  endSimulate (setCurrent = true): void {
    if (setCurrent && this.destinationBuffer) {
      this.currentBuffer = this.destinationBuffer;
    }
    this.destinationBuffer = null;
  }

  /**
   * 给当前的 destination buffer 分配空间。必须在 beginSimulate 之后调用。
   */
  allocate (numInstances: number, maintainExisting = false): void {
    if (!this.destinationBuffer) {
      throw new Error('ProDataSet.allocate called outside BeginSimulate/EndSimulate');
    }
    this.destinationBuffer.allocate(numInstances, maintainExisting);
  }

  getCurrentData (): ProDataBuffer | null {
    return this.currentBuffer;
  }

  getDestinationData (): ProDataBuffer | null {
    return this.destinationBuffer;
  }

  resetBuffers (): void {
    this.bufferA.releaseCPU();
    this.bufferB.releaseCPU();
    this.currentBuffer = this.bufferA;
    this.destinationBuffer = null;
  }
}
