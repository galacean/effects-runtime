// @ts-nocheck
import { GLEngine, GLGPUBuffer, GLPipelineContext } from '@galacean/effects-webgl';
import { getGL2 } from './gl-utils';
import { isWebGL2 } from '@galacean/effects';

const { assert, expect } = chai;

describe('gl-gpu-buffer', () => {
  let gl, pipelineContext, engine;

  before(() => {
    gl = getGL2();
    engine = new GLEngine(gl);
    pipelineContext = new GLPipelineContext(engine, gl);
  });

  after(() => {
    gl.canvas.remove();
    gl = null;
    engine.dispose();
    pipelineContext.dispose();
  });

  it('create with options', () => {
    const buffer = new GLGPUBuffer(pipelineContext, {});

    assert.equal(buffer.type, gl.FLOAT);
    assert.equal(buffer.elementCount, 0);
    assert.equal(buffer.target, gl.ARRAY_BUFFER);
    assert.equal(buffer.bytesPerElement, Float32Array.BYTES_PER_ELEMENT);
    assert.equal(buffer.byteLength, 0);

    const buffer2 = new GLGPUBuffer(pipelineContext, { type: gl.INT, elementCount: 4, target: gl.ELEMENT_ARRAY_BUFFER });

    assert.equal(buffer2.byteLength, 4 * Int32Array.BYTES_PER_ELEMENT);
    assert.equal(buffer2.elementCount, 4);
    assert.equal(buffer2.type, gl.INT);
    assert.equal(buffer2.target, gl.ELEMENT_ARRAY_BUFFER);
  });

  it('buffer subData increase buffer length', () => {
    const buffer = new GLGPUBuffer(pipelineContext, { type: gl.FLOAT });

    gl.getError();
    buffer.bufferSubData(5, new Float32Array([1, 2, 3]));
    expect(buffer.byteLength).to.eql(8 * Float32Array.BYTES_PER_ELEMENT);
    expect(gl.getError()).to.eql(0);
  });

  it('set element count when filled data', () => {
    const buffer = new GLGPUBuffer(pipelineContext, {
      type: gl.SHORT,
      data: new Uint16Array([1, 2, 3, 4]),
    });

    assert.equal(buffer.bytesPerElement, Uint16Array.BYTES_PER_ELEMENT);
    assert.equal(buffer.elementCount, 4);

    if (isWebGL2(buffer.pipelineContext.gl)) {
      const dstBuffer = new Uint16Array(4);

      buffer.readSubData(0, dstBuffer);
      expect(dstBuffer).is.deep.equal(new Uint16Array([1, 2, 3, 4]));
    }
  });

  it('get data with offset', () => {
    const buffer = new GLGPUBuffer(pipelineContext, { data: new Float32Array([1, 2, 3, 4, 5, 6]) });

    if (buffer instanceof WebGL2RenderingContext) {
      let dstBuffer = new Float32Array(2);

      buffer.readSubData(0, dstBuffer);
      expect(dstBuffer).to.eql(new Float32Array([1, 2]));
      buffer.readSubData(1, dstBuffer);
      expect(dstBuffer).to.eql(new Float32Array([2, 3]));
      buffer.readSubData(2, dstBuffer);
      expect(dstBuffer).to.eql(new Float32Array([3, 4]));

      dstBuffer = new Float32Array(3);
      const dstBuffer2 = new Float32Array(dstBuffer.buffer, Float32Array.BYTES_PER_ELEMENT);

      buffer.readSubData(0, dstBuffer2);
      expect(dstBuffer2).to.eql(new Float32Array([1, 2]));
      expect(dstBuffer).to.eql(new Float32Array([0, 1, 2]));
    }
  });
});
