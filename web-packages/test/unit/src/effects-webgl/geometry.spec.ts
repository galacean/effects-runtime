import type { Material, ShaderVariant } from '@galacean/effects-core';
import {
  Buffer, BufferUsage, Geometry, VertexBuffer, glContext, math,
} from '@galacean/effects-core';
import { GLDataBuffer, GLEngine } from '@galacean/effects-webgl';
import { getGL2, readBufferContents } from './gl-utils';

const { assert, expect } = chai;

describe('webgl/geometry', () => {
  let engine: GLEngine;

  beforeEach(() => {
    const gl = getGL2() as WebGL2RenderingContext;

    engine = new GLEngine(gl.canvas as HTMLCanvasElement, { glType: 'webgl2' });
  });

  afterEach(() => {
    const canvas = engine.gl.canvas as HTMLCanvasElement;

    engine.dispose();
    canvas.remove();
  });

  it('creates buffers immediately unless creation is postponed', () => {
    const immediate = new Buffer(engine, new Float32Array([0, 1]), false, 2);
    const postponed = new Buffer(engine, new Float32Array([0, 1]), false, 2, true);

    expect(immediate.getBuffer()).to.be.an.instanceOf(GLDataBuffer);
    expect(postponed.getBuffer()).to.equal(undefined);
    postponed.create();
    expect(postponed.getBuffer()).to.be.an.instanceOf(GLDataBuffer);
    immediate.dispose();
    postponed.dispose();
  });

  it('updates only updatable buffers', () => {
    const staticBuffer = new Buffer(engine, new Float32Array([0, 1]), false, 2);
    const dynamicBuffer = new Buffer(engine, new Float32Array([0, 1]), true, 2);

    staticBuffer.update(new Float32Array([2, 3]));
    dynamicBuffer.update(new Float32Array([2, 3]));
    const staticResult = new Float32Array(2);
    const dynamicResult = new Float32Array(2);

    readBufferContents(engine.gl, staticBuffer.getBuffer()!, staticResult);
    readBufferContents(engine.gl, dynamicBuffer.getBuffer()!, dynamicResult);
    expect(staticResult).to.deep.equal(new Float32Array([0, 1]));
    expect(dynamicResult).to.deep.equal(new Float32Array([2, 3]));
    staticBuffer.dispose();
    dynamicBuffer.dispose();
  });

  it('uses float units for direct update offsets and releases partial CPU data', () => {
    const buffer = new Buffer(engine, new Uint16Array([0, 1, 2, 3]), true, 2);

    buffer.updateDirectly(new Uint16Array([9]), 1);
    const result = new Uint16Array(4);

    readBufferContents(engine.gl, buffer.getBuffer()!, result);
    expect(result).to.deep.equal(new Uint16Array([0, 1, 9, 3]));
    expect(buffer.getData()).to.equal(undefined);
    buffer.dispose();
  });

  it('creates vertex buffers from raw and native buffer data', () => {
    const raw = new VertexBuffer(
      engine,
      new Float32Array([0, 1, 2, 3]),
      'aPosition',
      { size: 2 },
    );
    const dataBuffer = engine.createVertexBuffer(new Float32Array([0, 1]), {
      usage: glContext.STATIC_DRAW,
      type: glContext.FLOAT,
      byteStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      instanceDivisor: 0,
    });
    const native = new VertexBuffer(engine, dataBuffer, 'aUV', { size: 2 });

    expect(raw.getBuffer()).to.be.an.instanceOf(GLDataBuffer);
    expect(native.getBuffer()).to.equal(dataBuffer);
    raw.dispose();
    native.dispose();
  });

  it('keeps ownership in buffers that create vertex buffer views', () => {
    const buffer = new Buffer(engine, new Float32Array([0, 1]), false, 2);
    const vertexBuffer = buffer.createVertexBuffer('aPosition', 0, 2);

    vertexBuffer.dispose();
    expect(buffer.isDisposed).to.equal(false);
    buffer.dispose();
    expect(buffer.isDisposed).to.equal(true);
  });

  it('normalizes index data to 16 or 32 bits', () => {
    const options = {
      usage: glContext.STATIC_DRAW,
      type: glContext.INT,
      byteStride: 0,
      instanceDivisor: 0,
    };
    const small = engine.createIndexBuffer(new Int32Array([0, 1, 2]), options);
    const large = engine.createIndexBuffer(new Int32Array([0, 1, 65535]), options);

    expect(small.is32Bits).to.equal(false);
    expect(small.capacity).to.equal(3 * Uint16Array.BYTES_PER_ELEMENT);
    expect(large.is32Bits).to.equal(true);
    expect(large.capacity).to.equal(3 * Uint32Array.BYTES_PER_ELEMENT);
    engine.releaseBuffer(small);
    engine.releaseBuffer(large);
  });

  it('shares one buffer between interleaved attribute views', () => {
    const geometry = createGeometry(engine);
    const position = geometry.getVertexBuffer('aPosition')!;
    const uv = geometry.getVertexBuffer('aUV')!;

    assert.strictEqual(position.getWrapperBuffer(), uv.getWrapperBuffer());
    expect(position.byteStride).to.equal(4 * Float32Array.BYTES_PER_ELEMENT);
    expect(uv.byteOffset).to.equal(2 * Float32Array.BYTES_PER_ELEMENT);
    geometry.dispose();
  });

  it('uploads full and partial changes through the shared buffer', () => {
    const geometry = createGeometry(engine);

    geometry.flush();
    const dataBuffer = geometry.getVertexBuffer('aPosition')!.getBuffer()!;
    const capacity = dataBuffer.capacity;

    geometry.setAttributeSubData('aPosition', 0, new Float32Array([8, 9]));
    geometry.setAttributeSubData('aUV', 4, new Float32Array([9, 8]));
    geometry.flush();
    const result = new Float32Array(8);

    readBufferContents(engine.gl, dataBuffer, result);
    expect(dataBuffer.capacity).to.equal(capacity);
    expect(result).to.deep.equal(new Float32Array([8, 9, 2, 3, 9, 8, 6, 7]));
    geometry.dispose();
  });

  it('keeps buffer capacity after attribute subdata updates at offset zero', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    const buffer = geometry.getAttributeBuffer('aPosition')!;
    const capacity = buffer.capacity;

    geometry.setAttributeSubData('aPosition', 0, new Float32Array([9, 8]));
    expect(buffer.getData()).to.equal(undefined);
    geometry.restore();
    expect(buffer.capacity).to.equal(capacity);
    geometry.dispose();
  });

  it('rejects partial updates that would resize a buffer', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    expect(() => geometry.setAttributeSubData('aPosition', 7, new Float32Array([1, 2]))).to.throw(RangeError);
    expect(() => geometry.setIndexSubData(5, new Uint16Array([1, 2]))).to.throw(RangeError);
    geometry.dispose();
  });

  it('uploads only the changed index range', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    const updateDynamicIndexBuffer = engine.updateDynamicIndexBuffer.bind(engine);
    const indexBuffer = geometry.getIndexBuffer()!;
    const capacity = indexBuffer.capacity;
    let uploadedByteLength = 0;
    let uploadedByteOffset = 0;

    engine.updateDynamicIndexBuffer = (indexBuffer, indices, byteOffset = 0) => {
      uploadedByteLength = Array.isArray(indices)
        ? indices.length * Float32Array.BYTES_PER_ELEMENT
        : indices.byteLength;
      uploadedByteOffset = byteOffset;
      updateDynamicIndexBuffer(indexBuffer, indices, byteOffset);
    };
    geometry.setIndexSubData(0, new Uint16Array([2, 1, 0]));
    geometry.setIndexSubData(3, new Uint16Array([0, 2, 1]));
    const result = new Uint16Array(6);

    readBufferContents(engine.gl, indexBuffer, result, 0, true);
    expect(indexBuffer.capacity).to.equal(capacity);
    expect(uploadedByteLength).to.equal(3 * Uint16Array.BYTES_PER_ELEMENT);
    expect(uploadedByteOffset).to.equal(3 * Uint16Array.BYTES_PER_ELEMENT);
    expect(result).to.deep.equal(new Uint16Array([2, 1, 0, 0, 2, 1]));
    geometry.dispose();
  });

  it('replaces the index buffer when its element type changes', () => {
    const geometry = createGeometry(engine);

    geometry.flush();
    const previous = geometry.getIndexBuffer();

    expect(previous).to.be.an.instanceOf(GLDataBuffer);
    assert.strictEqual(geometry.getIndexData(), geometry.getIndexData());
    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    assert.notStrictEqual(geometry.getIndexBuffer(), previous);
    expect(geometry.getIndexType()).to.equal(glContext.UNSIGNED_INT);
    const result = new Uint32Array(3);

    readBufferContents(engine.gl, geometry.getIndexBuffer()!, result, 0, true);
    expect(result).to.deep.equal(new Uint32Array([0, 1, 2]));
    geometry.dispose();
  });

  it('keeps the existing sub-mesh contract unchanged', () => {
    const geometry = createGeometry(engine);
    const subMeshes = [{ offset: 2, indexCount: 3, vertexCount: 4 }];

    geometry.subMeshes = subMeshes;
    assert.strictEqual(geometry.subMeshes, subMeshes);
    geometry.dispose();
  });

  it('keeps shared buffers alive until the last geometry is disposed', () => {
    const data = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const buffer = new Buffer(engine, data, false, 2);
    const vertexBuffer = new VertexBuffer(engine, buffer, 'aPosition', {
      size: 2,
      takeBufferOwnership: true,
    });
    const source = new Geometry(engine, { attributes: {}, drawCount: 4 });
    const shared = new Geometry(engine, { attributes: {}, drawCount: 4 });

    source.setVerticesBuffer(vertexBuffer);
    shared.setVerticesBuffer(vertexBuffer);

    source.dispose();
    expect(buffer.isDisposed).to.equal(false);
    const result = new Float32Array(8);

    readBufferContents(engine.gl, buffer.getBuffer()!, result);
    expect(result).to.deep.equal(data);
    shared.dispose();
    expect(buffer.isDisposed).to.equal(true);
  });

  it('restores buffer capacity when CPU data is unavailable', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    const buffer = geometry.getAttributeBuffer('aPosition')!;
    const previousDataBuffer = buffer.getBuffer()!;
    const capacity = previousDataBuffer.capacity;

    buffer.updateDirectly(new Float32Array([0]), 0, 1);
    geometry.restore();

    assert.notStrictEqual(buffer.getBuffer(), previousDataBuffer);
    expect(buffer.getBuffer()!.capacity).to.equal(capacity);
    expect(buffer.getData()).to.equal(undefined);
    geometry.dispose();
  });

  it('disposes cached vertex array objects when the layout changes', () => {
    const geometry = createGeometry(engine);
    const resource = engine.gl.createVertexArray()!;
    const releaseVertexArrayObject = engine.releaseVertexArrayObject.bind(engine);
    let released = false;

    engine.releaseVertexArrayObject = vertexArrayObject => {
      released = vertexArrayObject === resource;
      releaseVertexArrayObject(vertexArrayObject);
    };
    engine.recordVertexArrayObject = () => resource;
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    expect(released).to.equal(true);
    geometry.dispose();
  });

  it('disposes cached vertex array objects when vertex data changes', () => {
    const geometry = createGeometry(engine);
    const resource = engine.gl.createVertexArray()!;
    const releaseVertexArrayObject = engine.releaseVertexArrayObject.bind(engine);
    let released = false;

    engine.releaseVertexArrayObject = vertexArrayObject => {
      released = vertexArrayObject === resource;
      releaseVertexArrayObject(vertexArrayObject);
    };
    engine.recordVertexArrayObject = () => resource;
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    geometry.setAttributeSubData('aPosition', 0, new Float32Array([1, 2]));
    expect(released).to.equal(true);
    geometry.dispose();
  });

  it('discards cached vertex array objects without releasing them during restore', () => {
    const geometry = createGeometry(engine);
    const resource = engine.gl.createVertexArray()!;
    let released = false;
    let recorded = 0;

    geometry.initialize();
    engine.releaseVertexArrayObject = () => {
      released = true;
    };
    engine.recordVertexArrayObject = () => {
      recorded++;

      return resource;
    };
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    geometry.restore();
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    expect(released).to.equal(false);
    expect(recorded).to.equal(2);
    geometry.dispose();
  });

  it('keeps indexed drawStart in bytes', () => {
    const gl = engine.gl;
    const originalDrawElements = gl.drawElements;
    const offsets: number[] = [];
    const material = {
      initialize () {},
      setMatrix () {},
      use () {},
      shaderVariant: {
        key: 'draw-start-test',
        program: {
          getAttributesNames: () => [],
          getAttributeLocation: () => -1,
        },
      },
    } as unknown as Material;

    gl.drawElements = ((...args) => {
      offsets.push(args[3]);
    }) as typeof gl.drawElements;
    try {
      [
        new Uint16Array([0, 1, 2]),
        new Uint32Array([0, 1, 2]),
      ].forEach(indices => {
        const geometry = new Geometry(engine, {
          attributes: {
            aPosition: {
              data: new Float32Array([0, 0, 1, 0, 0, 1]),
              size: 2,
            },
          },
          indices: { data: indices },
          drawStart: indices.BYTES_PER_ELEMENT,
          drawCount: indices.length - 1,
        });

        engine.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
        geometry.dispose();
      });
    } finally {
      gl.drawElements = originalDrawElements;
    }
    expect(offsets).to.deep.equal([
      Uint16Array.BYTES_PER_ELEMENT,
      Uint32Array.BYTES_PER_ELEMENT,
    ]);
  });

  it('rejects instanced drawing when it is unsupported', () => {
    const geometry = createGeometry(engine);

    geometry.instanceCount = 2;
    Object.defineProperty(engine.gpuCapability.detail, 'instanceDraw', { value: false });
    expect(() => engine.drawGeometry(
      geometry,
      math.Matrix4.IDENTITY,
      createMaterialStub(),
    )).to.throw('Instanced drawing is not supported by the current graphics context.');
    geometry.dispose();
  });
});

function createGeometry (engine: GLEngine): Geometry {
  return new Geometry(engine, {
    attributes: {
      aPosition: {
        data: new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]),
        size: 2,
        stride: 4 * Float32Array.BYTES_PER_ELEMENT,
      },
      aUV: {
        dataSource: 'aPosition',
        type: glContext.FLOAT,
        size: 2,
        stride: 4 * Float32Array.BYTES_PER_ELEMENT,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
      },
    },
    indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
    bufferUsage: BufferUsage.Dynamic,
    drawCount: 6,
    mode: glContext.TRIANGLES,
  });
}

function createMaterialStub (): Material {
  return {
    initialize () {},
    setMatrix () {},
    use () {},
    shaderVariant: {
      key: 'geometry-test',
      program: {
        getAttributesNames: () => [],
        getAttributeLocation: () => -1,
      },
    },
  } as unknown as Material;
}
