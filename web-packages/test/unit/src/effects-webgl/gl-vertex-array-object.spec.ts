import type { Renderer, ShaderVariant } from '@galacean/effects-core';
import { Geometry, glContext, ShaderCompileResultStatus } from '@galacean/effects-core';
import { GLEngine } from '@galacean/effects-webgl';
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
    const engine = renderer.engine as GLEngine;

    engine.dispose();
    (engine.context.canvas as HTMLCanvasElement)?.remove();
    // @ts-expect-error
    renderer = null;
  });

  it('bind vertexPointer', () => {
    renderer = createGLGPURenderer('webgl');
    glRenderer = renderer;
    const engine = renderer.engine;
    const geometry = new Geometry(engine, {
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

    const shader = (glRenderer.engine as GLEngine).shaderLibrary.createShader({ vertex, fragment });

    (glRenderer.engine as GLEngine).shaderLibrary.compileShader(shader);
    const result = shader.compileResult;

    expect(result.status).to.eql(ShaderCompileResultStatus.success);
    const glProgram = shader.program;
    const gl = (glRenderer.engine as GLEngine).gl;
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
    extension!.bindVertexArrayOES(null);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(4);
    extension!.bindVertexArrayOES(vao);
    expect(gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE)).to.eql(2);
    expect(extension!.isVertexArrayOES(vao)).is.true;
    extension!.deleteVertexArrayOES(vao);
    expect(extension!.isVertexArrayOES(vao)).is.false;
  });

  it('use state to reduce binding call', () => {
    renderer = createGLGPURenderer('webgl2');
    glRenderer = renderer;
    const engine = renderer.engine;
    const geometry = new Geometry(engine, {
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
    const gl = (glRenderer.engine as GLEngine).gl;
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

  it('bind buffers directly when vertex array objects are unavailable', () => {
    renderer = createGLGPURenderer('webgl');
    const engine = renderer.engine as GLEngine;
    const capability = engine.gpuCapability.detail as { vertexArrayObject?: boolean };
    const bindBuffers = chai.spy(() => {});

    capability.vertexArrayObject = false;
    engine.bindBuffers = bindBuffers;
    const geometry = new Geometry(engine, { attributes: {} });

    geometry.bind({ key: 'direct-binding' } as unknown as ShaderVariant);
    expect(bindBuffers).to.have.been.called.once;
  });
});

function createGLGPURenderer (type: 'webgl' | 'webgl2') {
  const gl = type === 'webgl' ? getGL() : getGL2();
  const canvas = gl!.canvas as HTMLCanvasElement;
  const engine = new GLEngine(canvas, { glType: type });

  return engine.renderer;
}

// Expose the initialization also used by the context restore handler.
class CompatibilityTestEngine extends GLEngine {
  reinitializeContext (): void {
    this.initGLContext();
  }
}

describe('webgl/context compatibility', () => {
  for (const type of ['webgl', 'webgl2'] as const) {
    it(`initializes ${type} without modifying a non-extensible context`, () => {
      const gl = (type === 'webgl' ? getGL() : getGL2())!;
      const prototype = Object.getPrototypeOf(gl);
      const properties = Object.getOwnPropertyDescriptors(gl);

      Object.preventExtensions(gl);
      const engine = new CompatibilityTestEngine(gl.canvas as HTMLCanvasElement, { glType: type });

      try {
        engine.reinitializeContext();
        expect(engine.gl).to.equal(gl);
        expect(Object.getPrototypeOf(gl)).to.equal(prototype);
        expect(Object.getOwnPropertyDescriptors(gl)).to.deep.equal(properties);
      } finally {
        engine.dispose();
      }
    });
  }

  it('refreshes WebGL1 extensions and preserves fallbacks without writing to the context', () => {
    const gl = getGL()!;
    const getExtension = gl.getExtension.bind(gl);
    const vaoExtension = getExtension('OES_vertex_array_object')!;
    const calls: unknown[][] = [];
    const instanceExtension = {
      drawArraysInstancedANGLE (...args: number[]) {
        expect(this).to.equal(instanceExtension);
        calls.push(args);
      },
      drawElementsInstancedANGLE (...args: number[]) {
        expect(this).to.equal(instanceExtension);
        calls.push(args);
      },
      vertexAttribDivisorANGLE () {},
    };
    let extensionsAvailable = true;

    gl.getExtension = ((name: string) => {
      if (name === 'ANGLE_instanced_arrays') {
        return extensionsAvailable ? instanceExtension : null;
      }
      if (name === 'OES_vertex_array_object') {
        return extensionsAvailable ? vaoExtension : null;
      }

      return getExtension(name);
    }) as typeof gl.getExtension;
    Object.preventExtensions(gl);
    const engine = new CompatibilityTestEngine(gl.canvas as HTMLCanvasElement, { glType: 'webgl' });
    const shader = { program: { getAttributesNames: () => [] } } as unknown as ShaderVariant;

    try {
      const vao = engine.recordVertexArrayObject({}, null, shader)!;

      expect(vao).to.exist;
      engine.bindVertexArrayObject(vao, null);
      expect(gl.getParameter(vaoExtension.VERTEX_ARRAY_BINDING_OES)).to.equal(vao);
      engine.releaseVertexArrayObject(vao);
      expect(vaoExtension.isVertexArrayOES(vao)).to.equal(false);
      engine.drawArraysType(gl.TRIANGLES, 0, 3, 2);
      engine.drawElementsType(gl.TRIANGLES, 0, 3, 2);
      expect(calls).to.deep.equal([
        [gl.TRIANGLES, 0, 3, 2],
        [gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0, 2],
      ]);

      extensionsAvailable = false;
      engine.reinitializeContext();
      expect(engine.recordVertexArrayObject({}, null, shader)).to.equal(undefined);
      expect(() => engine.drawArraysType(gl.TRIANGLES, 0, 3, 2)).to.throw('Instanced drawing is not supported');
      expect(() => engine.drawElementsType(gl.TRIANGLES, 0, 3, 2)).to.throw('Instanced drawing is not supported');
      expect(calls).to.have.length(2);

      extensionsAvailable = true;
      engine.reinitializeContext();
      engine.drawArraysType(gl.TRIANGLES, 0, 3, 2);
      expect(calls).to.have.length(3);
      expect(Object.prototype.hasOwnProperty.call(gl, 'createVertexArray')).to.equal(false);
      expect(Object.prototype.hasOwnProperty.call(gl, 'drawArraysInstanced')).to.equal(false);
    } finally {
      engine.dispose();
    }
  });
});
