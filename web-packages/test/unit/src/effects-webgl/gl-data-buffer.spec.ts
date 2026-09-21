import { Engine } from '@galacean/effects-core';
import { BufferDataType, BufferUsage, isWebGL2 } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { GLDataBuffer } from '@galacean/effects-webgl';
import { getGL2, readBufferContents } from './gl-utils';

const { assert, expect } = chai;

describe('webgl/gl-data-buffer', () => {
  let engine: Engine;

  before(() => {
    const gl = getGL2() as WebGL2RenderingContext;

    engine = new Engine(gl.canvas as HTMLCanvasElement, { glType: 'webgl2' });
  });

  after(() => {
    const canvas = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl.canvas as HTMLCanvasElement;

    engine.dispose();
    canvas.remove();
  });

  it('creates a vertex buffer through the engine', () => {
    const buffer = engine.displayServer.renderingDevice.createVertexBuffer(new Float32Array([1, 2, 3, 4]), {
      usage: BufferUsage.Static,
      type: BufferDataType.Float,
      byteStride: 8,
      instanceDivisor: 0,
    });

    expect(buffer).to.be.an.instanceOf(GLDataBuffer);
    assert.isNotNull(buffer.underlyingResource);
    assert.equal(buffer.capacity, 4 * Float32Array.BYTES_PER_ELEMENT);
    engine.displayServer.renderingDevice.releaseBuffer(buffer);
  });

  it('rejects updates outside the allocated range', () => {
    const buffer = engine.displayServer.renderingDevice.createDynamicVertexBuffer(new Float32Array(4), {
      usage: BufferUsage.Dynamic,
      type: BufferDataType.Float,
      byteStride: 4,
      instanceDivisor: 0,
    });

    expect(() => engine.displayServer.renderingDevice.updateDynamicVertexBuffer(
      buffer,
      new Float32Array([1, 2]),
      12,
    )).to.throw(RangeError);
    engine.displayServer.renderingDevice.releaseBuffer(buffer);
  });

  it('updates and reads a byte range', () => {
    const buffer = engine.displayServer.renderingDevice.createIndexBuffer(new Uint16Array([0, 1, 2, 3]), {
      usage: BufferUsage.Dynamic,
      type: BufferDataType.UnsignedShort,
      byteStride: 0,
      instanceDivisor: 0,
    });

    engine.displayServer.renderingDevice.updateDynamicIndexBuffer(
      buffer,
      new Uint16Array([7, 8]),
      Uint16Array.BYTES_PER_ELEMENT,
    );
    if (isWebGL2((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl)) {
      const result = new Uint16Array(4);

      readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, buffer, result, 0, true);
      expect(result).to.deep.equal(new Uint16Array([0, 7, 8, 3]));
    }
    engine.displayServer.renderingDevice.releaseBuffer(buffer);
  });
});
