import { Engine } from '@galacean/effects-core';
import type { Renderer, ShaderVariant } from '@galacean/effects-core';
import { Geometry, glContext, ShaderCompileResultStatus } from '@galacean/effects-core';
import type { RenderingDeviceWebGL, GPUProgramWebGL } from '@galacean/effects-webgl';
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
  let renderer: Renderer;
  let glRenderer;

  afterEach(() => {
    const engine = renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL;

    engine.dispose();
    (engine.context.canvas as HTMLCanvasElement)?.remove();
    // @ts-expect-error
    renderer = null;
  });

  it('bind vertexPointer', () => {
    renderer = createGLGPURenderer('webgl');
    glRenderer = renderer;
    const engine = renderer.engine;
    const geometry = new Geometry(renderer.engine, {
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

    geometry.initialize();

    const shader = (glRenderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary.createShader({ vertex, fragment });

    (glRenderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).shaderLibrary.compileShader(shader);
    const result = shader.compileResult;

    expect(result.status).to.eql(ShaderCompileResultStatus.success);
    const glProgram = shader.program;
    const gl = (glRenderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
    // @ts-expect-error private
    const loc = glProgram.attribInfoMap['aPoint'].loc;
    // @ts-expect-error private
    const texLoc = glProgram.attribInfoMap['aTexCoord'].loc;

    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.UNSIGNED_INT, true, 0, 0);
    const extension = gl.getExtension('OES_vertex_array_object');

    expect(extension).is.not.null;
    geometry.bind(shader);
    const vao = gl.getParameter(extension!.VERTEX_ARRAY_BINDING_OES) as WebGLVertexArrayObject;

    geometry.bind(shader);
    const cachedVao = gl.getParameter(extension!.VERTEX_ARRAY_BINDING_OES) as WebGLVertexArrayObject;

    expect(cachedVao).to.equal(vao);
    expect(loc).is.not.NaN;
    expect(texLoc).is.not.NaN;
    const sizeAP = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE);
    const strideAP = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE);

    expect(sizeAP).to.eql(2);
    expect(strideAP).to.eql(4 * Float32Array.BYTES_PER_ELEMENT);

    expect(gl.getVertexAttrib(texLoc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(2);
    expect(gl.getVertexAttrib(texLoc, gl.VERTEX_ATTRIB_ARRAY_STRIDE)).to.eql(4 * Float32Array.BYTES_PER_ELEMENT);
    gl.bindVertexArray(null);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(4);
    gl.bindVertexArray(vao);
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(2);
    expect(extension!.isVertexArrayOES(vao)).is.true;
    gl.deleteVertexArray(vao);
    expect(extension!.isVertexArrayOES(vao)).is.false;
  });

  it('use state to reduce binding call', () => {
    renderer = createGLGPURenderer('webgl2');
    glRenderer = renderer;
    const engine = renderer.engine;
    const geometry = new Geometry(renderer.engine, {
      name: 'vao2',
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
          dataSource: 'aPoint',
        },
      },
    });

    geometry.initialize();
    const gl = (glRenderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL).gl;
    const bindFunc = chai.spy(gl.bindVertexArray);

    if ('bindVertexArray' in gl) {
      gl.bindVertexArray = bindFunc;
    }

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

  for (const type of ['webgl', 'webgl2'] as const) {
    for (const indexed of [false, true]) {
      for (const instanced of [false, true]) {
        it(`unbinds after drawing and supports drawing again (${type}, indexed=${indexed}, instanced=${instanced})`, () => {
          renderer = createGLGPURenderer(type);
          const engine = renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL;
          const gl = engine.gl;
          const binding = type === 'webgl2'
            ? gl.VERTEX_ARRAY_BINDING
            : gl.getExtension('OES_vertex_array_object')!.VERTEX_ARRAY_BINDING_OES;
          const geometry = new Geometry(renderer.engine, {
            attributes: {
              aPoint: { size: 2, stride: 16, data: new Float32Array([-1, -1, 0, 1, 1, -1, 0, 1, 0, 1, 0, 1]) },
              aTexCoord: { size: 2, stride: 16, offset: 8, dataSource: 'aPoint' },
            },
            indices: indexed ? { data: new Uint16Array([0, 1, 2]) } : undefined,
            drawCount: 3,
          });
          const shader = engine.shaderLibrary.createShader({ vertex, fragment });

          engine.shaderLibrary.compileShader(shader);
          expect(shader.compileResult.status).to.equal(ShaderCompileResultStatus.success);
          geometry.initialize();
          engine.useProgram((shader.program as GPUProgramWebGL).program);

          for (let draw = 0; draw < 2; draw++) {
            geometry.bind(shader);
            expect(gl.getParameter(binding)).to.not.equal(null);
            if (indexed) {
              engine.drawElementsType(gl.TRIANGLES, 0, 3, instanced ? 2 : undefined);
            } else {
              engine.drawArraysType(gl.TRIANGLES, 0, 3, instanced ? 2 : undefined);
            }
            expect(gl.getError()).to.equal(gl.NO_ERROR);
            expect(gl.getParameter(binding)).to.equal(null);
            // @ts-expect-error Verify the cache matches the native VAO binding.
            expect(engine.currentVertexArrayObject).to.equal(null);
            // @ts-expect-error The next draw must restore its own index buffer.
            expect(engine.currentIndexBuffer).to.equal(null);
          }
          geometry.dispose();
          expect(gl.getError()).to.equal(gl.NO_ERROR);
        });
      }
    }
  }

  it('bind buffers directly when vertex array objects are unavailable', () => {
    renderer = createGLGPURenderer('webgl');
    const engine = renderer.engine.displayServer.renderingDevice as RenderingDeviceWebGL;
    const capability = engine.gpuCapability.detail as { vertexArrayObject?: boolean };
    const bindBuffers = chai.spy(() => {});

    capability.vertexArrayObject = false;
    engine.bindBuffers = bindBuffers;
    const geometry = new Geometry(renderer.engine, { attributes: {} });

    geometry.bind({ key: 'direct-binding' } as unknown as ShaderVariant);
    expect(bindBuffers).to.have.been.called.once;
  });
});

function createGLGPURenderer (type: 'webgl' | 'webgl2') {
  const gl = type === 'webgl' ? getGL() : getGL2();
  const canvas = gl!.canvas as HTMLCanvasElement;
  const engine = new Engine(canvas, { glType: type });

  return engine.renderer;
}
