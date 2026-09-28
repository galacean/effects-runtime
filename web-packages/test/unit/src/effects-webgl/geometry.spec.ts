import { Engine } from '@galacean/effects-core';
import type { Material, ShaderVariant } from '@galacean/effects-core';
import {
  BufferUsage, Geometry, glContext, math,
} from '@galacean/effects-core';
import type { RenderingDeviceWebGL } from '@galacean/effects-webgl';
import { GPUBufferWebGL } from '@galacean/effects-webgl';
import { getGL2, readBufferContents } from './gl-utils';

const { assert, expect } = chai;

describe('webgl/geometry', () => {
  let engine: Engine;

  beforeEach(() => {
    const gl = getGL2() as WebGL2RenderingContext;

    engine = new Engine(gl.canvas as HTMLCanvasElement, { glType: 'webgl2' });
  });

  afterEach(() => {
    const canvas = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl.canvas as HTMLCanvasElement;

    engine.dispose();
    canvas.remove();
  });

  it('creates owned GPU buffers directly and unregisters them on disposal', () => {
    const device = engine.displayServer.renderingDevice;
    const bufferCount = () => device['resources'].filter(resource => resource instanceof GPUBufferWebGL).length;
    const baseline = bufferCount();
    const geometry = createGeometry(engine);
    const buffer = geometry.getAttributeBuffer('aPosition')!;

    expect(buffer).to.be.an.instanceOf(GPUBufferWebGL);
    expect(bufferCount()).equals(baseline + 1);
    geometry.initialize();
    expect(bufferCount()).equals(baseline + 2);
    geometry.dispose();
    geometry.dispose();
    expect(buffer.isDestroyed).equals(true);
    expect(bufferCount()).equals(baseline);
  });

  it('updates only dynamic geometry buffers', () => {
    const staticGeometry = new Geometry(engine, {
      attributes: { aPosition: { data: new Float32Array([0, 1]), size: 2 } },
    });
    const dynamicGeometry = new Geometry(engine, {
      attributes: { aPosition: { data: new Float32Array([0, 1]), size: 2 } },
      bufferUsage: BufferUsage.Dynamic,
    });

    staticGeometry.setAttributeData('aPosition', new Float32Array([2, 3]));
    dynamicGeometry.setAttributeData('aPosition', new Float32Array([2, 3]));
    const staticResult = new Float32Array(2);
    const dynamicResult = new Float32Array(2);
    const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;

    readBufferContents(gl, staticGeometry.getAttributeBuffer('aPosition')!, staticResult);
    readBufferContents(gl, dynamicGeometry.getAttributeBuffer('aPosition')!, dynamicResult);
    expect(staticResult).to.deep.equal(new Float32Array([0, 1]));
    expect(dynamicResult).to.deep.equal(new Float32Array([2, 3]));
    staticGeometry.dispose();
    dynamicGeometry.dispose();
  });

  it('preserves float offset units and retains updated CPU data', () => {
    const data = new Uint16Array([0, 1, 2, 3]);
    const geometry = new Geometry(engine, {
      attributes: { aPosition: { data, size: 2 } },
      bufferUsage: BufferUsage.Dynamic,
    });

    geometry.setAttributeSubData('aPosition', 1, new Uint16Array([9]));
    const result = new Uint16Array(4);

    readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, geometry.getAttributeBuffer('aPosition')!, result);
    expect(result).to.deep.equal(new Uint16Array([0, 1, 9, 3]));
    expect(geometry.getAttributeData('aPosition')).equals(data);
    expect(data).to.deep.equal(result);
    geometry.dispose();
  });

  it('borrows external buffers by default and supports explicit ownership transfer', () => {
    const owner = createGeometry(engine);
    const buffer = owner.getAttributeBuffer('aPosition')!;
    const borrowed = new Geometry(engine);

    borrowed.setVertexBuffers(owner.getVertexBuffers(), owner.getVertexLayout());
    borrowed.dispose();
    expect(buffer.isDestroyed).equals(false);
    owner.dispose();
    expect(buffer.isDestroyed).equals(true);

    const transferred = engine.displayServer.renderingDevice.createBuffer();
    const geometry = new Geometry(engine);

    geometry.setVertexBuffers([transferred, transferred], engine.displayServer.renderingDevice.getVertexLayout([
      { name: 'aPosition', slot: 0, type: glContext.FLOAT, size: 2, byteOffset: 0, normalized: false, divisor: 0 },
      { name: 'aUV', slot: 1, type: glContext.FLOAT, size: 2, byteOffset: 0, normalized: false, divisor: 0 },
    ], [8, 8]), true);
    let disposals = 0;
    const dispose = transferred.dispose.bind(transferred);

    transferred.dispose = () => {
      disposals++;
      dispose();
    };
    geometry.dispose();
    geometry.dispose();
    expect(disposals).equals(1);
  });

  it('normalizes index data to 16 or 32 bits', () => {
    const options = {
      usage: glContext.STATIC_DRAW,
      type: glContext.INT,
      byteStride: 0,
      instanceDivisor: 0,
    };
    const small = engine.displayServer.renderingDevice.createBuffer();
    const large = engine.displayServer.renderingDevice.createBuffer();

    small.initialize({ ...options, data: new Int32Array([0, 1, 2]), index: true });
    large.initialize({ ...options, data: new Int32Array([0, 1, 65535]), index: true });

    expect(small.is32Bits).to.equal(false);
    expect(small.capacity).to.equal(3 * Uint16Array.BYTES_PER_ELEMENT);
    expect(large.is32Bits).to.equal(true);
    expect(large.capacity).to.equal(3 * Uint32Array.BYTES_PER_ELEMENT);
    small.dispose();
    large.dispose();
  });

  it('shares one buffer between interleaved attribute views', () => {
    const geometry = createGeometry(engine);
    const position = geometry.getVertexElement('aPosition')!;
    const uv = geometry.getVertexElement('aUV')!;

    assert.strictEqual(position.slot, uv.slot);
    assert.strictEqual(geometry.getAttributeBuffer('aPosition'), geometry.getAttributeBuffer('aUV'));
    expect(geometry.getVertexLayout()!.getStride(position.slot)).to.equal(4 * Float32Array.BYTES_PER_ELEMENT);
    expect(uv.byteOffset).to.equal(2 * Float32Array.BYTES_PER_ELEMENT);
    geometry.dispose();
  });

  it('keeps a shared source buffer alive until its last attribute view is replaced', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    const sharedBuffer = geometry.getAttributeBuffer('aPosition')!;
    const dataBuffer = sharedBuffer;

    geometry.setAttribute('aUV', { data: new Float32Array([0, 1, 2, 3]), size: 2 });
    expect(sharedBuffer.isDestroyed).to.equal(false);
    expect(geometry.getAttributeBuffer('aPosition')!).to.equal(dataBuffer);

    geometry.setAttribute('aPosition', { data: new Float32Array([0, 1, 2, 3]), size: 2 });
    expect(sharedBuffer.isDestroyed).to.equal(true);
    geometry.dispose();
  });

  it('uploads full and partial changes through the shared buffer', () => {
    const geometry = createGeometry(engine);

    geometry.flush();
    const dataBuffer = geometry.getAttributeBuffer('aPosition')!;
    const capacity = dataBuffer.capacity;

    geometry.setAttributeSubData('aPosition', 0, new Float32Array([8, 9]));
    geometry.setAttributeSubData('aUV', 4, new Float32Array([9, 8]));
    geometry.flush();
    const result = new Float32Array(8);

    readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, dataBuffer, result);
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
    expect(geometry.getAttributeData('aPosition')).to.deep.equal(new Float32Array([9, 8, 2, 3, 4, 5, 6, 7]));
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
    const updateDynamicIndexBuffer = engine.displayServer.renderingDevice.updateDynamicIndexBuffer.bind(engine.displayServer.renderingDevice);
    const indexBuffer = geometry.getIndexBuffer()!;
    const capacity = indexBuffer.capacity;
    let uploadedByteLength = 0;
    let uploadedByteOffset = 0;

    engine.displayServer.renderingDevice.updateDynamicIndexBuffer = (indexBuffer, indices, byteOffset = 0) => {
      uploadedByteLength = Array.isArray(indices)
        ? indices.length * Float32Array.BYTES_PER_ELEMENT
        : indices.byteLength;
      uploadedByteOffset = byteOffset;
      updateDynamicIndexBuffer(indexBuffer, indices, byteOffset);
    };
    geometry.setIndexSubData(0, new Uint16Array([2, 1, 0]));
    geometry.setIndexSubData(3, new Uint16Array([0, 2, 1]));
    const result = new Uint16Array(6);

    readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, indexBuffer, result, 0, true);
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

    expect(previous).to.be.an.instanceOf(GPUBufferWebGL);
    assert.strictEqual(geometry.getIndexData(), geometry.getIndexData());
    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    assert.notStrictEqual(geometry.getIndexBuffer(), previous);
    expect(geometry.getIndexType()).to.equal(glContext.UNSIGNED_INT);
    const result = new Uint32Array(3);

    readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, geometry.getIndexBuffer()!, result, 0, true);
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

  it('leaves externally shared buffers and their restoration to the owner', () => {
    const data = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const buffer = engine.displayServer.renderingDevice.createBuffer();
    const description = { data, usage: BufferUsage.Static, type: glContext.FLOAT, byteStride: 8, instanceDivisor: 0 };

    buffer.initialize(description);
    const layout = engine.displayServer.renderingDevice.getVertexLayout([
      { name: 'aPosition', slot: 0, type: glContext.FLOAT, size: 2, byteOffset: 0, normalized: false, divisor: 0 },
    ], [8]);
    const first = new Geometry(engine, { attributes: {}, drawCount: 4 });
    const second = new Geometry(engine, { attributes: {}, drawCount: 4 });

    first.setVertexBuffers([buffer], layout);
    second.setVertexBuffers([buffer], layout);
    first.initialize();
    second.initialize();
    buffer.releaseGPU();
    first.restore();
    second.restore();
    expect(buffer.underlyingResource).equals(null);
    buffer.initialize(description);
    first.dispose();
    expect(buffer.isDestroyed).equals(false);
    const result = new Float32Array(8);

    readBufferContents((engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl, buffer, result);
    expect(result).to.deep.equal(data);
    second.dispose();
    expect(buffer.isDestroyed).equals(false);
    buffer.dispose();
    expect(buffer.isDestroyed).equals(true);
  });

  it('restores shared CPU contents after partial updates without replacing the GPUBuffer', () => {
    const geometry = createGeometry(engine);

    geometry.initialize();
    const buffer = geometry.getAttributeBuffer('aPosition')!;
    const capacity = buffer.capacity;
    const device = engine.displayServer.renderingDevice;
    const baseline = device['resources'].length;
    const handle = buffer.underlyingResource;
    const cpuData = geometry.getAttributeData('aPosition');

    geometry.setAttributeSubData('aUV', 2, new Float32Array([9, 8]));
    geometry.restore();
    const result = new Float32Array(8);

    readBufferContents((device as RenderingDeviceWebGL).gl, buffer, result);
    expect(result).deep.equals(new Float32Array([0, 1, 9, 8, 4, 5, 6, 7]));
    assert.strictEqual(geometry.getAttributeBuffer('aPosition'), buffer);
    assert.strictEqual(geometry.getAttributeData('aPosition'), cpuData);
    assert.strictEqual(geometry.getAttributeData('aUV'), cpuData);
    assert.notStrictEqual(buffer.underlyingResource, handle);
    expect(device['resources'].length).equals(baseline);
    expect(buffer.capacity).to.equal(capacity);
    geometry.dispose();
  });

  it('disposes cached vertex array objects when the layout changes', () => {
    const geometry = createGeometry(engine);
    const resource = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl.createVertexArray()!;
    const releaseVertexArrayObject = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).releaseVertexArrayObject.bind(engine.displayServer.renderingDevice);
    let released = false;

    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).releaseVertexArrayObject = vertexArrayObject => {
      released = vertexArrayObject === resource;
      releaseVertexArrayObject(vertexArrayObject);
    };
    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).recordVertexArrayObject = () => resource;
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    expect(released).to.equal(true);
    geometry.dispose();
  });

  it('disposes cached vertex array objects when vertex data changes', () => {
    const geometry = createGeometry(engine);
    const resource = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl.createVertexArray()!;
    const releaseVertexArrayObject = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).releaseVertexArrayObject.bind(engine.displayServer.renderingDevice);
    let released = false;

    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).releaseVertexArrayObject = vertexArrayObject => {
      released = vertexArrayObject === resource;
      releaseVertexArrayObject(vertexArrayObject);
    };
    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).recordVertexArrayObject = () => resource;
    geometry.bind({ key: 'test-program' } as ShaderVariant);
    geometry.setAttributeSubData('aPosition', 0, new Float32Array([1, 2]));
    expect(released).to.equal(true);
    geometry.dispose();
  });

  it('discards cached vertex array objects without releasing them during restore', () => {
    const geometry = createGeometry(engine);
    const resource = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl.createVertexArray()!;
    let released = false;
    let recorded = 0;

    geometry.initialize();
    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).releaseVertexArrayObject = () => {
      released = true;
    };
    (engine.displayServer.renderingDevice as RenderingDeviceWebGL).recordVertexArrayObject = () => {
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
    const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
    const originalDrawElements = gl.drawElements;
    const offsets: number[] = [];
    const types: number[] = [];
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
      types.push(args[2]);
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

        engine.renderer.drawGeometry(geometry, math.Matrix4.IDENTITY, material);
        expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).to.equal(null);
        geometry.dispose();
      });
    } finally {
      gl.drawElements = originalDrawElements;
    }
    expect(offsets).to.deep.equal([
      Uint16Array.BYTES_PER_ELEMENT,
      Uint32Array.BYTES_PER_ELEMENT,
    ]);
    expect(types).to.deep.equal([gl.UNSIGNED_SHORT, gl.UNSIGNED_INT]);
  });

  it('draws unindexed sub-mesh ranges through the renderer', () => {
    const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
    const originalDrawArrays = gl.drawArrays;
    const calls: number[][] = [];
    const geometry = new Geometry(engine, {
      attributes: {
        aPosition: {
          data: new Float32Array([0, 0, 1, 0, 0, 1]),
          size: 2,
        },
      },
      drawCount: 3,
      mode: glContext.TRIANGLES,
    });

    geometry.subMeshes = [{ offset: 1, indexCount: 0, vertexCount: 2 }];
    gl.drawArrays = ((...args) => {
      calls.push(args);
    }) as typeof gl.drawArrays;
    try {
      engine.renderer.drawGeometry(
        geometry,
        math.Matrix4.IDENTITY,
        createMaterialStub(),
      );
      expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).to.equal(null);
    } finally {
      gl.drawArrays = originalDrawArrays;
      geometry.dispose();
    }
    expect(calls).to.deep.equal([[gl.TRIANGLES, 1, 2]]);
  });

  it('protects a cached vertex array while creating another geometry', () => {
    const gl = (engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
    const material = createMaterialStub();
    const firstGeometry = createGeometry(engine);
    const secondGeometry = createGeometry(engine);

    engine.renderer.drawGeometry(firstGeometry, math.Matrix4.IDENTITY, material);
    // @ts-expect-error Verify the cached VAO remains usable after the renderer unbinds it.
    const vertexArrayObject = firstGeometry.vertexArrayObjects[material.shaderVariant.key] as WebGLVertexArrayObject;
    const indexResource = firstGeometry.getIndexBuffer()!.underlyingResource;

    expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).to.equal(null);
    secondGeometry.initialize();
    expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).to.equal(null);
    gl.bindVertexArray(vertexArrayObject);
    expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).to.equal(indexResource);
    gl.bindVertexArray(null);
    firstGeometry.dispose();
    secondGeometry.dispose();
  });

  it('rejects instanced drawing when it is unsupported', () => {
    const geometry = createGeometry(engine);

    geometry.instanceCount = 2;
    Object.defineProperty(engine.displayServer.renderingDevice.gpuCapability.detail, 'instanceDraw', { value: false });
    expect(() => engine.renderer.drawGeometry(
      geometry,
      math.Matrix4.IDENTITY,
      createMaterialStub(),
    )).to.throw('Instanced drawing is not supported by the current graphics context.');
    geometry.dispose();
  });
});

function createGeometry (engine: Engine): Geometry {
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
