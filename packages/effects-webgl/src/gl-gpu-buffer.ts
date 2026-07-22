import type { Disposable, spec } from '@galacean/effects-core';
import { isWebGL2, glContext } from '@galacean/effects-core';
import { assignInspectorName } from './gl-renderer-internal';
import type { GLEngine } from './gl-engine';

type GPUBufferTarget =
  | WebGLRenderingContext['ARRAY_BUFFER']
  | WebGLRenderingContext['ELEMENT_ARRAY_BUFFER']
  | WebGL2RenderingContext['COPY_READ_BUFFER']
  | WebGL2RenderingContext['COPY_WRITE_BUFFER']
  | WebGL2RenderingContext['TRANSFORM_FEEDBACK_BUFFER']
  | WebGL2RenderingContext['UNIFORM_BUFFER']
  | WebGL2RenderingContext['PIXEL_PACK_BUFFER']
  | WebGL2RenderingContext['PIXEL_UNPACK_BUFFER']
  ;

type GPUBufferType =
  | WebGLRenderingContext['UNSIGNED_INT']
  | WebGLRenderingContext['UNSIGNED_SHORT']
  | WebGLRenderingContext['UNSIGNED_BYTE']
  | WebGLRenderingContext['FLOAT']
  | WebGLRenderingContext['INT']
  | WebGLRenderingContext['SHORT']
  | WebGLRenderingContext['BYTE']
  ;

export interface GLGPUBufferProps {
  name?: string,
  target?: GPUBufferTarget,
  type?: GPUBufferType,
  /**
   * 数据元素的总量
   */
  elementCount?: number,
  data?: spec.TypedArray,
  usage?: WebGLRenderingContext['STATIC_DRAW'] | WebGLRenderingContext['DYNAMIC_DRAW'],
}

export class GLGPUBuffer implements Disposable {
  glBuffer: WebGLBuffer | null;

  readonly bytesPerElement: number;
  readonly target: GPUBufferTarget;
  readonly type: GPUBufferType;
  readonly usage: WebGLRenderingContext['STATIC_DRAW'] | WebGLRenderingContext['DYNAMIC_DRAW'] | WebGLRenderingContext['STREAM_DRAW'];
  readonly name?: string;

  private byteLength = 0;
  private destroyed = false;
  /**
   * CPU 端数据副本，仅在上下文可恢复（doNotHandleContextLost=false）时保留，供上下文恢复时重新上传。
   */
  private cpuData?: spec.TypedArray;

  constructor (
    public readonly engine: GLEngine,
    props: GLGPUBufferProps,
  ) {
    const {
      name, data, elementCount,
      target = glContext.ARRAY_BUFFER,
      type = glContext.FLOAT,
      usage = glContext.STATIC_DRAW,
    } = props;
    const bytesPerElement = getBytesPerElementByGLType(type);

    this.target = target;
    this.type = type;
    this.usage = usage;
    this.glBuffer = this.createGLBuffer(name) as WebGLBuffer;
    this.bytesPerElement = bytesPerElement;
    this.name = name;

    if (data) {
      this.bufferData(data);
    } else if (elementCount) {
      this.bufferData(bytesPerElement * elementCount);
    }
  }

  get elementCount (): number {
    return this.byteLength / this.bytesPerElement;
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  private createGLBuffer (name?: string): WebGLBuffer | null {
    const buffer = this.engine.gl.createBuffer();

    assignInspectorName(buffer, name);

    return buffer;
  }

  bind () {
    this.engine.gl.bindBuffer(this.target, this.glBuffer);
  }

  bufferData (data: spec.TypedArray | number): void {
    const byteLength = typeof data === 'number' ? data : data.byteLength;

    if (this.engine) {
      this.byteLength = byteLength;
      const gl = this.engine.gl;
      const target = this.target;

      gl.bindBuffer(target, this.glBuffer);
      if (byteLength === 0) {
        // ios 12 13 cause error when byteLength == 0
        gl.bufferData(target, 1, this.usage);
      } else {
        gl.bufferData(target, byteLength, this.usage);
        if (typeof data !== 'number') {
          gl.bufferSubData(target, 0, data);
        }
      }
      // 上下文可恢复时保留 CPU 副本，供 restore 重新上传。
      if (!this.engine.doNotHandleContextLost && typeof data !== 'number') {
        this.cpuData = data.slice();
      }
    } else {
      this.byteLength = 0;
    }
  }

  bufferSubData (elementOffset: number, data: spec.TypedArray): void {
    if (this.engine) {
      const gl = this.engine.gl;
      const target = this.target;
      const byteOffset = elementOffset * this.bytesPerElement;
      const byteLength = byteOffset + data.byteLength;

      gl.bindBuffer(target, this.glBuffer);
      if (byteLength > this.byteLength) {
        this.byteLength = byteLength;
        gl.bufferData(target, byteLength, this.usage);
      }
      gl.bufferSubData(target, byteOffset, data);

      // 维护 CPU 副本，使 restore 能还原最新内容。
      // subData 来自原始 data 的子 view，elementOffset + data.length 必然 ≤ cpuData.length，无需扩容。
      if (this.cpuData) {
        this.cpuData.set(data, elementOffset);
      }
    } else {
      this.byteLength = 0;
    }
  }

  /**
   * 上下文恢复后原地重建 GL 缓冲区。
   * 有 CPU 副本时完整重新上传；否则按原容量建空缓冲区（软降级，等内容另行更新）。
   */
  restore (): void {
    if (this.engine.disposed) {
      return;
    }
    // 旧句柄已随上下文丢失失效，无需 delete。
    this.glBuffer = this.createGLBuffer(this.name);
    if (this.cpuData) {
      this.bufferData(this.cpuData);
    } else if (this.byteLength > 0) {
      this.bufferData(this.byteLength);
    }
  }

  dispose (): void {
    this.engine.gl.deleteBuffer(this.glBuffer);
    this.glBuffer = null;
    this.cpuData = undefined;
    this.destroyed = true;
  }

  // for test
  readSubData (elementOffset: number, dstBuffer: spec.TypedArray): boolean {
    if (isWebGL2(this.engine.gl)) {
      this.engine.gl.getBufferSubData(this.target, elementOffset * this.bytesPerElement, dstBuffer);

      return true;
    }

    return false;
  }
}

const map: Record<number, Int32ArrayConstructor | Float32ArrayConstructor | Int16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Uint32ArrayConstructor | Uint16ArrayConstructor> = {
  [glContext.INT]: Int32Array,
  [glContext.FLOAT]: Float32Array,
  [glContext.SHORT]: Int16Array,
  [glContext.BYTE]: Int8Array,
  [glContext.UNSIGNED_BYTE]: Uint8Array,
  [glContext.UNSIGNED_INT]: Uint32Array,
  [glContext.UNSIGNED_SHORT]: Uint16Array,
};

export function getBytesPerElementByGLType (type: number): number {
  return map[type]?.BYTES_PER_ELEMENT ?? 0;
}
