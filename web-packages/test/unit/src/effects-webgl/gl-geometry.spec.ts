// @ts-nocheck
import { glContext, Camera, RenderFrame, RenderPass, Mesh } from '@galacean/effects-core';
import { GLMaterial, GLGeometry, GLRenderer, GLVertexArrayObject } from '@galacean/effects-webgl';

const { assert, expect } = chai;

describe('webgl/gl-geometry', () => {
  let canvas, glRenderer, gl, renderer, pipelineContext;
  const option = {
    name: 'geo1',
    mode: glContext.TRIANGLES, // mode
    drawCount: 6, // count
    drawStart: 0, // offset
    attributes: {
      'aPosition': {
        size: 2,
        type: glContext.FLOAT,
        stride: 0,
        offset: 0,
        data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
      },
    },
    indices: {
      data: new Uint16Array([0, 1, 3, 1, 2, 3]),
    },
  };
  const geometry = new GLGeometry(undefined, option);

  before(() => {
    canvas = document.createElement('canvas');
    renderer = new GLRenderer(canvas, 'webgl2');
    glRenderer = renderer.glRenderer;
    pipelineContext = renderer.pipelineContext;

    gl = pipelineContext.gl;
  });

  after(() => {
    renderer.dispose();
    renderer = null;
    canvas.remove();
    canvas = null;
    gl = null;
    glRenderer = null;
    pipelineContext.dispose();
  });

  // GLGeometry涉及三个WebGL函数
  // bufferData(target, ArrayBufferView srcData, usage, srcOffset, length)
  // vertexAttribPointer(index, size, type, normalized, stride, offset)
  // drawElements(mode, count, type, offset)
  // 前五个测试使用同一个geometry，测试geometry调用initialize后传入的参数是否设置到对应属性上
  it('set geometry attributes, index and vao', () => {
    geometry.engine = renderer.engine;
    geometry.initialize();
    assert.notEqual(geometry.bufferProps['aPosition'], undefined);
    assert.notEqual(geometry.indices, undefined);
    assert.equal(geometry.drawCount, 6);
    assert.equal(geometry.drawStart, 0);
    assert.equal(geometry.mode, glContext.TRIANGLES);
    assert.equal(geometry.attributes['aPosition'].size, option.attributes['aPosition'].size);
    assert.equal(geometry.attributes['aPosition'].type, option.attributes['aPosition'].type);
    assert.equal(geometry.attributes['aPosition'].stride, option.attributes['aPosition'].stride);
    assert.equal(geometry.attributes['aPosition'].offset, option.attributes['aPosition'].offset);
  });

  it('test attribute data and buffer', () => {
    // 顶点属性初始化
    const buffer = geometry.getAttributeBuffer('aPosition');

    assert.equal(buffer.byteLength, 32);
    assert.equal(buffer.bytesPerElement, 4);
    assert.equal(buffer.elementCount, 8);
    assert.equal(buffer.target, glContext.ARRAY_BUFFER);

    // 读取顶点属性数据
    buffer.bind();
    const readData = new Float32Array(2);
    const result = buffer.readSubData(0, readData);

    assert.equal(result, true);
    assert.equal(readData[1], -0.5);
  });

  it('test index buffer', () => {
    // 读取索引数据
    const indexBuffer = geometry.indicesBuffer;

    indexBuffer.bind();

    assert.equal(indexBuffer.byteLength, 12);
    assert.equal(indexBuffer.bytesPerElement, 2);
    assert.equal(indexBuffer.elementCount, 6);
    assert.equal(indexBuffer.target, glContext.ELEMENT_ARRAY_BUFFER);
  });

  it('test vertex array object', () => {
    const vao = glRenderer.createVAO('test');

    expect(vao).to.be.an.instanceof(GLVertexArrayObject);
  });

  it('test destory', () => {
    geometry.dispose();

    expect(geometry.isDestroyed).to.be.true;
    assert.equal(geometry.attributes['aPosition'], undefined);
    assert.equal(geometry.mode, glContext.TRIANGLES);
    assert.equal(geometry.renderer, undefined);

    expect(Object.values(geometry.vaos).filter(f => f)).to.deep.equals([]);
    assert.equal(geometry.bufferProps['aPosition'], undefined);
    assert.equal(geometry.indices, undefined);
    assert.equal(geometry.indicesBuffer, undefined);
  });

  // 创建时不提供dataSource
  it('create separate buffer when dataSource not provided', function () {
    const geometry = new GLGeometry(renderer.engine, {
      attributes: {
        'aPosition': {
          size: 2,
          type: glContext.FLOAT,
        },
        'aUV': {
          size: 2,
          data: new Float32Array(2),
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
    });
    const ap = geometry.getAttributeBuffer('aPosition');

    geometry.initialize();
    expect(geometry.getAttributeNames()).to.include('aPosition');
    expect(geometry.getAttributeNames()).to.include('aUV');
    expect(geometry.getAttributeData('aPosition')).to.deep.equal(new Float32Array(0));
    expect(geometry.getAttributeData('aUV')).to.deep.equal(new Float32Array(2));
    geometry.dispose();
  });

  // 创建geometry后设置drawCount和drawStart
  it('reset drawCount and drawStart', function () {
    const option = {
      name: 'ReactangleGeometry',
      attributes: {
        'aPosition': {
          data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
      drawCount: 6,
      drawStart: 0,
      mode: glContext.TRIANGLES,
    };
    const geometry = new GLGeometry(renderer.engine, option);

    expect(geometry.drawCount).to.eql(6);
    expect(geometry.drawStart).to.eql(0);
    geometry.initialize();
    geometry.drawCount = 10086;
    geometry.drawStart = 123;
    geometry.mode = 456;
    expect(geometry.drawCount).to.eql(10086);
    expect(geometry.drawStart).to.eql(123);
    expect(geometry.mode).to.eql(456);
    geometry.dispose();
  });

  // geometry initialize之前设置attribute
  it('set attribute before initialize', function () {
    const option = {
      name: 'ReactangleGeometry',
      attributes: {
        'aPosition': {
          data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
      drawCount: 6,
      drawStart: 0,
      mode: glContext.TRIANGLES,
    };
    const geometry = new GLGeometry(renderer.engine, option);

    // assignRenderer之前attribute buffer为undfined
    const buffer = geometry.getAttributeBuffer('aPosition');

    assert.equal(buffer, undefined);

    expect(geometry.attributes['aPosition'].size).to.eql(2);
    expect(geometry.getAttributeStride('aPosition')).to.eql(2 * Float32Array.BYTES_PER_ELEMENT);
    // 包含属性名称
    const attributesName = geometry.getAttributeNames();
    const attributeData = geometry.getAttributeData('aPosition');
    const attributeSize = attributeData.length;

    assert.equal(attributesName[0], 'aPosition');
    assert.equal(attributeSize, 8);
    assert.notEqual(attributeData, undefined);
    assert.equal(attributeData[0], 0.5);
    geometry.dispose();
  });

  // geometry initialize之前设置indices
  it('set indices Data before initialize', function () {
    const option = {
      name: 'ReactangleGeometry',
      attributes: {
        'aPosition': {
          data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
      drawCount: 6,
      drawStart: 0,
      mode: glContext.TRIANGLES,
    };
    const geometry = new GLGeometry(renderer.engine, option);
    const indexData = geometry.getIndexData();

    expect(indexData[2]).to.eql(2);
    geometry.dispose();
  });

  // geometry 调用flush后检查数据
  it('update indices and attribute buffer and data after flush', function () {
    const option = {
      name: 'ReactangleGeometry',
      attributes: {
        'aPosition': {
          data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
      drawCount: 6,
      drawStart: 0,
      mode: glContext.TRIANGLES,
    };
    const geometry = new GLGeometry(renderer.engine, option);

    geometry.initialize(renderer.engine);
    const newPositionData = new Float32Array([1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0]);
    const newIndexData = new Uint32Array([3, 2, 1]);

    geometry.setAttributeData('aPosition', newPositionData);
    geometry.setIndexData(newIndexData);

    assert.equal(geometry.getIndexData()[1], 2);
    assert.equal(geometry.getAttributeData('aPosition')[1], -1.0);

    geometry.flush();
    const gpuBuffer = geometry.getAttributeBuffer('aPosition');
    const indicesBuffer = geometry.indicesBuffer;
    const buffer = new Float32Array(8);

    gpuBuffer.readSubData(0, buffer);
    expect(buffer).to.eql(new Float32Array([1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0]));

    const tempBuffer = new Uint32Array(3);

    indicesBuffer.readSubData(0, tempBuffer);
    expect(tempBuffer).to.eql(new Uint32Array([3, 2, 1]));
    geometry.dispose();
  });

  // 调用2次setAttributeSubData
  it('call twice setAttributeSubData', function () {
    const option = {
      name: 'test2',
      attributes: {
        'aPosition': {
          data: new Float32Array([0, 1, 2, 3, 4, 5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2]) },
      drawStart: 0,
      drawCount: 3,
    };
    const geom = new GLGeometry(renderer.engine, option);

    geom.initialize(renderer.engine);
    geom.setAttributeSubData('aPosition', 1, new Float32Array([11, 12]));
    let data = geom.getAttributeData('aPosition');

    expect(data).to.eql(new Float32Array([0, 11, 12, 3, 4, 5]));
    expect(geom.dirtyFlags['aPosition']).to.contains({
      dirty: true,
      start: 1,
      end: 2,
    });

    geom.setAttributeSubData('aPosition', 4, new Float32Array([15, 16]));
    data = geom.getAttributeData('aPosition');
    expect(data).to.eql(new Float32Array([0, 11, 12, 3, 15, 16]));
    expect(geom.dirtyFlags['aPosition']).to.contains({
      dirty: true,
      start: 1,
      end: 5,
    });
    geom.flush();
    expect(geom.dirtyFlags['aPosition'].discard).to.eql(false);
    expect(geom.dirtyFlags['aPosition'].start).to.eql(Number.POSITIVE_INFINITY);
    expect(geom.dirtyFlags['aPosition'].end).to.eql(0);

    // flush gpu buffer
    geom.flush();
    const gpuBuffer = geom.getAttributeBuffer('aPosition');
    const buffer2 = new Float32Array(6);

    expect(gpuBuffer).to.exist;
    gpuBuffer.readSubData(0, buffer2);
    expect(buffer2).to.eql(new Float32Array([0, 11, 12, 3, 15, 16]));

    geom.dispose();
  });

  // 调用setData后再调用setSubData
  it('call attribute and indices setSubData after setData', function () {
    const option = {
      name: 'test2',
      attributes: {
        'aPosition': {
          data: new Float32Array([0, 1, 2, 3, 4, 5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2]) },
      drawStart: 0,
      drawCount: 3,
    };

    const geom = new GLGeometry(renderer.engine, option);

    geom.initialize(renderer.engine);
    geom.setAttributeData('aPosition', new Float32Array([5, 5, 5, 5, 5, 5]));
    geom.setAttributeSubData('aPosition', 1, new Float32Array([15, 16]));
    geom.setIndexData(new Uint16Array([0, 1, 2, 3, 4, 5]));
    geom.setIndexSubData(1, new Uint16Array([9]));
    const data = geom.getAttributeData('aPosition');

    expect(data).to.eql(new Float32Array([5, 15, 16, 5, 5, 5]));
    expect(geom.dirtyFlags['aPosition'].discard).to.eql(true);
    expect(geom.dirtyFlags.index.discard).to.eql(true);

    // flush gpu buffer
    geom.flush();
    const gpuBuffer = geom.getAttributeBuffer('aPosition');
    const buffer2 = new Float32Array(6);

    expect(gpuBuffer).not.eql(undefined);
    gpuBuffer.readSubData(0, buffer2);
    expect(buffer2).to.eql(new Float32Array([5, 15, 16, 5, 5, 5]));
    geom.dispose();
  });

  // 调用2次setIndexSubData
  it('call twice setIndexSubData', function () {
    const option = {
      name: 'test2',
      attributes: {
        'aPosition': {
          data: new Float32Array([0, 1, 2, 3, 4, 5]),
          size: 2,
          stride: 0,
          offset: 0,
        },
      },
      indices: { data: new Uint16Array([0, 1, 2, 3, 2, 1]) },
      drawStart: 0,
      drawCount: 3,
    };
    const geom = new GLGeometry(renderer.engine, option);
    const initIndex = geom.getIndexData();

    expect(initIndex).to.eql(new Uint16Array([0, 1, 2, 3, 2, 1]));
    geom.initialize(renderer.engine);
    geom.setIndexSubData(0, new Uint16Array([1, 2]));
    geom.setIndexSubData(3, new Uint16Array([0, 1]));
    const indexData = geom.getIndexData();

    expect(indexData).to.eql(new Uint16Array([1, 2, 2, 0, 1, 1]));

    // flush gpu buffer
    geom.flush();
    const indexBuffer = geom.indicesBuffer;
    const buffer = new Uint16Array(6);

    indexBuffer.readSubData(0, buffer);
    expect(buffer).to.eql(new Uint16Array([1, 2, 2, 0, 1, 1]));

    geom.dispose();
  });

  // 创建attributeWithData时设置releasable
  it('create with attributeWithData with releasable', function () {
    const attributeWithData0 = {
      data: new Float32Array([0, 1, 2, 3, 4, 5]),
      size: 2,
      stride: 0,
      offset: 0,
      releasable: true,
    };
    const attributeWithData1 = {
      data: new Float32Array([2, 4, 6, 8, 3, 5]),
      size: 2,
      stride: 0,
      offset: 0,
      releasable: false,
    };
    const option = {
      name: 'test',
      drawStart: 0,
      mode: glContext.TRIANGLES,
      attributes: {
        'aPosition': attributeWithData0,
        'aPosition2': attributeWithData1,
      },
      indices: { data: new Uint16Array([0, 1, 2, 3, 2, 1]) },
      drawCount: 6,
    };
    const geom = new GLGeometry(renderer.engine, option);

    geom.initialize(renderer.engine);
    geom.flush();

    const buffer = geom.getAttributeData('aPosition');
    const buffer2 = geom.getAttributeData('aPosition2');

    expect(buffer).to.eql(undefined);
    expect(buffer2).to.eql(new Float32Array([2, 4, 6, 8, 3, 5]));

    geom.dispose();
  });

  // 修改具有dataSource的attribute数据时会影响共用buffer的其它attribute
  it('reset attribute with dataSource will affect other attribute which using the same buffer', function () {
    const positionAndUV = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
      1.0, -1.0, 1.0, 0.0,
      1.0, 1.0, 1.0, 1.0,
      -1.0, 1.0, 0.0, 1.0,
    ]);

    const attributePosition = {
      data: positionAndUV,
      size: 2,
      stride: 16, // 4*4
      offset: 0,
    };

    const attributeUV = {
      dataSource: 'aPosition',
      size: 2,
      stride: 16,
      offset: 8,
      type: glContext.FLOAT,
    };

    const option = {
      attributes: {
        'aPosition': attributePosition,
        'aUV': attributeUV,
      },
      mode: glContext.TRIANGLES,
      drawStart: 0,
      indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
      drawCount: 6,
    };

    // uv与position共用一个buffer
    // [-1.0, -1.0, 0.0, 0.0, 1.0, -1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 0.0, 1.0]
    const geom = new GLGeometry(renderer.engine, option);

    geom.initialize(renderer.engine);
    // 重置position buffer
    geom.setAttributeData('aPosition', new Float32Array([0.5, 0.5, 0.0, 0.0,
      0.5, -0.5, 1.0, 0.0,
      0.5, 0.5, 1.0, 1.0,
      -0.5, 0.5, 0.0, 1.0]));

    let cpuBuffer = geom.getAttributeData('aPosition');

    expect(cpuBuffer).to.eql(new Float32Array([0.5, 0.5, 0.0, 0.0,
      0.5, -0.5, 1.0, 0.0,
      0.5, 0.5, 1.0, 1.0,
      -0.5, 0.5, 0.0, 1.0]));

    // 重置uv buffer，也会影响到position buffer内容
    geom.setAttributeData('aUV', new Float32Array([0.5, 0.5, 0.0, 0.0,
      0.5, -0.5, 2.0, 0.0,
      0.5, 0.5, 2.0, 2.0,
      -0.5, 0.5, 0.0, 2.0]));

    cpuBuffer = geom.getAttributeData('aPosition');
    expect(cpuBuffer).to.eql(new Float32Array([0.5, 0.5, 0.0, 0.0,
      0.5, -0.5, 2.0, 0.0,
      0.5, 0.5, 2.0, 2.0,
      -0.5, 0.5, 0.0, 2.0]));

    geom.flush();
    const gpuUVBuffer = geom.getAttributeBuffer('aUV');
    const gpuPosBuffer = geom.getAttributeBuffer('aPosition');
    const bufferUV = new Float32Array(16);
    const bufferPos = new Float32Array(16);

    gpuUVBuffer.readSubData(0, bufferUV);
    gpuPosBuffer.readSubData(0, bufferPos);

    const expResult = new Float32Array([0.5, 0.5, 0.0, 0.0,
      0.5, -0.5, 2.0, 0.0,
      0.5, 0.5, 2.0, 2.0,
      -0.5, 0.5, 0.0, 2.0]);

    expect(bufferUV).to.eql(expResult);
    expect(bufferPos).to.eql(expResult);

    geom.dispose();
  });

  // drawCount小于0时不会触发drawCall
  it('geometry with drawCount < 0 would not trigger draw call', function () {
    const ret = createMesh(glRenderer, -2);
    const pass = new RenderPass(glRenderer, {
      name: 'test',
      meshes: [ret.mesh],
    });

    ret.geom.drawCount = -1;
    const frame = new RenderFrame({
      renderer,
      camera: new Camera(),
      renderPasses: [pass],
    });
    const d = gl.drawElements;
    const drawElement = gl.drawElements = chai.spy(d);

    renderer.renderRenderFrame(frame);
    expect(ret.geom.drawCount).to.eql(-1);
    expect(drawElement).not.has.been.called;
    gl.drawElements = d;
  });

  // drawCount等于0时不会触发drawCall
  it('geometry with drawCount == 0 would not invoke draw call', function () {
    const ret = createMesh(renderer, 0);
    const pass = new RenderPass(glRenderer, {
      name: 'test',
      meshes: [ret.mesh],
    });
    const frame = new RenderFrame({
      renderer,
      camera: new Camera(),
      renderPasses: [pass],
    });
    const d = gl.drawElements;
    const drawElement = gl.drawElements = chai.spy(d);

    renderer.renderRenderFrame(frame);
    expect(ret.geom.drawCount).to.eql(0);
    expect(drawElement).not.has.been.called;
    gl.drawElements = d;
    frame.dispose();
  });

  // drawCount为undefined时会触发indexCount次drawCall
  it('geometry drawCount == undefined would use index Count', function () {
    const ret = createMesh(renderer, undefined);
    const pass = new RenderPass(renderer, {
      name: 'test',
      meshes: [ret.mesh],
    });
    const frame = new RenderFrame({
      renderer,
      camera: new Camera(),
    });

    frame.setRenderPasses([pass]);
    const d = gl.drawElements;
    const drawElement = gl.drawElements = chai.spy(d);

    renderer.renderRenderFrame(frame);
    expect(ret.geom.drawCount).is.a.NaN;
    expect(drawElement).to.have.been.called.once;
    expect(drawElement).to.have.been.called.with(glContext.TRIANGLES, ret.geom.indicesBuffer.elementCount, ret.geom.indicesBuffer.type, 0);
    gl.drawElements = d;
  });
});

function createMesh (renderer, drawCount) {
  const engine = renderer.engine;
  const vertex = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition.x, aPosition.y, 0.0, 1.0);
}
`;
  const fragment = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;
  const mtl = new GLMaterial(
    engine,
    {
      shader: {
        name: 'base_shader',
        vertex,
        fragment,
      },
      states: {
        depthTest: true,
      },
    });
  const position = {
    data: new Float32Array([0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5]),
    size: 2,
    stride: 0,
    offset: 0,
    normalize: false,
    releasable: false,
  };
  const geomOption = {
    attributes: {
      'aPosition': position,
    },
    indices: { data: new Uint16Array([0, 1, 2, 2, 3, 0]) },
    drawCount,
    drawStart: 0,
    mode: glContext.TRIANGLES,
  };
  const geom = new GLGeometry(engine, geomOption);
  const meshOption = {
    geometry: geom,
    material: mtl,
  };
  const mesh = new Mesh(engine, meshOption);

  return { mesh, geom };
}
