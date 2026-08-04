import { BufferDataType, BufferUsage, isWebGL2 } from '@galacean/effects-core';
import { GLDataBuffer, GLEngine } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';

const { assert, expect } = chai;

describe('webgl/gl-data-buffer', () => {
  let engine: GLEngine;

  before(() => {
    const gl = getGL2() as WebGL2RenderingContext;

    engine = new GLEngine(gl.canvas as HTMLCanvasElement, { glType: 'webgl2' });
  });

  after(() => {
    const canvas = engine.gl.canvas as HTMLCanvasElement;

    engine.dispose();
    canvas.remove();
  });

  it('creates a vertex buffer from backend-neutral options', () => {
    const buffer = new GLDataBuffer(engine, {
      kind: 'vertex',
      usage: BufferUsage.Static,
      type: BufferDataType.Float,
      byteStride: 8,
      instanceDivisor: 0,
    });

    buffer.setData(new Float32Array([1, 2, 3, 4]));
    assert.equal(buffer.target, engine.gl.ARRAY_BUFFER);
    assert.equal(buffer.capacity, 4 * Float32Array.BYTES_PER_ELEMENT);
    assert.equal(buffer.bytesPerElement, Float32Array.BYTES_PER_ELEMENT);
    buffer.dispose();
  });

  it('rejects updates outside the allocated range', () => {
    const buffer = new GLDataBuffer(engine, {
      kind: 'vertex',
      usage: BufferUsage.Dynamic,
      type: BufferDataType.Float,
      byteStride: 4,
      instanceDivisor: 0,
    });

    buffer.setData(new Float32Array(4));
    expect(() => buffer.setSubData(12, new Float32Array([1, 2]))).to.throw(RangeError);
    buffer.dispose();
  });

  it('updates and reads a byte range', () => {
    const buffer = new GLDataBuffer(engine, {
      kind: 'index',
      usage: BufferUsage.Dynamic,
      type: BufferDataType.UnsignedShort,
      byteStride: 0,
      instanceDivisor: 0,
    });

    buffer.setData(new Uint16Array([0, 1, 2, 3]));
    buffer.setSubData(Uint16Array.BYTES_PER_ELEMENT, new Uint16Array([7, 8]));
    if (isWebGL2(engine.gl)) {
      const result = new Uint16Array(4);

      buffer.readSubData(0, result);
      expect(result).to.deep.equal(new Uint16Array([0, 7, 8, 3]));
    }
    buffer.dispose();
  });
});
