// @ts-nocheck
import { glContext, ShaderCompileResultStatus } from '@galacean/effects-core';
import { GLGPUBuffer, GLGeometry, GLRenderer } from '@galacean/effects-webgl';
import { getGL, getGL2 } from './gl-utils.js';

const { expect } = chai;

describe('webgl/gl-vertex-array-object', () => {
  const vertex = `
    precision highp float;
    attribute vec2 aPoint;
    attribute vec2 aTexCoord;
    void main(){
      gl_Position = vec4(aPoint,aTexCoord);
    }
  `;
  const fragment = `
    precision highp float;

    void main(){
      gl_FragColor =vec4(1.0,0.0,0.0,1.0);
    }
    `;
  let renderer, glRenderer;

  afterEach(() => {
    const canvas = renderer.canvas;

    renderer.dispose();
    canvas.remove();
    renderer = null;
  });

  it('create vao use extension when webgl', () => {
    renderer = createGLGPURenderer('webgl');
    glRenderer = renderer.glRenderer;
    const vao = glRenderer.createVAO();
    const ext = glRenderer.gl.getExtension('OES_vertex_array_object');

    if (ext) {
      vao?.bind();
      expect(ext.isVertexArrayOES(vao.vao)).is.true;
      vao?.dispose();
      expect(ext.isVertexArrayOES(vao.vao)).is.false;
    }
  });

  it('create vao when webgl2', () => {
    renderer = createGLGPURenderer('webgl2');
    glRenderer = renderer.glRenderer;
    const gl = glRenderer.gl;
    const vao = glRenderer.createVAO();

    vao.bind();
    expect(gl.isVertexArray(vao.vao)).is.true;
    vao.dispose();
    expect(gl.isVertexArray(vao.vao)).is.false;
  });

  it('bind vertexPointer', () => {
    renderer = createGLGPURenderer('webgl');
    glRenderer = renderer.glRenderer;
    const engine = renderer.engine;
    const glGeometry = new GLGeometry(
      engine,
      {
        name: 'vao1',
        drawCount: 3,
        drawStart: 0,
        mode: 0,
        attributes: {
          aPoint: {
            size: 2,
            stride: Float32Array.BYTES_PER_ELEMENT * 4,
            type: glContext.FLOAT,
            data: new Float32Array(12),
          },
          aTexCoord: {
            size: 2,
            stride: Float32Array.BYTES_PER_ELEMENT * 4,
            offset: Float32Array.BYTES_PER_ELEMENT * 2,
            type: glContext.FLOAT,
            data: new Float32Array(12),
          },
        },
      });

    glGeometry.initialize();

    const shader = glRenderer.pipelineContext.shaderLibrary.createShader({ vertex, fragment });

    glRenderer.pipelineContext.shaderLibrary.compileShader(shader);
    const result = shader.compileResult;

    expect(result.status).to.eql(ShaderCompileResultStatus.success);
    const glProgram = shader.program;
    const gl = glRenderer.gl;
    const loc = glProgram.attribInfoMap['aPoint'].loc;
    const texLoc = glProgram.attribInfoMap['aTexCoord'].loc;

    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.UNSIGNED_INT, true, 0, 0);
    glProgram.setupAttributes(glGeometry);
    expect(loc).is.not.NaN;
    expect(texLoc).is.not.NaN;
    const sizeAP = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE);
    const strideAP = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE);

    expect(sizeAP).to.eql(2);
    expect(strideAP).to.eql(4 * Float32Array.BYTES_PER_ELEMENT);

    expect(gl.getVertexAttrib(texLoc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(2);
    expect(gl.getVertexAttrib(texLoc, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).to.eql(4 * Float32Array.BYTES_PER_ELEMENT);
    const vao = glGeometry.vaos[glProgram.id];

    vao.unbind();
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(4);
    vao.bind();
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(2);
    expect(gl.getExtension('OES_vertex_array_object').isVertexArrayOES(vao.vao)).is.true;
    vao.dispose();
    expect(gl.getExtension('OES_vertex_array_object').isVertexArrayOES(vao.vao)).is.false;
  });

  it('use state to reduce binding call', () => {
    renderer = createGLGPURenderer('webgl2');
    glRenderer = renderer.glRenderer;
    const engine = renderer.engine;
    const glGeometry = new GLGeometry(
      engine,
      {
        name: 'vao2',
        drawCount: 3,
        drawStart: 0,
        mode: 0,
        buffers: {
          aPoint: new GLGPUBuffer(glRenderer.pipelineContext, { data: new Float32Array(12) }),
        },
        attributes: {
          aPoint: {
            size: 2,
            stride: Float32Array.BYTES_PER_ELEMENT * 4,
            type: glContext.FLOAT,
            dataSource: 'aPoint',
          },
          aTexCoord: {
            size: 2,
            stride: Float32Array.BYTES_PER_ELEMENT * 4,
            offset: Float32Array.BYTES_PER_ELEMENT * 2,
            type: glContext.FLOAT,
            dataSource: 'aPoint',
          },
        },
      });

    glGeometry.initialize();
    const bindFunc = chai.spy(glRenderer.gl.bindVertexArray);

    if ('bindVertexArray' in glRenderer.gl) {
      glRenderer.gl.bindVertexArray = bindFunc;
    }
    const vao = glRenderer.createVAO('test');

    // TODO 后续增加
    // vao?.bind();
    // expect(bindFunc).to.have.been.called.once;
    // vao?.bind();
    // expect(bindFunc).to.have.been.called.once;
    // vao?.unbind();
    // expect(bindFunc).to.have.been.called.twice;
    // vao?.bind();
    // expect(bindFunc).to.have.been.called.exactly(3);
  });
});

function createGLGPURenderer (type) {
  const gl = type === 'webgl' ? getGL() : getGL2();

  return new GLRenderer(gl.canvas, type);
}
