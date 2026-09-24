import { Engine, GPUResource } from '@galacean/effects-core';
import { BufferDataType, BufferUsage, isWebGL2 } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { GPUBufferWebGL } from '@galacean/effects-webgl';
import { getGL2, readBufferContents } from './gl-utils';

const { assert, expect } = chai;

describe('webgl/gpu-buffer', () => {
  let engine: Engine;
  const options = {
    usage: BufferUsage.Dynamic,
    type: BufferDataType.Float,
    byteStride: 8,
    instanceDivisor: 0,
  };

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
    const buffer = engine.displayServer.renderingDevice.createBuffer();

    buffer.initialize({ data: new Float32Array([1, 2, 3, 4]),
      usage: BufferUsage.Static,
      type: BufferDataType.Float,
      byteStride: 8,
      instanceDivisor: 0,
    });

    expect(buffer).to.be.an.instanceOf(GPUBufferWebGL);
    assert.isNotNull(buffer.underlyingResource);
    assert.equal(buffer.capacity, 4 * Float32Array.BYTES_PER_ELEMENT);
    buffer.dispose();
  });

  it('registers an unallocated buffer and can release and initialize it again', () => {
    const device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const gl = device.gl;
    const baseline = device['resources'].length;
    const buffer = device.createBuffer();
    const data = new Float32Array([1, 2, 3, 4]);

    expect(buffer).instanceOf(GPUResource);
    expect(buffer.device).equals(device);
    expect(buffer.underlyingResource).equals(null);
    expect(buffer.capacity).equals(0);
    expect(device['resources'].length).equals(baseline + 1);
    buffer.initialize({ ...options, data });
    const handle = buffer.underlyingResource;
    let releases = 0;
    const unsubscribe = buffer.on('releasing', () => {
      releases++;
      expect(buffer.device).equals(device);
      expect(gl.isBuffer(handle)).equals(true);
    });

    buffer.releaseGPU();
    buffer.releaseGPU();
    unsubscribe();
    expect(releases).equals(1);
    expect(gl.isBuffer(handle)).equals(false);
    expect(buffer.underlyingResource).equals(null);
    expect(buffer.capacity).equals(0);
    expect(device['resources'].length).equals(baseline + 1);
    buffer.initialize({ ...options, data });
    const result = new Float32Array(4);

    readBufferContents(gl, buffer, result);
    expect(result).deep.equals(data);
    expect(buffer.underlyingResource).not.equals(handle);
    buffer.dispose();
    buffer.dispose();
    expect(buffer.device).equals(null);
    expect(device['resources'].length).equals(baseline);
  });

  it('reinitializes an index allocation and clears its binding and element type on release', () => {
    const device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const buffer = device.createBuffer();

    buffer.initialize({ ...options, data: new Uint32Array([0, 65535]), index: true });
    const oldHandle = buffer.underlyingResource;

    expect(buffer.is32Bits).equals(true);
    buffer.initialize({ ...options, data: new Uint16Array([1, 2]), index: true });
    expect(device.gl.isBuffer(oldHandle)).equals(false);
    expect(buffer.is32Bits).equals(false);
    const result = new Uint16Array(2);

    readBufferContents(device.gl, buffer, result, 0, true);
    expect(result).deep.equals(new Uint16Array([1, 2]));
    device.bindIndexBuffer(buffer);
    buffer.releaseGPU();
    expect(device['currentIndexBuffer']).equals(null);
    expect(device.gl.getParameter(device.gl.ELEMENT_ARRAY_BUFFER_BINDING)).equals(null);
    expect(buffer.capacity).equals(0);
    expect(buffer.is32Bits).equals(false);
    buffer.dispose();
  });

  it('releases remaining buffers before device shutdown without deleting host buffers', () => {
    const owner = new Engine(document.createElement('canvas'), { glType: 'webgl2', ownsCanvas: false });
    const device = owner.displayServer.renderingDevice as RenderingDeviceWebGL;
    const gl = device.gl;
    const buffer = device.createBuffer();

    buffer.initialize({ ...options, data: new Float32Array([1, 2]) });
    const handle = buffer.underlyingResource as WebGLBuffer;
    const unused = device.createBuffer();
    const hostBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, hostBuffer);
    let releases = 0;

    buffer.on('releasing', () => {
      releases++;
      expect(buffer.device).equals(device);
      expect(gl.isBuffer(handle)).equals(true);
    });
    owner.dispose();
    expect(device['resources'].length).equals(0);
    expect(buffer.device).equals(null);
    expect(unused.device).equals(null);
    expect(gl.isBuffer(handle)).equals(false);
    expect(gl.isBuffer(hostBuffer)).equals(true);
    buffer.dispose();
    unused.dispose();
    expect(releases).equals(1);
    gl.deleteBuffer(hostBuffer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });

  it('rejects updates outside the allocated range', () => {
    const buffer = engine.displayServer.renderingDevice.createBuffer();

    buffer.initialize({ data: new Float32Array(4),
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
    buffer.dispose();
  });

  it('updates and reads a byte range', () => {
    const buffer = engine.displayServer.renderingDevice.createBuffer();

    buffer.initialize({ data: new Uint16Array([0, 1, 2, 3]), index: true,
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
    buffer.dispose();
  });
});
