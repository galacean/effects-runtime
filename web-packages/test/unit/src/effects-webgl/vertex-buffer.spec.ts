import { Engine, Geometry, BufferUsage, glContext } from '@galacean/effects-core';
import type { ShaderVariant, VertexBuffer } from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';

const { expect } = chai;

describe('webgl/vertex-buffer', () => {
  let engine: Engine;
  let device: RenderingDeviceWebGL;
  const position: Omit<VertexBuffer, 'buffer'> = {
    kind: 'aPosition',
    type: glContext.FLOAT, size: 2, byteStride: 8,
    byteOffset: 0, normalized: false, divisor: 0,
  };

  beforeEach(() => {
    engine = new Engine(document.createElement('canvas'), { glType: 'webgl2' });
    device = engine.displayServer.renderingDevice as RenderingDeviceWebGL;
  });

  afterEach(() => {
    engine.dispose();
  });

  it('keeps attribute views when their buffers are released and restored', () => {
    const first = device.createBuffer();
    const second = device.createBuffer();
    const positionView = { ...position, buffer: first };
    const offsetView = { ...position, kind: 'aOffset', buffer: second, byteStride: 12, size: 3, divisor: 2 };
    const description = {
      data: new Float32Array([0, 1, 2, 3]), usage: BufferUsage.Dynamic,
      type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0,
    };

    first.initialize(description);
    second.initialize({ ...description, data: new Float32Array([1, 2, 3]), byteStride: 12, instanceDivisor: 2 });
    const geometry = new Geometry(engine);

    geometry.setVerticesBuffer(positionView);
    geometry.setVerticesBuffer(offsetView);
    expect(geometry.getVertexBuffer('aPosition')).equals(positionView);
    expect(geometry.getAttributeStride('aOffset')).equals(12);
    expect(geometry.getVertexBuffer('aOffset')?.buffer).equals(second);
    first.releaseGPU();
    expect(geometry.getVertexBuffer('aPosition')).equals(positionView);
    expect(geometry.getAttributeStride('aPosition')).equals(8);
    first.initialize(description);
    expect(geometry.getVertexBuffer('aPosition')).equals(positionView);
    expect(geometry.getVertexBuffer('aPosition')?.buffer).equals(first);
    geometry.dispose();
    expect(first.isDestroyed).equals(false);
    first.dispose();
    second.dispose();
  });

  it('binds independent views of the same buffer with and without VAOs', () => {
    const buffer = device.createBuffer();

    buffer.initialize({
      data: new Float32Array(8), usage: BufferUsage.Static,
      type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0,
    });
    const first = new Geometry(engine);
    const second = new Geometry(engine);
    const shader = {
      key: 'shared-buffer-view-test',
      program: {
        getAttributesNames: () => ['aPosition'],
        getAttributeLocation: () => 0,
      },
    } as unknown as ShaderVariant;
    const gl = device.gl;

    first.setVerticesBuffer({ ...position, buffer });
    second.setVerticesBuffer({ ...position, buffer, byteStride: 16, byteOffset: 8, divisor: 2 });
    for (const useVAO of [false, true]) {
      for (const geometry of [first, second, first]) {
        if (useVAO) {
          geometry.bind(shader);
        } else {
          device.bindBuffers(geometry.getVertexBuffers(), null, shader);
        }
        expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).equals(buffer.underlyingResource);
        expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).equals(geometry === first ? 8 : 16);
        expect(gl.getVertexAttribOffset(0, gl.VERTEX_ATTRIB_ARRAY_POINTER)).equals(geometry === first ? 0 : 8);
        expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).equals(geometry === first ? 0 : 2);
        expect(gl.getError()).equals(gl.NO_ERROR);
      }
    }
    first.dispose();
    second.dispose();
    buffer.dispose();
  });

  it('binds interleaved attributes and an instanced stream by name', () => {
    const geometry = new Geometry(engine, {
      attributes: {
        aPosition: { data: new Float32Array(8), size: 2, stride: 16 },
        aUV: { dataSource: 'aPosition', size: 2, type: glContext.FLOAT, stride: 16, offset: 8 },
        aInstance: { data: new Float32Array([1, 2, 3]), size: 3, instanceDivisor: 1 },
      },
    });
    const buffers = geometry.getVertexBuffers();
    const shader = {
      key: 'vertex-buffer-test',
      program: {
        getAttributesNames: () => ['aUV', 'aInstance', 'aPosition'],
        getAttributeLocation: (index: number) => index,
      },
    } as unknown as ShaderVariant;
    const vao = device.recordVertexArrayObject(buffers, null, shader)!;
    const gl = device.gl;

    expect(buffers.aPosition.buffer).equals(buffers.aUV.buffer);
    device.bindVertexArrayObject(vao, null);
    expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).equals(buffers.aUV.buffer.underlyingResource);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).equals(buffers.aInstance.buffer.underlyingResource);
    expect(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).equals(16);
    expect(gl.getVertexAttribOffset(0, gl.VERTEX_ATTRIB_ARRAY_POINTER)).equals(8);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).equals(12);
    expect(gl.getVertexAttrib(1, gl.VERTEX_ATTRIB_ARRAY_DIVISOR)).equals(1);
    expect(gl.getError()).equals(gl.NO_ERROR);
    device.releaseVertexArrayObject(vao);
    geometry.dispose();
  });
});
