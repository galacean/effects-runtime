import type { Material } from '@galacean/effects-core';
import { BufferUsage, Geometry, glContext, math } from '@galacean/effects-core';
import { GLEngine } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';

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

  it('shares one buffer between interleaved attribute views', () => {
    const geometry = createGeometry(engine);
    const position = geometry.getVertexBuffer('aPosition')!;
    const uv = geometry.getVertexBuffer('aUV')!;

    assert.strictEqual(position.buffer, uv.buffer);
    expect(position.byteStride).to.equal(4 * Float32Array.BYTES_PER_ELEMENT);
    expect(uv.byteOffset).to.equal(2 * Float32Array.BYTES_PER_ELEMENT);
    geometry.dispose();
  });

  it('uploads full and partial changes through the shared buffer', () => {
    const geometry = createGeometry(engine);

    geometry.flush();
    geometry.setAttributeSubData('aUV', 4, new Float32Array([9, 8]));
    geometry.flush();
    const result = new Float32Array(8);

    geometry.getAttributeBuffer('aPosition')!.readSubData(0, result);
    expect(result).to.deep.equal(new Float32Array([0, 1, 2, 3, 9, 8, 6, 7]));
    geometry.dispose();
  });

  it('rejects partial updates that would resize a buffer', () => {
    const geometry = createGeometry(engine);

    expect(() => geometry.setAttributeSubData('aPosition', 7, new Float32Array([1, 2]))).to.throw(RangeError);
    expect(() => geometry.setIndexSubData(5, new Uint16Array([1, 2]))).to.throw(RangeError);
    geometry.dispose();
  });

  it('replaces the index buffer when its element type changes', () => {
    const geometry = createGeometry(engine);
    const previous = geometry.getIndexBuffer();

    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    assert.notStrictEqual(geometry.getIndexBuffer(), previous);
    expect(geometry.getIndexType()).to.equal(glContext.UNSIGNED_INT);
    geometry.flush();
    const result = new Uint32Array(3);

    geometry.getIndexBuffer()!.readSubData(0, result);
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
    const source = createGeometry(engine);
    const shared = new Geometry(engine, { attributes: {}, drawCount: source.drawCount });

    source.getAttributeNames().forEach(name => {
      shared.setVertexBuffer(name, source.getVertexBuffer(name)!);
    });
    shared.flush();
    const buffer = shared.getAttributeBuffer('aPosition')!;

    source.dispose();
    expect(buffer.isDestroyed).to.equal(false);
    const result = new Float32Array(8);

    buffer.readSubData(0, result);
    expect(result).to.deep.equal(new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]));
    shared.dispose();
    expect(buffer.isDestroyed).to.equal(true);
  });

  it('disposes cached vertex array objects when the layout changes', () => {
    const geometry = createGeometry(engine);
    const resource = {
      disposed: false,
      dispose () {
        this.disposed = true;
      },
    };

    geometry.setVertexArrayObject('test-program', resource);
    geometry.setIndexData(new Uint32Array([0, 1, 2]));
    expect(resource.disposed).to.equal(true);
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
        program: {
          setupAttributes () {},
        },
      },
    } as unknown as Material;

    gl.drawElements = ((_mode, _count, _type, offset) => {
      offsets.push(offset);
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
      program: {
        setupAttributes () {},
      },
    },
  } as unknown as Material;
}
