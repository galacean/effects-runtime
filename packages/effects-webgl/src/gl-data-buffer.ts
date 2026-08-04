import type { DataBufferOptions, spec } from '@galacean/effects-core';
import { BufferDataType, DataBuffer, getBytesPerElement, isWebGL2 } from '@galacean/effects-core';
import type { GLEngine } from './gl-engine';
import { assignInspectorName } from './gl-renderer-internal';

/**
 * 使用当前图形上下文保存缓冲区资源。
 */
export class GLDataBuffer extends DataBuffer {
  glBuffer: WebGLBuffer | null;

  readonly target: number;
  readonly type: number;
  readonly bytesPerElement: number;

  private destroyed = false;

  constructor (
    public readonly engine: GLEngine,
    options: DataBufferOptions,
  ) {
    super(options);
    this.target = options.kind === 'index' ? engine.gl.ELEMENT_ARRAY_BUFFER : engine.gl.ARRAY_BUFFER;
    this.type = options.type;
    this.bytesPerElement = getBytesPerElement(options.type);
    this.is32Bits = options.kind === 'index' && (options.type as BufferDataType) === BufferDataType.UnsignedInt;
    this.glBuffer = this.createBuffer();
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  bind (): void {
    this.engine.gl.bindBuffer(this.target, this.glBuffer);
  }

  setData (data: spec.TypedArray | number): void {
    if (this.destroyed) {
      return;
    }
    const byteLength = typeof data === 'number' ? data : data.byteLength;
    const gl = this.engine.gl;

    this.capacity = byteLength;
    this.bind();
    gl.bufferData(this.target, Math.max(byteLength, 1), this.options.usage);
    if (typeof data !== 'number' && byteLength > 0) {
      gl.bufferSubData(this.target, 0, data);
    }
  }

  setSubData (byteOffset: number, data: spec.TypedArray): void {
    if (this.destroyed) {
      return;
    }
    if (byteOffset < 0 || byteOffset + data.byteLength > this.capacity) {
      throw new RangeError(`Buffer '${this.options.name ?? ''}' update is out of range.`);
    }
    this.bind();
    this.engine.gl.bufferSubData(this.target, byteOffset, data);
  }

  restore (data: spec.TypedArray | undefined, byteLength: number): void {
    if (this.destroyed || this.engine.disposed) {
      return;
    }
    this.glBuffer = this.createBuffer();
    this.setData(data ?? byteLength);
  }

  readSubData (elementOffset: number, destination: spec.TypedArray): boolean {
    const gl = this.engine.gl;

    if (!isWebGL2(gl)) {
      return false;
    }
    this.bind();
    gl.getBufferSubData(this.target, elementOffset * this.bytesPerElement, destination);

    return true;
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    if (!this.engine.disposed) {
      this.engine.gl.deleteBuffer(this.glBuffer);
    }
    this.glBuffer = null;
    this.capacity = 0;
    this.destroyed = true;
  }

  private createBuffer (): WebGLBuffer | null {
    const buffer = this.engine.gl.createBuffer();

    assignInspectorName(buffer, this.options.name);

    return buffer;
  }
}
