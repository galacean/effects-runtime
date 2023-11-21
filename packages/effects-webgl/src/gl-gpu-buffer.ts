import type { Disposable, spec } from '@galacean/effects-core';
import { isWebGL2, glContext } from '@galacean/effects-core';
import type { GLPipelineContext } from './gl-pipeline-context';
import { assignInspectorName } from './gl-renderer-internal';

type GPUBufferTarget =
  | WebGLRenderingContext['ARRAY_BUFFER']
  | WebGLRenderingContext['ELEMENT_ARRAY_BUFFER']
  | WebGL2RenderingContext['COPY_READ_BUFFER']
  | WebGL2RenderingContext['COPY_WRITE_BUFFER']
  | WebGL2RenderingContext['TRANSFORM_FEEDBACK_BUFFER']
  | WebGL2RenderingContext['UNIFORM_BUFFER']
  | WebGL2RenderingContext['PIXEL_PACK_BUFFER']
  | WebGL2RenderingContext['PIXEL_UNPACK_BUFFER'];

type GPUBufferType =
  | WebGLRenderingContext['UNSIGNED_INT']
  | WebGLRenderingContext['UNSIGNED_SHORT']
  | WebGLRenderingContext['UNSIGNED_BYTE']
  | WebGLRenderingContext['FLOAT']
  | WebGLRenderingContext['INT']
  | WebGLRenderingContext['SHORT']
  | WebGLRenderingContext['BYTE'];

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
  readonly bytesPerElement: number;
  readonly target: GPUBufferTarget;
  readonly type: GPUBufferType;
  readonly usage: WebGLRenderingContext['STATIC_DRAW'] | WebGLRenderingContext['DYNAMIC_DRAW'] | WebGLRenderingContext['STREAM_DRAW'];
  readonly glBuffer: WebGLBuffer | null;

  private byteLength = 0;
  private destroyed = false;

  constructor (
    public readonly pipelineContext: GLPipelineContext,
    props: GLGPUBufferProps,
  ) {
    const { target = glContext.ARRAY_BUFFER, type = glContext.FLOAT, name, usage = glContext.STATIC_DRAW, data, elementCount } = props;
    const bytesPerElement = getBytesPerElementByGLType(type);

    this.target = target;
    this.type = type;
    this.usage = usage;
    this.glBuffer = this.createGLBuffer(name) as WebGLBuffer;
    this.bytesPerElement = bytesPerElement;

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
    const buffer = this.pipelineContext.gl.createBuffer();

    if (buffer) {
      assignInspectorName(buffer, name);
    }

    return buffer;
  }

  bind () {
    this.pipelineContext.gl.bindBuffer(this.target, this.glBuffer);
  }

  bufferData (data: spec.TypedArray | number): void {
    const byteLength = typeof data === 'number' ? data : data.byteLength;

    if (this.pipelineContext) {
      this.byteLength = byteLength;
      const gl = this.pipelineContext.gl;
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
    } else {
      this.byteLength = 0;
    }
  }

  bufferSubData (elementOffset: number, data: spec.TypedArray): void {
    if (this.pipelineContext) {
      const gl = this.pipelineContext.gl;
      const target = this.target;
      const byteOffset = elementOffset * this.bytesPerElement;
      const byteLength = byteOffset + data.byteLength;

      gl.bindBuffer(target, this.glBuffer);
      if (byteLength > this.byteLength) {
        this.byteLength = byteLength;
        gl.bufferData(target, byteLength, this.usage);
      }
      gl.bufferSubData(target, byteOffset, data);
    } else {
      this.byteLength = 0;
    }
  }

  dispose (): void {
    this.pipelineContext.gl.deleteBuffer(this.glBuffer);
    // @ts-expect-error safe to assign
    this.glBuffer = null;
    this.destroyed = true;
  }

  // for test
  readSubData (elementOffset: number, dstBuffer: spec.TypedArray): boolean {
    if (isWebGL2(this.pipelineContext.gl)) {
      this.pipelineContext.gl.getBufferSubData(this.target, elementOffset * this.bytesPerElement, dstBuffer);

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
